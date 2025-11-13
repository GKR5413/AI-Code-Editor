const { createServer } = require('@grpc/grpc-js');
const { loadPackageDefinition } = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');
const pty = require('node-pty');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, 'proto/terminal.proto');
const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const terminalProto = loadPackageDefinition(packageDefinition);

// Terminal session management
const terminalSessions = new Map();
const sessionOutputBuffers = new Map();

class TerminalService {
  // Create a new terminal session
  createSession(call, callback) {
    try {
      const { session_id, shell, working_directory, environment, cols, rows } = call.request;
      
      if (terminalSessions.has(session_id)) {
        return callback(null, {
          success: false,
          session_id,
          message: 'Session already exists'
        });
      }

      const shellCmd = shell || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
      const workingDir = working_directory || path.join(process.cwd(), 'workspace');
      const colsNum = cols || 100;
      const rowsNum = rows || 30;

      console.log(`🤖 Creating new gRPC terminal session: ${session_id}`);
      
      const ptyProcess = pty.spawn(shellCmd, [], {
        name: 'xterm-color',
        cols: colsNum,
        rows: rowsNum,
        cwd: workingDir,
        env: {
          ...process.env,
          ...environment,
          TERM: 'xterm-color',
          COLORTERM: 'truecolor',
          AI_SESSION: 'true'
        }
      });

      terminalSessions.set(session_id, ptyProcess);
      sessionOutputBuffers.set(session_id, []);

      // Buffer output for AI agent to read
      ptyProcess.onData((data) => {
        const buffer = sessionOutputBuffers.get(session_id) || [];
        buffer.push({
          timestamp: Date.now(),
          data: data
        });
        
        // Keep only last 100 output chunks to prevent memory issues
        if (buffer.length > 100) {
          buffer.shift();
        }
        
        sessionOutputBuffers.set(session_id, buffer);
      });

      // Handle process exit
      ptyProcess.onExit((exitCode, signal) => {
        console.log(`🤖 gRPC terminal session ${session_id} exited: code ${exitCode}, signal ${signal}`);
        terminalSessions.delete(session_id);
        sessionOutputBuffers.delete(session_id);
      });

      callback(null, {
        success: true,
        session_id,
        message: 'Terminal session created successfully'
      });

    } catch (error) {
      console.error('❌ Error creating gRPC terminal session:', error);
      callback({
        code: 13, // INTERNAL
        message: `Failed to create session: ${error.message}`
      });
    }
  }

  // Execute a command in the terminal
  executeCommand(call, callback) {
    try {
      const { session_id, command, working_directory, environment } = call.request;
      
      if (!terminalSessions.has(session_id)) {
        return callback({
          code: 5, // NOT_FOUND
          message: 'Terminal session not found'
        });
      }

      const ptyProcess = terminalSessions.get(session_id);
      
      if (working_directory) {
        ptyProcess.write(`cd "${working_directory}"\n`);
      }
      
      if (environment && Object.keys(environment).length > 0) {
        const envVars = Object.entries(environment)
          .map(([key, value]) => `export ${key}="${value}"`)
          .join(' && ');
        ptyProcess.write(`${envVars} && `);
      }
      
      ptyProcess.write(`${command}\n`);

      // Wait a bit for command to execute and collect output
      setTimeout(() => {
        const buffer = sessionOutputBuffers.get(session_id) || [];
        const output = buffer.map(chunk => chunk.data).join('');
        
        callback(null, {
          success: true,
          output: output,
          error: '',
          exit_code: 0,
          session_id
        });
      }, 1000);

    } catch (error) {
      console.error('❌ Error executing command:', error);
      callback({
        code: 13, // INTERNAL
        message: `Failed to execute command: ${error.message}`
      });
    }
  }

  // Get terminal output
  getOutput(call, callback) {
    try {
      const { session_id, max_lines } = call.request;
      
      if (!terminalSessions.has(session_id)) {
        return callback({
          code: 5, // NOT_FOUND
          message: 'Terminal session not found'
        });
      }

      const buffer = sessionOutputBuffers.get(session_id) || [];
      const lines = buffer.map(chunk => chunk.data).join('').split('\n');
      
      const maxLines = max_lines || 50;
      const outputLines = lines.slice(-maxLines);

      callback(null, {
        lines: outputLines,
        has_more: lines.length > maxLines,
        session_id
      });

    } catch (error) {
      console.error('❌ Error getting output:', error);
      callback({
        code: 13, // INTERNAL
        message: `Failed to get output: ${error.message}`
      });
    }
  }

  // Stream real-time terminal output
  streamOutput(call) {
    try {
      const { session_id, follow } = call.request;
      
      if (!terminalSessions.has(session_id)) {
        call.emit('error', {
          code: 5, // NOT_FOUND
          message: 'Terminal session not found'
        });
        return;
      }

      const ptyProcess = terminalSessions.get(session_id);
      
      // Send initial buffer
      const buffer = sessionOutputBuffers.get(session_id) || [];
      buffer.forEach(chunk => {
        call.write({
          data: chunk.data,
          session_id,
          timestamp: chunk.timestamp,
          is_error: false
        });
      });

      if (follow) {
        // Listen for new data
        const dataHandler = (data) => {
          call.write({
            data: data,
            session_id,
            timestamp: Date.now(),
            is_error: false
          });
        };

        ptyProcess.onData(dataHandler);
        
        // Clean up when stream ends
        call.on('cancelled', () => {
          ptyProcess.removeListener('data', dataHandler);
        });
      }

    } catch (error) {
      console.error('❌ Error streaming output:', error);
      call.emit('error', {
        code: 13, // INTERNAL
        message: `Failed to stream output: ${error.message}`
      });
    }
  }

  // List active terminal sessions
  listSessions(call, callback) {
    try {
      const sessions = Array.from(terminalSessions.entries()).map(([sessionId, ptyProcess]) => {
        const buffer = sessionOutputBuffers.get(sessionId) || [];
        return {
          session_id: sessionId,
          shell: ptyProcess.process || 'unknown',
          working_directory: ptyProcess.cwd || process.cwd(),
          cols: ptyProcess.cols || 100,
          rows: ptyProcess.rows || 30,
          is_active: !ptyProcess.killed,
          created_at: Date.now()
        };
      });

      callback(null, { sessions });

    } catch (error) {
      console.error('❌ Error listing sessions:', error);
      callback({
        code: 13, // INTERNAL
        message: `Failed to list sessions: ${error.message}`
      });
    }
  }

  // Kill a terminal session
  killSession(call, callback) {
    try {
      const { session_id } = call.request;
      
      if (!terminalSessions.has(session_id)) {
        return callback({
          code: 5, // NOT_FOUND
          message: 'Terminal session not found'
        });
      }

      const ptyProcess = terminalSessions.get(session_id);
      ptyProcess.kill();
      
      terminalSessions.delete(session_id);
      sessionOutputBuffers.delete(session_id);

      callback(null, {
        success: true,
        message: 'Session killed successfully'
      });

    } catch (error) {
      console.error('❌ Error killing session:', error);
      callback({
        code: 13, // INTERNAL
        message: `Failed to kill session: ${error.message}`
      });
    }
  }
}

// Create and start the gRPC server
const server = createServer();

server.addService(terminalProto.terminal.TerminalService.service, new TerminalService());

const GRPC_PORT = process.env.GRPC_PORT || 50051;
server.bindAsync(`0.0.0.0:${GRPC_PORT}`, () => {
  console.log(`🚀 gRPC Terminal Server listening on port ${GRPC_PORT}`);
  server.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gRPC Terminal Server...');
  
  // Kill all active sessions
  for (const [sessionId, ptyProcess] of terminalSessions.entries()) {
    console.log(`Killing session: ${sessionId}`);
    ptyProcess.kill();
  }
  
  server.tryShutdown(() => {
    console.log('✅ gRPC Terminal Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gRPC Terminal Server...');
  
  // Kill all active sessions
  for (const [sessionId, ptyProcess] of terminalSessions.entries()) {
    console.log(`Killing session: ${sessionId}`);
    ptyProcess.kill();
  }
  
  server.tryShutdown(() => {
    console.log('✅ gRPC Terminal Server shutdown complete');
    process.exit(0);
  });
});
