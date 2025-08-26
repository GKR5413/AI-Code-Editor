require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const app = express();
app.use(cors());
app.use(express.json());

// --- Secure Workspace Configuration ---
const WORKSPACE_DIR = path.resolve(process.env.WORKSPACE_PATH || '/workspace');
console.log(`Security sandbox configured for directory: ${WORKSPACE_DIR}`);

// --- Secure Tool Definitions ---

/**
 * Safely resolves a user-provided path against the workspace directory.
 * Throws an error if the path attempts to escape the sandbox.
 * @param {string} relativePath - The path provided by the user or AI.
 * @returns {string} The absolute, verified path.
 */
function getSafePath(relativePath) {
  const targetPath = path.join(WORKSPACE_DIR, relativePath || '');
  if (!targetPath.startsWith(WORKSPACE_DIR)) {
    throw new Error('Access denied: Path is outside the configured workspace.');
  }
  return targetPath;
}

async function listFiles(directory) {
  try {
    const safePath = getSafePath(directory);
    const files = await fs.readdir(safePath);
    return JSON.stringify(files);
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

async function readFile(filePath) {
  try {
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, 'utf-8');
    return content;
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

async function writeFile(filePath, content) {
  try {
    const safePath = getSafePath(filePath);
    // Ensure the directory exists before writing
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content);
    return `Successfully wrote to ${filePath}`;
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}

const tools = {
  listFiles,
  readFile,
  writeFile,
};

const toolDefinitions = {
  functionDeclarations: [
    { name: "listFiles", description: "List files and directories at a given path within the /workspace directory.", parameters: { type: "OBJECT", properties: { directory: { type: "STRING", description: "The relative path within the workspace." } } } },
    { name: "readFile", description: "Read the contents of a file within the /workspace directory.", parameters: { type: "OBJECT", properties: { filePath: { type: "STRING", description: "The relative path to the file within the workspace." } } } },
    { name: "writeFile", description: "Write content to a file within the /workspace directory. Overwrites existing files.", parameters: { type: "OBJECT", properties: { filePath: { type: "STRING", description: "The relative path to the file within the workspace." }, content: { type: "STRING", description: "The content to write." } } } }
  ]
};

// --- AI Client Initialization from Environment Variables ---
let genAI, groq;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('Gemini client initialized.');
} else {
  console.warn('GEMINI_API_KEY not found. Tool-based agent features will be disabled.');
}

if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('Groq client initialized.');
} else {
  console.warn('GROQ_API_KEY not found. Groq chat features will be disabled.');
}

const PORT = process.env.AGENT_SERVICE_PORT || 6000;

// --- API Endpoints ---
app.get('/', (req, res) => res.send('Agent Service is running!'));

app.post('/api/agent', async (req, res) => {
  const { model, messages } = req.body || {};
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'model and messages[] are required' });
  }

  try {
    // GEMINI tool-calling flow
    if (model === 'gemini-2.5-pro' || model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro') {
      if (!genAI) return res.status(500).json({ error: 'Gemini not configured on server.' });

      const gModel = genAI.getGenerativeModel({ model });
      // Build history and current turn
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '') }]
      }));
      const last = messages[messages.length - 1];
      const chat = gModel.startChat({ tools: [toolDefinitions], history });

      let result = await chat.sendMessage([{ text: String(last.content ?? '') }]);

      // Loop while model issues tool calls
      while (true) {
        const cand = result?.response?.candidates?.[0];
        const part = cand?.content?.parts?.[0];
        const call = part?.functionCall;
        if (!call) break;

        const toolName = call.name;
        const args = call.args || {};
        const toolFn = tools[toolName];
        if (!toolFn) {
          // respond with error to the model
          result = await chat.sendMessage([{ functionResponse: { name: toolName, response: { error: `Tool not found: ${toolName}` } } }]);
          break;
        }

        const toolResult = await toolFn(...Object.values(args));
        result = await chat.sendMessage([{ functionResponse: { name: toolName, response: { result: toolResult } } }]);
      }

      const outText = result?.response?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
      return res.json({ response: outText });
    }

    // GROQ (OpenAI-compatible) tool-calling flow
    if (groq) {
      let convo = messages.map(m => ({ role: m.role, content: String(m.content ?? '') }));
      let response = await groq.chat.completions.create({ model, messages: convo, tools: [
        { type: 'function', function: { name: 'listFiles', description: 'List files', parameters: { type: 'object', properties: { directory: { type: 'string' } } } } },
        { type: 'function', function: { name: 'readFile', description: 'Read file', parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } } },
        { type: 'function', function: { name: 'writeFile', description: 'Write file', parameters: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string' } }, required: ['filePath','content'] } } }
      ], tool_choice: 'auto' });

      while (true) {
        const msg = response.choices?.[0]?.message;
        const calls = msg?.tool_calls || [];
        if (!calls.length) break;

        if (msg.content) convo.push({ role: 'assistant', content: msg.content });

        for (const c of calls) {
          const toolName = c.function?.name;
          let args = {};
          try { args = JSON.parse(c.function?.arguments || '{}'); } catch {}
          const toolFn = tools[toolName];
          const toolResult = toolFn ? await toolFn(args.directory ?? args.filePath, args.content) : { error: `Tool not found: ${toolName}` };
          convo.push({ role: 'tool', tool_call_id: c.id, content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) });
        }

        response = await groq.chat.completions.create({ model, messages: convo, tools: [
          { type: 'function', function: { name: 'listFiles', parameters: { type: 'object', properties: { directory: { type: 'string' } } } } },
          { type: 'function', function: { name: 'readFile', parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] } } },
          { type: 'function', function: { name: 'writeFile', parameters: { type: 'object', properties: { filePath: { type: 'string' }, content: { type: 'string' } }, required: ['filePath','content'] } } }
        ], tool_choice: 'auto' });
      }

      const finalText = response.choices?.[0]?.message?.content || '';
      return res.json({ response: finalText });
    }

    return res.status(500).json({ error: 'No AI models are configured on the server.' });
  } catch (error) {
    console.error('Error in agent logic:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

app.listen(PORT, () => {
  console.log(`Agent service listening on http://localhost:${PORT}`);
});