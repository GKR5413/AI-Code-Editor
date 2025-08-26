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

// --- Tool Definition ---
const WORKSPACE_DIR = path.resolve(__dirname, '..'); // Set workspace to the 'dev-opal' directory

async function listFiles(directory) {
  const targetPath = path.join(WORKSPACE_DIR, directory || '');
  if (!targetPath.startsWith(WORKSPACE_DIR)) return JSON.stringify({ error: "Access denied." });
  try {
    const files = await fs.readdir(targetPath);
    return JSON.stringify(files);
  } catch (error) { return JSON.stringify({ error: error.message }); }
}

async function readFile(filePath) {
  const targetPath = path.join(WORKSPACE_DIR, filePath || '');
  if (!targetPath.startsWith(WORKSPACE_DIR)) return JSON.stringify({ error: "Access denied." });
  try {
    const content = await fs.readFile(targetPath, 'utf-8');
    return content;
  } catch (error) { return JSON.stringify({ error: error.message }); }
}

async function writeFile(filePath, content) {
  const targetPath = path.join(WORKSPACE_DIR, filePath || '');
  if (!targetPath.startsWith(WORKSPACE_DIR)) return JSON.stringify({ error: "Access denied." });
  try {
    await fs.writeFile(targetPath, content);
    return `Successfully wrote to ${filePath}`;
  } catch (error) { return JSON.stringify({ error: error.message }); }
}

const tools = {
  listFiles,
  readFile,
  writeFile,
};

const toolDefinitions = {
  functionDeclarations: [
    {
      name: "listFiles",
      description: "Get a list of files and directories at a specified path.",
      parameters: { type: "OBJECT", properties: { directory: { type: "STRING", description: "The relative path to the directory." } } }
    },
    {
      name: "readFile",
      description: "Read the contents of a file at a specified path.",
      parameters: { type: "OBJECT", properties: { filePath: { type: "STRING", description: "The relative path to the file." } } }
    },
    {
      name: "writeFile",
      description: "Write content to a file at a specified path. Creates the file if it does not exist, or overwrites it if it does.",
      parameters: { type: "OBJECT", properties: { 
        filePath: { type: "STRING", description: "The relative path to the file." },
        content: { type: "STRING", description: "The content to write to the file." }
      } }
    }
  ]
};

// --- AI Client Initialization ---
let genAI, groq;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('Gemini client initialized.');
} else {
  console.warn('GEMINI_API_KEY not found, Gemini client not initialized.');
}

if (process.env.GROQ_API_KEY) {
  groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('Groq client initialized.');
} else {
  console.warn('GROQ_API_KEY not found, Groq client not initialized.');
}

const PORT = process.env.AGENT_SERVICE_PORT || 6000;

app.get('/', (req, res) => res.send('Agent Service is running!'));

// --- Main Agent Endpoint ---
app.post('/api/agent', async (req, res) => {
  const { prompt, model } = req.body;
  console.log(`Received prompt: "${prompt}" for model: ${model}`);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    let text = '';
    // Route based on requested model name
    if (model && model.startsWith('gemini-')) {
      if (!genAI) {
        return res.status(500).json({ error: 'Gemini not configured on server.' });
      }
      const geminiModel = genAI.getGenerativeModel({ model });
      const result = await geminiModel.generateContent(prompt);
      text = result.response.text();
    } else if (groq && model && model.startsWith('llama')) {
      const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model,
      });
      text = chatCompletion.choices[0]?.message?.content || '';
    } else {
      return res.status(500).json({ error: 'No AI models configured on the server.' });
    }
    res.json({ response: text });
  } catch (error) {
    console.error('Error in agent logic:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

app.listen(PORT, () => {
  console.log(`Agent service listening on port ${PORT}`);
});
