import express from 'express';
import { WebSocketServer } from 'ws';
import Docker from 'dockerode';
import pty from 'node-pty';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const docker = new Docker();

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Enhanced terminal server is running' });
});

// AI Agent Terminal Session Management
app.use(express.json());

// Create or get persistent terminal session for AI agent
app.post('/api/terminal/ai-session', (req, res) => {
  try {
    const { sessionId = 'default-ai-session' } = req.body;

    if (aiTerminalSessions.has(sessionId)) {
      console.log(`🤖 Returning existing AI terminal session: ${sessionId}`);
      return res.json({
        sessionId,
        status: 'existing',
        message: 'AI terminal session already exists'
      });
    }

    console.log(`🤖 Creating new AI terminal session: ${sessionId}`);

    // Spawn shell process for AI
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 100,
      rows: 30,
      cwd: path.join(process.cwd(), 'workspace'),
      env: {
        ...process.env,
        TERM: 'xterm-color',
        COLORTERM: 'truecolor',
        AI_SESSION: 'true',
        BASH_SILENCE_DEPRECATION_WARNING: '1'
      }
    });

    aiTerminalSessions.set(sessionId, ptyProcess);
    aiSessionOutputBuffers.set(sessionId, []);

    // Buffer output for AI agent to read
    ptyProcess.onData((data) => {
      const buffer = aiSessionOutputBuffers.get(sessionId) || [];
      buffer.push({
        timestamp: Date.now(),
        data: data
      });

      // Keep only last 100 output chunks to prevent memory issues
      if (buffer.length > 100) {
        buffer.shift();
      }

      aiSessionOutputBuffers.set(sessionId, buffer);
    });

    // Handle process exit
    ptyProcess.onExit((exitCode, signal) => {
      console.log(`🤖 AI terminal session ${sessionId} exited: code ${exitCode}, signal ${signal}`);
      aiTerminalSessions.delete(sessionId);
      aiSessionOutputBuffers.delete(sessionId);
    });

    res.json({
      sessionId,
      status: 'created',
      message: 'AI terminal session created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating AI terminal session:', error);
    res.status(500).json({ error: 'Failed to create AI terminal session' });
  }
});

// Execute command in AI terminal session
app.post('/api/terminal/ai-execute', async (req, res) => {
  try {
    const { sessionId = 'default-ai-session', command, timeout = 10000 } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const ptyProcess = aiTerminalSessions.get(sessionId);
    if (!ptyProcess) {
      return res.status(404).json({ error: 'AI terminal session not found. Create one first.' });
    }

    console.log(`🤖 Executing command in AI session ${sessionId}: ${command}`);

    // Clear previous output buffer for this command
    const currentTime = Date.now();
    const buffer = aiSessionOutputBuffers.get(sessionId) || [];

    // Send command to terminal
    ptyProcess.write(command + '\\r');

    // Wait for command output with timeout
    const outputResult = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, timeout);

      const checkOutput = () => {
        const currentBuffer = aiSessionOutputBuffers.get(sessionId) || [];
        const newOutput = currentBuffer.filter(item => item.timestamp > currentTime);

        if (newOutput.length > 0) {
          // Wait a bit more to capture complete output
          setTimeout(() => {
            const finalBuffer = aiSessionOutputBuffers.get(sessionId) || [];
            const allNewOutput = finalBuffer.filter(item => item.timestamp > currentTime);

            clearTimeout(timeoutId);

            // Extract text content and clean it up
            let output = allNewOutput.map(item => item.data).join('');

            // Remove command echo and ANSI codes for cleaner output
            output = output.replace(/\\u001b\\[[0-9;]*m/g, ''); // Remove ANSI escape codes
            output = output.replace(new RegExp(command.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), ''); // Remove command echo

            resolve({
              output: output.trim(),
              rawOutput: allNewOutput,
              executedCommand: command
            });
          }, 500); // Wait 500ms to capture complete output
        } else {
          setTimeout(checkOutput, 200); // Check again in 200ms
        }
      };

      setTimeout(checkOutput, 100); // Start checking after 100ms
    });

    res.json({
      sessionId,
      command,
      success: true,
      ...outputResult
    });

  } catch (error) {
    console.error('❌ Error executing AI command:', error);
    res.status(500).json({
      error: error.message,
      command: req.body.command
    });
  }
});

// Get AI terminal session output
app.get('/api/terminal/ai-output/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { since } = req.query;

    const buffer = aiSessionOutputBuffers.get(sessionId) || [];
    let output = buffer;

    if (since) {
      const sinceTime = parseInt(since);
      output = buffer.filter(item => item.timestamp > sinceTime);
    }

    res.json({
      sessionId,
      output: output.map(item => item.data).join(''),
      rawOutput: output,
      totalItems: output.length
    });

  } catch (error) {
    console.error('❌ Error getting AI output:', error);
    res.status(500).json({ error: 'Failed to get terminal output' });
  }
});

// List AI terminal sessions
app.get('/api/terminal/ai-sessions', (req, res) => {
  const sessions = Array.from(aiTerminalSessions.keys()).map(sessionId => ({
    sessionId,
    active: aiTerminalSessions.has(sessionId),
    bufferSize: (aiSessionOutputBuffers.get(sessionId) || []).length
  }));

  res.json({ sessions });
});

// ===== COMPILER TERMINAL API ENDPOINTS =====

// Create or get persistent compiler terminal session for AI agent
app.post('/api/terminal/compiler-session', (req, res) => {
  try {
    const { sessionId = 'compiler-ai-session' } = req.body;

    if (compilerTerminalSessions.has(sessionId)) {
      console.log(`🔧 Returning existing compiler terminal session: ${sessionId}`);
      return res.json({
        sessionId,
        status: 'existing',
        message: 'Compiler terminal session already exists'
      });
    }

    console.log(`🔧 Creating new compiler terminal session: ${sessionId}`);

    // Create a compiler-focused terminal environment
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: path.join(process.cwd(), 'workspace'),
      env: {
        ...process.env,
        TERM: 'xterm-color',
        COLORTERM: 'truecolor',
        PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/bin',
        COMPILER_SESSION: 'true',
        AI_COMPILER_SESSION: sessionId,
        BASH_SILENCE_DEPRECATION_WARNING: '1'
      }
    });

    compilerTerminalSessions.set(sessionId, ptyProcess);
    compilerSessionOutputBuffers.set(sessionId, []);

    // Buffer output for AI agent to read
    ptyProcess.onData((data) => {
      const buffer = compilerSessionOutputBuffers.get(sessionId) || [];
      buffer.push({
        timestamp: Date.now(),
        data: data
      });

      // Keep only last 200 output chunks for compiler sessions (more than regular)
      if (buffer.length > 200) {
        buffer.shift();
      }

      compilerSessionOutputBuffers.set(sessionId, buffer);
    });

    // Handle process exit
    ptyProcess.onExit((exitCode, signal) => {
      console.log(`🔧 Compiler terminal session ${sessionId} exited: code ${exitCode}, signal ${signal}`);
      compilerTerminalSessions.delete(sessionId);
      compilerSessionOutputBuffers.delete(sessionId);
    });

    // Send initial setup commands for compiler environment
    setTimeout(() => {
      ptyProcess.write('echo "🔧 Compiler Terminal Ready - AI Agent Session"\r');
      ptyProcess.write('echo "Languages supported: Python, Node.js, and more..."\r');
    }, 100);

    res.json({
      sessionId,
      status: 'created',
      message: 'Compiler terminal session created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating compiler terminal session:', error);
    res.status(500).json({ error: 'Failed to create compiler terminal session' });
  }
});

// Execute command in compiler terminal session
app.post('/api/terminal/compiler-execute', async (req, res) => {
  try {
    const { sessionId = 'compiler-ai-session', command, timeout = 15000 } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    let ptyProcess = compilerTerminalSessions.get(sessionId);

    // Auto-create session if it doesn't exist
    if (!ptyProcess) {
      console.log(`🔧 Auto-creating compiler terminal session: ${sessionId}`);

      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: path.join(process.cwd(), 'workspace'),
        env: {
          ...process.env,
          TERM: 'xterm-color',
          COLORTERM: 'truecolor',
          PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/bin',
          COMPILER_SESSION: 'true',
          AI_COMPILER_SESSION: sessionId,
          BASH_SILENCE_DEPRECATION_WARNING: '1'
        }
      });

      compilerTerminalSessions.set(sessionId, ptyProcess);
      compilerSessionOutputBuffers.set(sessionId, []);

      // Buffer output for AI agent to read
      ptyProcess.onData((data) => {
        const buffer = compilerSessionOutputBuffers.get(sessionId) || [];
        buffer.push({
          timestamp: Date.now(),
          data: data
        });

        if (buffer.length > 200) {
          buffer.shift();
        }

        compilerSessionOutputBuffers.set(sessionId, buffer);
      });

      // Handle process exit
      ptyProcess.onExit((exitCode, signal) => {
        console.log(`🔧 Compiler terminal session ${sessionId} exited: code ${exitCode}, signal ${signal}`);
        compilerTerminalSessions.delete(sessionId);
        compilerSessionOutputBuffers.delete(sessionId);
      });

      // Wait for shell to initialize and clear startup output
      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear any startup output from the buffer
      compilerSessionOutputBuffers.set(sessionId, []);
    }

    console.log(`🔧 Executing compiler command in session ${sessionId}: ${command}`);

    // Get timestamp JUST before sending command
    const currentTime = Date.now();

    // Send command to terminal with newline
    ptyProcess.write(command + '\n');

    // Broadcast to WebSocket clients that AI command was executed
    broadcastToWebSocketClients({
      type: 'ai-command',
      sessionId: sessionId,
      command: command,
      timestamp: currentTime
    });

    // Wait for command output with longer timeout for compilation
    const outputResult = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Compiler command execution timeout'));
      }, timeout);

      let lastOutputLength = 0;
      let stableCount = 0;

      const checkOutput = () => {
        const currentBuffer = compilerSessionOutputBuffers.get(sessionId) || [];
        const newOutput = currentBuffer.filter(item => item.timestamp > currentTime);

        if (newOutput.length > 0) {
          // Check if output has stabilized (no new output for 2 consecutive checks)
          if (newOutput.length === lastOutputLength) {
            stableCount++;
          } else {
            stableCount = 0;
            lastOutputLength = newOutput.length;
          }

          // If output is stable for 2 checks (400ms), consider it complete
          if (stableCount >= 2) {
            clearTimeout(timeoutId);

            // Extract text content and clean it up
            let output = newOutput.map(item => item.data).join('');

            // Remove ANSI escape codes
            output = output.replace(/\u001b\[[0-9;]*m/g, '');

            // Remove command echo (appears at start)
            const lines = output.split('\n');
            if (lines.length > 1 && lines[0].includes(command)) {
              lines.shift(); // Remove first line with command echo
            }
            output = lines.join('\n');

            // Remove bash prompt at the end (bash-3.2$, $, >, etc.)
            output = output.replace(/\r?\n?bash-[0-9.]+\$\s*$/, '');
            output = output.replace(/\r?\n?\$\s*$/, '');
            output = output.replace(/\r/g, ''); // Remove all carriage returns

            // Broadcast the output to WebSocket clients for real-time display
            broadcastToWebSocketClients({
              type: 'output',
              sessionId: sessionId,
              data: output.trim(),
              command: command,
              isCompilerSession: true
            });

            resolve({
              output: output.trim(),
              rawOutput: newOutput,
              executedCommand: command,
              isCompilerSession: true,
              exitCode: 0
            });
          } else {
            setTimeout(checkOutput, 200); // Check again in 200ms
          }
        } else {
          setTimeout(checkOutput, 100); // Check more frequently if no output yet
        }
      };

      setTimeout(checkOutput, 150); // Start checking after 150ms
    });

    res.json({
      sessionId,
      command,
      success: true,
      ...outputResult
    });

  } catch (error) {
    console.error('❌ Error executing compiler command:', error);
    res.status(500).json({
      error: error.message,
      command: req.body.command,
      isCompilerSession: true
    });
  }
});

// Get compiler terminal session output
app.get('/api/terminal/compiler-output/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { since } = req.query;

    const buffer = compilerSessionOutputBuffers.get(sessionId) || [];
    let output = buffer;

    if (since) {
      const sinceTime = parseInt(since);
      output = buffer.filter(item => item.timestamp > sinceTime);
    }

    res.json({
      sessionId,
      output: output.map(item => item.data).join(''),
      rawOutput: output,
      totalItems: output.length,
      isCompilerSession: true
    });

  } catch (error) {
    console.error('❌ Error getting compiler output:', error);
    res.status(500).json({ error: 'Failed to get compiler terminal output' });
  }
});

// List compiler terminal sessions
app.get('/api/terminal/compiler-sessions', (req, res) => {
  const sessions = Array.from(compilerTerminalSessions.keys()).map(sessionId => ({
    sessionId,
    active: compilerTerminalSessions.has(sessionId),
    bufferSize: (compilerSessionOutputBuffers.get(sessionId) || []).length,
    type: 'compiler'
  }));

  res.json({ sessions });
});

const server = app.listen(3001, () => {
  console.log('🚀 Enhanced Terminal server running on port 3001');
  console.log(`📱 Platform: ${os.platform()}`);
  console.log('🔧 Supporting both Docker and PTY terminals');
});

const wss = new WebSocketServer({ server });

// Store active connections and sessions
const connections = new Map();
const ptySessions = new Map();
const containerSessions = new Map();
const connectionAttempts = new Map();

// AI Agent persistent terminal sessions
const aiTerminalSessions = new Map();
const aiSessionOutputBuffers = new Map();

// Compiler terminal sessions for AI agents
const compilerTerminalSessions = new Map();
const compilerSessionOutputBuffers = new Map();

// Track WebSocket clients for real-time broadcasting
const webSocketClients = new Set();

// Function to broadcast messages to all connected WebSocket clients
function broadcastToWebSocketClients(message) {
  const messageStr = JSON.stringify(message);
  webSocketClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting to WebSocket client:', error);
        webSocketClients.delete(client); // Remove failed clients
      }
    }
  });
}

// Rate limiting configuration
const maxConnectionAttempts = 10;
const rateLimitCooldown = 60000; // 1 minute

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  const url = new URL(req.url, `http://${req.headers.host}`);

  console.log(`🔗 New connection from ${clientIp} to ${url.pathname}`);

  // Rate limiting
  const attempts = connectionAttempts.get(clientIp) || 0;
  if (attempts >= maxConnectionAttempts) {
    console.log(`🚫 Rate limited connection from ${clientIp}`);
    ws.close(1008, 'Rate limit exceeded');
    return;
  }

  connectionAttempts.set(clientIp, attempts + 1);
  setTimeout(() => {
    const currentAttempts = connectionAttempts.get(clientIp) || 0;
    if (currentAttempts > 0) {
      connectionAttempts.set(clientIp, Math.max(0, currentAttempts - 1));
    }
  }, rateLimitCooldown);

  // Handle different terminal types based on path
  if (url.pathname === '/terminal') {
    handlePtyTerminal(ws, req);
  } else {
    handleDockerTerminal(ws, req);
  }
});

// PTY Terminal Handler (for real-time terminal integration)
function handlePtyTerminal(ws, req) {
  const sessionId = Date.now().toString();
  console.log(`🖥️  Starting PTY terminal session ${sessionId}`);

  // Track this WebSocket client for broadcasting
  webSocketClients.add(ws);

  // Spawn shell process with minimal output
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const shellArgs = process.platform === 'win32' ? [] : ['--norc', '--noprofile'];
  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: path.join(process.cwd(), 'workspace'),
    env: {
      ...process.env,
      TERM: 'xterm-color',
      COLORTERM: 'truecolor',
      BASH_SILENCE_DEPRECATION_WARNING: '1'
    }
  });

  ptySessions.set(sessionId, ptyProcess);

  // Send initial prompt
  // ws.send(`\r\n🚀 Terminal ready! Working directory: ${path.join(process.cwd(), 'workspace')}\r\n`);

  // Forward pty output to WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = data.toString();

      // Try to parse as JSON for control messages
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          console.log(`📐 Resized terminal ${sessionId} to ${parsed.cols}x${parsed.rows}`);
          return;
        } else if (parsed.type === 'input') {
          ptyProcess.write(parsed.data);
          return;
        }
      } catch {
        // Not JSON, treat as direct input
      }

      // Direct input to terminal
      ptyProcess.write(message);
    } catch (error) {
      console.error(`❌ Error handling message for session ${sessionId}:`, error);
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(`🔌 PTY terminal session ${sessionId} closed`);
    webSocketClients.delete(ws); // Remove from broadcast list
    if (ptyProcess) {
      ptyProcess.kill();
    }
    ptySessions.delete(sessionId);
  });

  // Handle pty process exit
  ptyProcess.onExit((exitCode, signal) => {
    console.log(`🏁 PTY process exited with code ${exitCode}, signal ${signal}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\r\n\r\n🔴 Terminal session ended (exit code: ${exitCode})\r\n`);
      ws.close();
    }
    ptySessions.delete(sessionId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for session ${sessionId}:`, error);
  });
}

// Docker Terminal Handler (existing functionality)
function handleDockerTerminal(ws, req) {
  const sessionId = Date.now().toString();
  console.log(`🐳 Starting Docker terminal session ${sessionId}`);

  // Existing Docker terminal logic would go here
  // For now, send a message indicating Docker terminal
  ws.send('🐳 Docker terminal functionality available\r\n');

  ws.on('message', (data) => {
    ws.send(`Docker terminal received: ${data.toString()}\r\n`);
  });

  ws.on('close', () => {
    console.log(`🔌 Docker terminal session ${sessionId} closed`);
  });
}

// Cleanup handlers
process.on('SIGINT', async () => {
  console.log('\\n🛑 Shutting down enhanced terminal server...');

  // Kill all pty sessions
  for (const [sessionId, ptyProcess] of ptySessions) {
    console.log(`🔪 Killing PTY session ${sessionId}`);
    ptyProcess.kill();
  }

  // Kill all AI terminal sessions
  for (const [sessionId, ptyProcess] of aiTerminalSessions) {
    console.log(`🤖 Killing AI terminal session ${sessionId}`);
    ptyProcess.kill();
  }

  // Kill all compiler terminal sessions
  for (const [sessionId, ptyProcess] of compilerTerminalSessions) {
    console.log(`🔧 Killing compiler terminal session ${sessionId}`);
    ptyProcess.kill();
  }

  console.log('✅ Cleanup complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\\n🛑 Received SIGTERM, cleaning up...');

  // Kill all pty sessions
  for (const [sessionId, ptyProcess] of ptySessions) {
    ptyProcess.kill();
  }

  // Kill all AI terminal sessions
  for (const [sessionId, ptyProcess] of aiTerminalSessions) {
    ptyProcess.kill();
  }

  // Kill all compiler terminal sessions
  for (const [sessionId, ptyProcess] of compilerTerminalSessions) {
    ptyProcess.kill();
  }

  process.exit(0);
});

console.log('🖥️  Enhanced terminal server initialized');
console.log('📡 WebSocket endpoints:');
console.log('   - /terminal (PTY-based real-time terminal)');
console.log('   - / (Docker-based isolated terminals)');
console.log('🤖 AI Agent API endpoints:');
console.log('   - POST /api/terminal/ai-session (Create/get AI terminal session)');
console.log('   - POST /api/terminal/ai-execute (Execute command in AI session)');
console.log('   - GET  /api/terminal/ai-output/:sessionId (Get session output)');
console.log('   - GET  /api/terminal/ai-sessions (List all AI sessions)');
console.log('🔧 Compiler Terminal API endpoints:');
console.log('   - POST /api/terminal/compiler-session (Create/get compiler terminal session)');
console.log('   - POST /api/terminal/compiler-execute (Execute command in compiler session)');
console.log('   - GET  /api/terminal/compiler-output/:sessionId (Get compiler output)');
console.log('   - GET  /api/terminal/compiler-sessions (List all compiler sessions)');
console.log('🎯 Ready for terminal connections!');