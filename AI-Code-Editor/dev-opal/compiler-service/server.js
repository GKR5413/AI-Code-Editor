// require('dotenv').config(); // Removed dependency
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const app = express();
app.use(cors());
app.use(express.json());

// --- Security Configuration ---
// Confine all file operations to the /workspace directory
const WORKSPACE_DIR = process.env.WORKSPACE_PATH || '/workspace';
console.log(`File service sandboxed to: ${WORKSPACE_DIR}`);

// --- gRPC Terminal Client Setup ---
const TERMINAL_PROTO_PATH = path.join(__dirname, 'proto/terminal.proto');
let terminalClient = null;

// Initialize gRPC client
try {
  const packageDefinition = protoLoader.loadSync(TERMINAL_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const terminalProto = grpc.loadPackageDefinition(packageDefinition);
      terminalClient = new terminalProto.terminal.TerminalService(
      'grpc-terminal:50051',
      grpc.credentials.createInsecure()
    );

  console.log('✅ gRPC Terminal client initialized');
} catch (error) {
  console.error('❌ Failed to initialize gRPC Terminal client:', error.message);
}

/**
 * Safely resolves a user-provided path against the workspace directory.
 * Throws an error if the path attempts to escape the sandbox.
 * @param {string} userPath - The path provided in the API request.
 * @returns {string} The absolute, verified path.
 */
function getSafePath(userPath) {
  if (typeof userPath !== 'string') {
    throw new Error('Invalid path provided.');
  }
  const safePath = path.join(WORKSPACE_DIR, userPath);
  if (!safePath.startsWith(WORKSPACE_DIR)) {
    throw new Error('Path traversal detected. Access denied.');
  }
  return safePath;
}

// --- API Endpoint ---
app.post('/workspace/files', async (req, res) => {
  const { action, path: userPath, content } = req.body;

  if (!action || !userPath) {
    return res.status(400).json({ error: 'The action and path fields are required.' });
  }

  try {
    const safePath = getSafePath(userPath);

    switch (action) {
      case 'list': {
        const files = await fs.readdir(safePath, { withFileTypes: true });
        const fileList = files.map(file => {
          const filePath = path.join(userPath, file.name).replace(/\\/g, '/');
          return {
            name: file.name,
            type: file.isDirectory() ? 'directory' : 'file',
            size: 0, // Size will be calculated if needed
            path: filePath,
            modified: new Date().toISOString()
          };
        });
        return res.json({ success: true, files: fileList });
      }

      case 'read': {
        const fileContent = await fs.readFile(safePath, 'utf-8');
        return res.json({ success: true, content: fileContent });
      }

      case 'write': {
        if (typeof content !== 'string') {
          return res.status(400).json({ success: false, error: 'The content field is required for the write action.' });
        }
        await fs.mkdir(path.dirname(safePath), { recursive: true });
        await fs.writeFile(safePath, content);
        return res.json({ success: true, message: `File '${userPath}' saved successfully.` });
      }

      case 'mkdir': {
        await fs.mkdir(safePath, { recursive: true });
        return res.json({ success: true, message: `Directory '${userPath}' created successfully.` });
      }

      case 'delete': {
        const stats = await fs.stat(safePath);
        if (stats.isDirectory()) {
          await fs.rmdir(safePath, { recursive: true });
        } else {
          await fs.unlink(safePath);
        }
        return res.json({ success: true, message: `Item '${userPath}' deleted successfully.` });
      }

      default: {
        return res.status(400).json({ success: false, error: `Unknown action: '${action}'` });
      }
    }
  } catch (error) {
    console.error(`Operation '${action}' on path '${userPath}' failed:`, error);
    // Avoid leaking internal path details in the error message
    if (error.code === 'ENOENT') {
        return res.status(404).json({ success: false, error: `Path not found: '${userPath}'` });
    }
    return res.status(500).json({ success: false, error: `An internal error occurred: ${error.message}` });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Compiler service is running' });
});

// --- Terminal HTTP-to-gRPC Bridge Endpoints ---

// Create terminal session
app.post('/terminal/session', (req, res) => {
  if (!terminalClient) {
    return res.status(503).json({ success: false, error: 'Terminal gRPC client not available' });
  }

  const { session_id, shell, working_directory, environment, cols, rows } = req.body;

  terminalClient.createSession({
    session_id: session_id || `session_${Date.now()}`,
    shell: shell || 'bash',
    working_directory: working_directory || '/workspace',
    environment: environment || {},
    cols: cols || 100,
    rows: rows || 30
  }, (error, response) => {
    if (error) {
      console.error('gRPC Terminal createSession error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json(response);
  });
});

// Execute command
app.post('/terminal/execute', (req, res) => {
  if (!terminalClient) {
    return res.status(503).json({ success: false, error: 'Terminal gRPC client not available' });
  }

  const { session_id, command, working_directory, environment } = req.body;

  if (!session_id || !command) {
    return res.status(400).json({ success: false, error: 'session_id and command are required' });
  }

  terminalClient.executeCommand({
    session_id,
    command,
    working_directory,
    environment
  }, (error, response) => {
    if (error) {
      console.error('gRPC Terminal executeCommand error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json(response);
  });
});

// Get terminal output
app.post('/terminal/output', (req, res) => {
  if (!terminalClient) {
    return res.status(503).json({ success: false, error: 'Terminal gRPC client not available' });
  }

  const { session_id, max_lines } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }

  terminalClient.getOutput({
    session_id,
    max_lines: max_lines || 50
  }, (error, response) => {
    if (error) {
      console.error('gRPC Terminal getOutput error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json(response);
  });
});

// List terminal sessions
app.get('/terminal/sessions', (req, res) => {
  if (!terminalClient) {
    return res.status(503).json({ success: false, error: 'Terminal gRPC client not available' });
  }

  terminalClient.listSessions({}, (error, response) => {
    if (error) {
      console.error('gRPC Terminal listSessions error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json(response);
  });
});

// Kill terminal session
app.post('/terminal/kill', (req, res) => {
  if (!terminalClient) {
    return res.status(503).json({ success: false, error: 'Terminal gRPC client not available' });
  }

  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }

  terminalClient.killSession({ session_id }, (error, response) => {
    if (error) {
      console.error('gRPC Terminal killSession error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json(response);
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Compiler service (File Operations) listening on http://localhost:${PORT}`);
});
