import express from 'express';
import { WebSocketServer } from 'ws';
import { exec, spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

const server = app.listen(3006, () => {
  console.log('🚀 Terminal server running on port 3006');
  console.log(`📱 Platform: ${os.platform()}`);
  console.log(`🐚 Shell: ${os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash'}`);
  console.log(`🏠 Home directory: ${process.env.HOME || process.cwd()}`);
});

const wss = new WebSocketServer({ server });

// Store active connections with connection tracking
const connections = new Map();
const connectionAttempts = new Map();
const maxConnectionAttempts = 10;
const connectionCooldown = 1000; // 1 second

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Terminal server is running' });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  const connectionId = Date.now().toString();
  
  // Check connection rate limiting
  const attempts = connectionAttempts.get(clientIp) || 0;
  if (attempts >= maxConnectionAttempts) {
    console.log(`🚫 Rate limited connection from ${clientIp} (${attempts} attempts)`);
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
  
  // Increment connection attempts
  connectionAttempts.set(clientIp, attempts + 1);
  
  // Reset attempts after cooldown
  setTimeout(() => {
    const currentAttempts = connectionAttempts.get(clientIp) || 0;
    if (currentAttempts > 0) {
      connectionAttempts.set(clientIp, Math.max(0, currentAttempts - 1));
    }
  }, connectionCooldown);
  
  console.log(`🔌 New terminal connection ${connectionId} from ${clientIp}`);
  
  // Initialize connection with working directory tracking
  const initialCwd = process.env.HOME || process.cwd();
  connections.set(connectionId, { 
    ws, 
    history: [], 
    clientIp,
    currentWorkingDir: initialCwd,
    inputBuffer: '', // Add input buffer for line buffering
    dockerWorkingDir: '/app/workspace', // Track Docker container working directory
    interactiveMode: false, // Track if we're in interactive mode
    activeProcess: null // Track active Docker process
  });
  
  // Send initial message after a small delay to ensure connection is ready
  setTimeout(() => {
    try {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'connected',
          connectionId: connectionId,
          shell: os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash'
        }));
        
        // Send initial prompt
        ws.send(JSON.stringify({
          type: 'output',
          data: `developer@container:/app/workspace$ `
        }));
      }
    } catch (error) {
      console.error('Error sending initial message:', error);
    }
  }, 100); // 100ms delay

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.type) {
        case 'input':
          // Handle input character by character, buffer until Enter
          console.log('📨 Received input:', JSON.stringify(msg.data));
          handleInput(connectionId, msg.data);
          break;
          
        case 'clear':
          // Clear terminal
          ws.send(JSON.stringify({
            type: 'clear'
          }));
          // Send new prompt with current directory
          const connection = connections.get(connectionId);
          if (connection) {
            const shortPath = connection.currentWorkingDir.replace(process.env.HOME || '', '~');
            ws.send(JSON.stringify({
              type: 'output',
              data: `${shortPath} $ `
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'output',
              data: `$ `
            }));
          }
          break;
          
        case 'execute':
          // Execute a specific command
          if (msg.command) {
            handleCommand(connectionId, msg.command);
          }
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle connection close
  ws.on('close', (code, reason) => {
    console.log(`🔌 Terminal connection ${connectionId} closed (${code}: ${reason})`);
    
    // Clean up active process if any
    const connection = connections.get(connectionId);
    if (connection && connection.activeProcess) {
      console.log('🧹 Cleaning up active process');
      connection.activeProcess.kill('SIGTERM');
    }
    
    connections.delete(connectionId);
  });

  // Handle connection errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for connection ${connectionId}:`, error);
  });
  
  // Handle pong (keep-alive)
  ws.on('pong', () => {
    // Client is alive
  });
});

// Helper function to generate prompt with current directory
function getPrompt(currentWorkingDir) {
  const shortPath = currentWorkingDir.replace(process.env.HOME || '', '~');
  return `${shortPath} $ `;
}

// Handle input buffering - accumulate keystrokes until Enter is pressed
function handleInput(connectionId, data) {
  const connection = connections.get(connectionId);
  if (!connection || !connection.ws || connection.ws.readyState !== 1) {
    return;
  }

  // If we're in interactive mode, forward input directly to the active process
  if (connection.interactiveMode && connection.activeProcess) {
    console.log('📨 Forwarding to interactive process:', JSON.stringify(data));
    if (connection.activeProcess.stdin && connection.activeProcess.stdin.writable) {
      connection.activeProcess.stdin.write(data);
    }
    return;
  }

  const { ws, inputBuffer } = connection;
  
  // Handle special keys
  if (data === '\r' || data === '\n') {
    // Enter pressed - execute the buffered command
    const command = connection.inputBuffer;
    connection.inputBuffer = ''; // Clear buffer
    
    // Execute the command (no echo needed, client handles display)
    console.log('⚡ Executing buffered command:', JSON.stringify(command));
    handleCommand(connectionId, command);
    return;
  }
  
  if (data === '\u007f' || data === '\b') {
    // Backspace - remove last character from buffer (client handles display)
    if (connection.inputBuffer.length > 0) {
      connection.inputBuffer = connection.inputBuffer.slice(0, -1);
    }
    return;
  }
  
  // Regular character - add to buffer (no echo needed, client handles display)
  if (data.length === 1 && data >= ' ') {
    connection.inputBuffer += data;
  }
}

// Handle interactive commands with persistent Docker shell
function handleInteractiveCommand(connectionId, command) {
  const connection = connections.get(connectionId);
  if (!connection || !connection.ws || connection.ws.readyState !== 1) {
    return;
  }

  const { ws } = connection;
  const workingDir = connection.dockerWorkingDir || '/app/workspace';

  console.log('🔄 Starting interactive command:', command);

  // Switch to interactive mode
  connection.interactiveMode = true;

  // Use script command to create a proper PTY session
  const dockerProcess = spawn('docker', [
    'exec', '-i',
    '-e', 'TERM=xterm-256color',
    '-e', 'COLORTERM=truecolor',
    'dev-opal-compiler-1',
    'script', '-qec', `cd ${workingDir} && ${command}`, '/dev/null'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Store the active process
  connection.activeProcess = dockerProcess;

  // Handle process output
  dockerProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📤 Interactive output:', JSON.stringify(output));
    
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        data: output
      }));
    }
  });

  dockerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('📤 Interactive stderr:', JSON.stringify(output));
    
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        data: output
      }));
    }
  });

  // Handle process exit
  dockerProcess.on('close', (code) => {
    console.log('🏁 Interactive process exited with code:', code);
    connection.interactiveMode = false;
    connection.activeProcess = null;
    
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        data: '\r\n'
      }));
    }
  });

  dockerProcess.on('error', (error) => {
    console.error('❌ Interactive process error:', error);
    connection.interactiveMode = false;
    connection.activeProcess = null;
    
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'output',
        data: `Error: ${error.message}\r\n`
      }));
    }
  });
}

// Handle command execution
function handleCommand(connectionId, command) {
  console.log('🔥 handleCommand called with:', JSON.stringify(command));
  const connection = connections.get(connectionId);
  if (!connection || !connection.ws || connection.ws.readyState !== 1) {
    console.log('❌ Connection not found or not ready');
    return;
  }

  const { ws, history, currentWorkingDir } = connection;
  
  // Clean and validate command
  const cleanCommand = command.trim();
  console.log('🧹 Cleaned command:', JSON.stringify(cleanCommand));
  
  // Skip empty commands
  if (!cleanCommand) {
    console.log('⚠️ Empty command, skipping');
    ws.send(JSON.stringify({
      type: 'output',
      data: getPrompt(currentWorkingDir)
    }));
    return;
  }
  
  // Add command to history
  history.push(cleanCommand);
  if (history.length > 100) history.shift(); // Keep last 100 commands

  // Handle clear command - send clear signal to client
  if (cleanCommand === 'clear') {
    ws.send(JSON.stringify({
      type: 'clear'
    }));
    return;
  }

  // Handle cd command for Docker container navigation
  if (cleanCommand.startsWith('cd ')) {
    const newPath = cleanCommand.substring(3).trim();
    
    // Initialize Docker working directory if not set
    if (!connection.dockerWorkingDir) {
      connection.dockerWorkingDir = '/app/workspace';
    }
    
    let targetPath;
    
    if (newPath === '..') {
      // Go up one directory
      targetPath = path.posix.dirname(connection.dockerWorkingDir);
      // Don't go above /app/workspace
      if (!targetPath.startsWith('/app/workspace')) {
        targetPath = '/app/workspace';
      }
    } else if (newPath === '~' || newPath === '') {
      // Go to workspace root
      targetPath = '/app/workspace';
    } else if (newPath.startsWith('/')) {
      // Absolute path - but keep within workspace
      if (newPath.startsWith('/app/workspace')) {
        targetPath = newPath;
      } else {
        targetPath = '/app/workspace' + newPath;
      }
    } else {
      // Relative path
      targetPath = path.posix.join(connection.dockerWorkingDir, newPath);
    }
    
    // Check if directory exists in Docker container
    const checkDirCommand = `docker exec dev-opal-compiler-1 test -d "${targetPath}"`;
    exec(checkDirCommand, (error, stdout, stderr) => {
      if (error) {
        // Directory doesn't exist
        ws.send(JSON.stringify({
          type: 'output',
          data: `Error: Directory '${newPath}' does not exist`
        }));
      } else {
        // Directory exists, update working directory
        connection.dockerWorkingDir = targetPath;
        // No output for successful cd (like real bash)
      }
    });
    return;
  }
  
  // Check if this is an interactive command that needs real-time input
  const interactiveCommands = ['python', 'python3', 'node', 'nano', 'vi', 'vim', 'less', 'more', 'top', 'htop'];
  const isInteractiveCommand = interactiveCommands.some(cmd => 
    cleanCommand.startsWith(cmd + ' ') || cleanCommand === cmd
  );

  if (isInteractiveCommand) {
    // Handle interactive commands with persistent shell
    handleInteractiveCommand(connectionId, cleanCommand);
    return;
  }

  // Let all commands go through Docker execution (removed pwd special handler)

  // Execute the command inside the Docker container
  // Use tracked working directory or default to /app/workspace
  const workingDir = connection.dockerWorkingDir || '/app/workspace';
  const dockerCommand = `docker exec -i -e TERM=xterm-256color -e COLORTERM=truecolor dev-opal-compiler-1 bash -c "cd ${workingDir} && ${cleanCommand.replace(/"/g, '\\"')}"`;
  console.log('🐳 Executing Docker command:', dockerCommand);
  exec(dockerCommand, { 
    cwd: currentWorkingDir,
    env: {
      ...process.env,
      SHELL: '/bin/bash',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      COLUMNS: '80',
      LINES: '24'
    },
    timeout: 30000 // 30 second timeout
  }, (error, stdout, stderr) => {
    try {
      if (error) {
        // Send error output
        ws.send(JSON.stringify({
          type: 'output',
          data: `Error: ${error.message}\r\n`
        }));
      }
      
      if (stderr) {
        // Send stderr output with proper formatting
        let formattedStderr = stderr;
        if (!formattedStderr.endsWith('\n')) {
          formattedStderr += '\n';
        }
        ws.send(JSON.stringify({
          type: 'output',
          data: formattedStderr
        }));
      }
      
      if (stdout) {
        // Clean up output and preserve formatting
        let formattedOutput = stdout.toString().trim();
        
        if (formattedOutput) {
          // Send stdout output
          ws.send(JSON.stringify({
            type: 'output',
            data: formattedOutput
          }));
        }
      }
      
      // Send new prompt
      ws.send(JSON.stringify({
        type: 'output',
        data: 'developer@container:/app/workspace$ '
      }));
      
    } catch (wsError) {
      console.error('Error sending command output:', wsError);
    }
  });
}

// File system API endpoints
app.get('/api/files', (req, res) => {
  const { path: dirPath = '.' } = req.query;
  
  try {
    const fullPath = path.resolve(dirPath);
    
    // For the main files endpoint, restrict to project root for security
    const projectRoot = process.cwd();
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    const items = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = items.map(item => {
      const itemPath = path.join(fullPath, item.name);
      const relativePath = path.relative(projectRoot, itemPath);
      
      return {
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        path: relativePath,
        fullPath: itemPath,
        size: item.isFile() ? fs.statSync(itemPath).size : 0,
        modified: fs.statSync(itemPath).mtime,
        hidden: item.name.startsWith('.')
      };
    });
    
    // Sort: folders first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    res.json({ 
      path: dirPath,
      fullPath,
      relativePath: path.relative(projectRoot, fullPath),
      files 
    });
    
  } catch (error) {
    console.error('Error reading directory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/file-content', (req, res) => {
  const { path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  try {
    const fullPath = path.resolve(filePath);
    const projectRoot = process.cwd();
    
    // Security check
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const relativePath = path.relative(projectRoot, fullPath);
    
    res.json({
      path: filePath,
      fullPath,
      relativePath,
      content,
      size: stats.size,
      modified: stats.mtime
    });
    
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/save-file', express.json(), (req, res) => {
  const { path: filePath, content } = req.body;
  
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }
  
  if (content === undefined) {
    return res.status(400).json({ error: 'File content is required' });
  }
  
  try {
    const fullPath = path.resolve(filePath);
    const projectRoot = process.cwd();
    
    // Security check
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save the file
    fs.writeFileSync(fullPath, content, 'utf8');
    
    const stats = fs.statSync(fullPath);
    const relativePath = path.relative(projectRoot, fullPath);
    
    console.log(`📁 File saved: ${relativePath}`);
    
    res.json({
      success: true,
      path: filePath,
      fullPath,
      relativePath,
      size: stats.size,
      modified: stats.mtime,
      message: 'File saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connections: connections.size,
    platform: os.platform(),
    shell: os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash',
    uptime: process.uptime(),
    rateLimited: Array.from(connectionAttempts.entries()).filter(([_, attempts]) => attempts >= maxConnectionAttempts).length
  });
});

// Terminal workspace API endpoints for file explorer integration
app.get('/api/workspace/files', async (req, res) => {
  try {
    const path = req.query.path || '';
    const basePath = '/app/workspace';
    const fullPath = path ? `${basePath}/${path}` : basePath;
    
    const command = `docker exec dev-opal-compiler-1 bash -c "cd '${fullPath}' && find . -maxdepth 1 \\( -type f -o -type d \\) | grep -v '^\\.$' | sort"`;
    
    // exec is already imported at the top
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error listing workspace files:', error);
        return res.status(500).json({ error: 'Failed to list files' });
      }
      
      const entries = stdout.split('\n').filter(line => line.trim()).map(entry => {
        const name = entry.replace('./', '');
        const entryPath = path ? `${path}/${name}` : name;
        
        return {
          name,
          path: entryPath,
          id: entryPath
        };
      });
      
      // Get detailed info for each entry
      Promise.all(entries.map(entry => 
        new Promise((resolve) => {
          const statCommand = `docker exec dev-opal-compiler-1 stat -c "%F" "${basePath}/${entry.path}"`;
          exec(statCommand, (error, stdout) => {
            if (error) {
              resolve({ ...entry, type: 'file' });
            } else {
              const fileType = stdout.trim();
              resolve({
                ...entry,
                type: fileType.includes('directory') ? 'folder' : 'file'
              });
            }
          });
        })
      )).then(detailedFiles => {
        res.json({ files: detailedFiles });
      });
    });
  } catch (error) {
    console.error('Error in workspace files endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/workspace/content', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const command = `docker exec dev-opal-compiler-1 cat "/app/workspace/${filePath}"`;
    // exec is already imported at the top
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error reading file:', error);
        return res.status(404).json({ error: 'File not found or cannot be read' });
      }
      
      res.json({ content: stdout });
    });
  } catch (error) {
    console.error('Error in workspace content endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test command execution endpoint
app.post('/execute', express.json(), (req, res) => {
  const { command } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  exec(command, { 
    cwd: process.env.HOME || process.cwd(),
    env: {
      ...process.env,
      SHELL: '/bin/bash',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    },
    timeout: 30000
  }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message, stderr });
    }
    
    res.json({ 
      success: true, 
      stdout: stdout.toString(),
      stderr: stderr.toString()
    });
  });
});

// --- File System API Endpoints ---

const CWD = process.cwd(); // Store the current working directory at startup

// Helper function to resolve paths safely
const resolvePath = (userPath) => {
  const resolved = path.resolve(CWD, userPath);
  if (!resolved.startsWith(CWD)) {
    throw new Error('Access denied.');
  }
  return resolved;
};

// Endpoint to create a new file or folder
app.post('/api/files/create', express.json(), async (req, res) => {
  const { path: newPath, type } = req.body;
  try {
    const fullPath = resolvePath(newPath);
    if (type === 'folder') {
      await fs.mkdir(fullPath);
      res.status(201).json({ success: true, message: `Folder created at ${newPath}` });
    } else {
      await fs.createFile(fullPath);
      res.status(201).json({ success: true, message: `File created at ${newPath}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to rename a file or folder
app.put('/api/files/rename', express.json(), async (req, res) => {
  const { oldPath, newPath } = req.body;
  try {
    const fullOldPath = resolvePath(oldPath);
    const fullNewPath = resolvePath(newPath);
    await fs.rename(fullOldPath, fullNewPath);
    res.json({ success: true, message: `Renamed from ${oldPath} to ${newPath}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to delete a file or folder
app.delete('/api/files/delete', express.json(), async (req, res) => {
  const { path: targetPath } = req.body;
  try {
    const fullPath = resolvePath(targetPath);
    await fs.remove(fullPath); // fs-extra's remove works for both files and directories
    res.json({ success: true, message: `Deleted ${targetPath}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to move a file or folder
app.post('/api/files/move', express.json(), async (req, res) => {
  const { source, destination } = req.body;
  try {
    const fullSource = resolvePath(source);
    const fullDestination = resolvePath(destination);
    await fs.move(fullSource, fullDestination);
    res.json({ success: true, message: `Moved from ${source} to ${destination}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// System directory browsing endpoint (for folder picker)
app.get('/api/browse', (req, res) => {
  const { path: dirPath = process.env.HOME } = req.query;
  
  try {
    let fullPath;
    
    // Handle different path formats
    if (dirPath === '' || dirPath === '~') {
      fullPath = process.env.HOME || '/';
    } else if (dirPath.startsWith('~')) {
      fullPath = path.join(process.env.HOME || '/', dirPath.slice(1));
    } else {
      fullPath = path.resolve(dirPath);
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    const items = fs.readdirSync(fullPath, { withFileTypes: true });
    
    // Only return directories for folder picker
    const directories = items
      .filter(item => item.isDirectory())
      .filter(item => !item.name.startsWith('.')) // Hide hidden folders by default
      .map(item => {
        const itemPath = path.join(fullPath, item.name);
        
        return {
          name: item.name,
          path: itemPath,
          fullPath: itemPath,
          relativePath: itemPath,
          type: 'folder'
        };
      });
    
    // Sort alphabetically
    directories.sort((a, b) => a.name.localeCompare(b.name));
    
    // Add parent directory option if not at root
    const parentPath = path.dirname(fullPath);
    if (parentPath !== fullPath && parentPath !== '/') {
      directories.unshift({
        name: '..',
        path: parentPath,
        fullPath: parentPath,
        relativePath: parentPath,
        type: 'folder'
      });
    }
    
    res.json({
      currentPath: fullPath,
      directories
    });
    
  } catch (error) {
    console.error('Error browsing directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change working directory endpoint
app.post('/api/change-directory', express.json(), (req, res) => {
  const { path: newPath } = req.body;
  
  if (!newPath) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    const fullPath = path.resolve(newPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    // Change the working directory of the server process
    process.chdir(fullPath);
    
    console.log(`📁 Working directory changed to: ${fullPath}`);
    
    res.json({
      success: true,
      path: fullPath,
      message: 'Working directory changed successfully'
    });
    
  } catch (error) {
    console.error('Error changing directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down terminal server...');
  // Close all connections
  for (const [id, { ws }] of connections) {
    console.log(`🔌 Closing connection ${id}`);
    if (ws && ws.readyState === 1) {
      ws.close();
    }
  }
  connections.clear();
  server.close(() => {
    console.log('✅ Terminal server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM, shutting down...');
  for (const [id, { ws }] of connections) {
    if (ws && ws.readyState === 1) {
      ws.close();
    }
  }
  connections.clear();
  server.close(() => {
    console.log('✅ Terminal server stopped');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  // Don't exit immediately, try to clean up
  for (const [id, { ws }] of connections) {
    if (ws && ws.readyState === 1) {
      ws.close();
    }
  }
  connections.clear();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
