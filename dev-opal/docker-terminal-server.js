import express from 'express';
import { WebSocketServer } from 'ws';
import Docker from 'dockerode';
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
  res.json({ status: 'ok', message: 'Docker terminal server is running' });
});

// Reset rate limiting (for development)
app.post('/reset-rate-limit', (req, res) => {
  connectionAttempts.clear();
  console.log('🔄 Rate limiting reset');
  res.json({ status: 'ok', message: 'Rate limiting reset' });
});

// File system API for terminal workspaces
app.get('/workspace/:sessionId/files', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { path: filePath = '' } = req.query;
    
    const workspaceDir = path.join(process.cwd(), 'terminal-workspaces', sessionId);
    const targetPath = path.join(workspaceDir, filePath || '');
    
    // Security check: ensure path is within workspace
    if (!targetPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      const files = await fs.readdir(targetPath);
      const fileList = await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(targetPath, file);
          const stat = await fs.stat(fullPath);
          return {
            name: file,
            type: stat.isDirectory() ? 'folder' : 'file',
            path: path.relative(workspaceDir, fullPath),
            size: stat.size,
            modified: stat.mtime
          };
        })
      );
      res.json({ files: fileList });
    } else {
      res.json({ 
        name: path.basename(targetPath),
        type: 'file',
        path: path.relative(workspaceDir, targetPath),
        size: stats.size,
        modified: stats.mtime
      });
    }
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/workspace/:sessionId/content', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { path: filePath } = req.query;
    
    const workspaceDir = path.join(process.cwd(), 'terminal-workspaces', sessionId);
    const targetPath = path.join(workspaceDir, filePath || '');
    
    // Security check
    if (!targetPath.startsWith(workspaceDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const content = await fs.readFile(targetPath, 'utf8');
    res.json({ content });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/active-sessions', (req, res) => {
  const sessions = Array.from(connections.keys()).map(sessionId => ({
    sessionId,
    workspace: `/workspace (${sessionId})`,
    active: true
  }));
  res.json({ sessions });
});

const server = app.listen(3001, () => {
  console.log('🚀 Docker Terminal server running on port 3001');
  console.log(`📱 Platform: ${os.platform()}`);
  console.log('🐳 Using Docker containers for terminal isolation');
});

const wss = new WebSocketServer({ server });

// Store active connections and containers
const connections = new Map();
const containers = new Map();
const connectionAttempts = new Map();
const maxConnectionAttempts = 50; // Increased for development
const connectionCooldown = 5000; // 5 seconds

// Cleanup function for containers
const cleanupContainer = async (containerId) => {
  try {
    const container = docker.getContainer(containerId);
    await container.kill().catch(() => {}); // Ignore if already stopped
    await container.remove().catch(() => {}); // Ignore if already removed
    console.log(`🗑️  Cleaned up container ${containerId.substring(0, 12)}`);
  } catch (error) {
    console.error(`Error cleaning up container ${containerId}:`, error.message);
  }
};

// Create a new Docker container for terminal session
const createTerminalContainer = async (sessionId) => {
  try {
    console.log(`🐳 Creating container for session ${sessionId}`);
    
    // Create workspace directory if it doesn't exist
    const workspaceDir = path.join(process.cwd(), 'terminal-workspaces', sessionId);
    await fs.ensureDir(workspaceDir);
    console.log(`📁 Created workspace directory: ${workspaceDir}`);
    
    const container = await docker.createContainer({
      Image: 'ai-ide-terminal-container:latest',
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Env: [
        'TERM=xterm-256color',
        'COLORTERM=truecolor',
        `SESSION_ID=${sessionId}`
      ],
      WorkingDir: '/workspace',
      HostConfig: {
        Memory: 512 * 1024 * 1024, // 512MB limit
        CpuShares: 512, // CPU limit
        NetworkMode: 'bridge', // Allow network for file sharing
        ReadonlyRootfs: false,
        Binds: [
          `${process.cwd()}/terminal-workspaces/${sessionId}:/workspace:rw`
        ],
        Tmpfs: {
          '/tmp': 'rw,size=100m'
        }
      },
      Cmd: ['/bin/sleep', 'infinity'],
      User: 'root'
    });

    await container.start();
    console.log(`✅ Container ${container.id.substring(0, 12)} started for session ${sessionId}`);
    
    return container;
  } catch (error) {
    console.error(`Error creating container for session ${sessionId}:`, error.message);
    throw error;
  }
};

wss.on('connection', async (ws, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  const sessionId = Date.now().toString();
  
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
  
  console.log(`🔌 New Docker terminal connection ${sessionId} from ${clientIp}`);
  
  let container = null;
  let stream = null;
  
  try {
    // Create Docker container for this session
    container = await createTerminalContainer(sessionId);
    containers.set(sessionId, container.id);
    
    // Create exec instance for cleaner terminal interaction
    const exec = await container.exec({
      Cmd: ['/bin/bash'],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true
    });
    
    stream = await exec.start({
      hijack: true,
      stdin: true
    });
    
    // Store connection info
    connections.set(sessionId, { 
      ws, 
      container,
      stream,
      clientIp,
      createdAt: new Date()
    });
    
    // Send simple connection confirmation
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId: sessionId,
          message: 'Docker terminal connected successfully!',
          workspace: `/workspace (isolated container)`
        }));
      }
    }, 100);
    
    // Handle container output
    stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        // For TTY containers with hijack, data comes directly without Docker headers
        const output = chunk.toString();
        ws.send(JSON.stringify({
          type: 'output',
          data: output
        }));
      }
    });
    
    // Handle stream errors
    stream.on('error', (error) => {
      console.error(`Stream error for session ${sessionId}:`, error.message);
    });
    
    stream.on('end', () => {
      console.log(`Stream ended for session ${sessionId}`);
    });
    
    // Handle WebSocket messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'input':
            console.log(`📝 Received input for session ${sessionId}:`, JSON.stringify(data.data));
            if (stream && stream.writable) {
              // Send input to container (don't add newline automatically)
              stream.write(data.data);
            }
            break;
            
          case 'resize':
            if (container) {
              try {
                await container.resize({
                  h: data.rows || 24,
                  w: data.cols || 80
                });
              } catch (error) {
                console.log('Resize error (non-critical):', error.message);
              }
            }
            break;
            
          case 'clear':
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'clear'
              }));
            }
            break;
            
          case 'ping':
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now()
              }));
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
  } catch (error) {
    console.error(`Error setting up container for session ${sessionId}:`, error.message);
    
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to create terminal container. Please try again.'
      }));
    }
    
    // Cleanup on error
    if (container) {
      await cleanupContainer(container.id);
    }
  }
  
  // Handle WebSocket close
  ws.on('close', async () => {
    console.log(`🔌 Docker terminal connection ${sessionId} closed`);
    
    // Cleanup container and resources
    if (container) {
      await cleanupContainer(container.id);
    }
    
    if (stream) {
      stream.destroy();
    }
    
    connections.delete(sessionId);
    containers.delete(sessionId);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error.message);
  });
});

// Cleanup on server shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Docker terminal server...');
  
  // Cleanup all containers
  const cleanupPromises = Array.from(containers.values()).map(containerId => 
    cleanupContainer(containerId)
  );
  
  await Promise.all(cleanupPromises);
  
  console.log('✅ All containers cleaned up');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  
  // Cleanup all containers
  const cleanupPromises = Array.from(containers.values()).map(containerId => 
    cleanupContainer(containerId)
  );
  
  await Promise.all(cleanupPromises);
  
  process.exit(0);
});

// Periodic cleanup of orphaned containers (safety measure)
setInterval(async () => {
  try {
    const allContainers = await docker.listContainers({ all: true });
    const ourContainers = allContainers.filter(c => 
      c.Image === 'ai-ide-terminal-container:latest' && 
      c.State === 'exited'
    );
    
    for (const containerInfo of ourContainers) {
      await cleanupContainer(containerInfo.Id);
    }
  } catch (error) {
    console.error('Error during periodic cleanup:', error.message);
  }
}, 5 * 60 * 1000); // Every 5 minutes

console.log('🐳 Docker terminal server initialized');
console.log('📁 Using tmpfs for workspaces (no host file sharing required)');