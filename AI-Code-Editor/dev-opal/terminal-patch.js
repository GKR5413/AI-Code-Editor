// Terminal patch to add pty-based terminal endpoint
import pty from 'node-pty';

// Add this to the docker-terminal-server.js after the existing WebSocket setup

// Store pty sessions
const ptySessions = new Map();

// Add new WebSocket handler for direct terminal access
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  
  // Handle direct terminal connections on /terminal path
  if (url.pathname === '/terminal') {
    console.log('🖥️  New terminal connection established');
    
    // Spawn a new shell session
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: '/workspace', // Start in workspace directory
      env: process.env
    });
    
    const sessionId = Date.now().toString();
    ptySessions.set(sessionId, ptyProcess);
    
    // Send data from pty to WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });
    
    // Handle WebSocket messages (user input)
    ws.on('message', (data) => {
      try {
        const message = data.toString();
        ptyProcess.write(message);
      } catch (error) {
        console.error('Error writing to pty:', error);
      }
    });
    
    // Handle terminal resize
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'resize') {
          ptyProcess.resize(message.cols, message.rows);
        } else if (message.type === 'input') {
          ptyProcess.write(message.data);
        }
      } catch (error) {
        // If not JSON, treat as direct input
        ptyProcess.write(data.toString());
      }
    });
    
    // Cleanup on disconnect
    ws.on('close', () => {
      console.log('🔌 Terminal connection closed');
      if (ptyProcess) {
        ptyProcess.kill();
      }
      ptySessions.delete(sessionId);
    });
    
    // Handle pty exit
    ptyProcess.onExit(() => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
      ptySessions.delete(sessionId);
    });
    
    return; // Exit early for terminal connections
  }
  
  // Continue with existing Docker terminal logic...
});

export { ptySessions };