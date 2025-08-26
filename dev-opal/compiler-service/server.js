require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// --- Security Configuration ---
// Confine all file operations to the /workspace directory
const WORKSPACE_DIR = path.resolve(__dirname, '../workspace');
console.log(`File service sandboxed to: ${WORKSPACE_DIR}`);

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
  const { command, path: userPath, content } = req.body;

  if (!command || !userPath) {
    return res.status(400).json({ error: 'The 'command' and 'path' fields are required.' });
  }

  try {
    const safePath = getSafePath(userPath);

    switch (command) {
      case 'list': {
        const files = await fs.readdir(safePath, { withFileTypes: true });
        const fileList = files.map(file => ({
          name: file.name,
          isDirectory: file.isDirectory(),
        }));
        return res.json(fileList);
      }

      case 'read': {
        const fileContent = await fs.readFile(safePath, 'utf-8');
        return res.send(fileContent);
      }

      case 'write': {
        if (typeof content !== 'string') {
          return res.status(400).json({ error: 'The 'content' field is required for the write command.' });
        }
        await fs.mkdir(path.dirname(safePath), { recursive: true });
        await fs.writeFile(safePath, content);
        return res.status(200).json({ message: `File '${userPath}' saved successfully.` });
      }

      default: {
        return res.status(400).json({ error: `Unknown command: '${command}'` });
      }
    }
  } catch (error) {
    console.error(`Operation '${command}' on path '${userPath}' failed:`, error);
    // Avoid leaking internal path details in the error message
    if (error.code === 'ENOENT') {
        return res.status(404).json({ error: `Path not found: '${userPath}'` });
    }
    return res.status(500).json({ error: `An internal error occurred: ${error.message}` });
  }
});

const PORT = process.env.COMPILER_SERVICE_PORT || 7000;
app.listen(PORT, () => {
  console.log(`Compiler service (File Operations) listening on http://localhost:${PORT}`);
});
