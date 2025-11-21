require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.AGENT_SERVICE_PORT || 6000;

// Initialize Gemini AI with safety settings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Groq for Llama models
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Initialize Anthropic for Claude models
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
});

// Safety settings for content generation
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// Available models configuration (Updated Nov 2025)
const AVAILABLE_MODELS = [
  // Gemini 3.0 models (Future)
  'gemini-3-pro-preview',
  // Gemini 2.5 models (Latest - Stable)
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  // Gemini 2.0 models (Experimental)
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp',
  // Gemini 1.5 models (Legacy)
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  // Groq/Llama models (ACTIVE - verified Nov 2025)
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  // Aliases for compatibility (including old decommissioned names for backward compatibility)
  'llama3',        // Maps to llama-3.3-70b-versatile
  'llama3-70b',    // Maps to llama-3.3-70b-versatile
  'llama3-8b',     // Maps to llama-3.1-8b-instant
  'llama3-70b-8192',  // OLD NAME - Maps to llama-3.3-70b-versatile for backward compat
  'llama3-8b-8192',   // OLD NAME - Maps to llama-3.1-8b-instant for backward compat
  'llama4',        // Maps to llama-4-maverick (newest)
  'llama4-maverick',  // Maps to llama-4-maverick
  'llama4-scout',     // Maps to llama-4-scout
  // Claude models (Latest - 2025)
  'claude-sonnet-4.5',              // Claude 4.5 Sonnet
  'claude-opus-4.1',                // Claude 4.1 Opus
  'claude-sonnet-4-5',              // Latest - Released 2025
  'claude-opus-4',                  // Claude 4 Opus - Top tier
  'claude-sonnet-4',                // Claude 4 Sonnet - Fast & capable
  'claude-3-5-sonnet-20241022',     // Claude 3.5 Sonnet - Upgraded
  'claude-3-5-haiku-20241022'       // Claude 3.5 Haiku - Fast
];

// Model provider mapping
const MODEL_PROVIDERS = {
  'gemini-3-pro-preview': 'gemini',
  'gemini-2.5-flash': 'gemini',
  'gemini-2.5-pro': 'gemini',
  'gemini-2.0-flash-exp': 'gemini',
  'gemini-2.0-pro-exp': 'gemini',
  'gemini-1.5-flash': 'gemini',
  'gemini-1.5-flash-8b': 'gemini',
  'gemini-1.5-pro': 'gemini',
  'llama-3.3-70b-versatile': 'groq',
  'llama-3.1-8b-instant': 'groq',
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'groq',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'groq',
  'llama3': 'groq',
  'llama3-70b': 'groq',
  'llama3-8b': 'groq',
  'llama3-70b-8192': 'groq',  // OLD - for backward compatibility
  'llama3-8b-8192': 'groq',   // OLD - for backward compatibility
  'llama4': 'groq',
  'llama4-maverick': 'groq',
  'llama4-scout': 'groq',
  'claude-sonnet-4.5': 'claude',
  'claude-opus-4.1': 'claude',
  'claude-sonnet-4-5': 'claude',
  'claude-opus-4': 'claude',
  'claude-sonnet-4': 'claude',
  'claude-3-5-sonnet-20241022': 'claude',
  'claude-3-5-haiku-20241022': 'claude'
};

// Model aliases (maps friendly names to actual model IDs)
const MODEL_ALIASES = {
  'llama3': 'llama-3.3-70b-versatile',
  'llama3-70b': 'llama-3.3-70b-versatile',
  'llama3-8b': 'llama-3.1-8b-instant',
  'llama3-70b-8192': 'llama-3.3-70b-versatile',  // OLD model name -> new model
  'llama3-8b-8192': 'llama-3.1-8b-instant',      // OLD model name -> new model
  'llama4': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama4-maverick': 'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct'
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Multi-Provider AI Agent Service is running!',
    version: '2.2.0',
    providers: {
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      claude: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)
    },
    models: {
      gemini: AVAILABLE_MODELS.filter(m => MODEL_PROVIDERS[m] === 'gemini'),
      groq: AVAILABLE_MODELS.filter(m => MODEL_PROVIDERS[m] === 'groq'),
      claude: AVAILABLE_MODELS.filter(m => MODEL_PROVIDERS[m] === 'claude')
    },
    total_models: AVAILABLE_MODELS.length
  });
});

// Get available models
app.get('/api/models', (req, res) => {
  res.json({
    success: true,
    models: AVAILABLE_MODELS.map(model => {
      const actualModel = MODEL_ALIASES[model] || model;
      const provider = MODEL_PROVIDERS[actualModel];
      let providerName = 'Google Gemini';
      if (provider === 'groq') providerName = 'Groq (Llama)';
      else if (provider === 'claude') providerName = 'Anthropic Claude';

      return {
        id: model,
        actualModel: actualModel !== model ? actualModel : undefined,
        name: model.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        provider: providerName
      };
    })
  });
});

// ========================================
// TOOL DEFINITIONS FOR LLM
// ========================================

const TOOLS = [
  {
    name: 'execute_command',
    description: 'Execute a shell command in the workspace terminal. Use this to run scripts, compile code, install packages, or perform any terminal operation.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory for the command (relative to /workspace)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file in the workspace',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file relative to workspace'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write or create a file in the workspace',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file relative to workspace'
        },
        content: {
          type: 'string',
          description: 'Content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a directory',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to directory relative to workspace'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern using fd (fast find)',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'File name pattern to search for'
        },
        directory: {
          type: 'string',
          description: 'Directory to search in (default: workspace root)'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'search_code',
    description: 'Search for code patterns using ripgrep (ultra-fast search)',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern to search for (supports regex)'
        },
        fileType: {
          type: 'string',
          description: 'File type filter (e.g., "js", "py", "java")'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'create_directory',
    description: 'Create a new directory (recursive)',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to directory to create'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to file to delete'
        }
      },
      required: ['path']
    }
  }
];

// Tool executor
async function executeTool(toolName, parameters) {
  const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';

  try {
    switch (toolName) {
      case 'execute_command': {
        const { command, workingDirectory = '' } = parameters;
        const cwd = path.join(WORKSPACE_PATH, workingDirectory);

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);

        try {
          const { stdout, stderr } = await execPromise(command, {
            cwd,
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 10
          });

          return {
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: 0
          };
        } catch (error) {
          return {
            success: false,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            exitCode: error.code || 1
          };
        }
      }

      case 'read_file': {
        const { path: filePath } = parameters;
        const fullPath = path.join(WORKSPACE_PATH, filePath);
        const fs = require('fs').promises;

        const content = await fs.readFile(fullPath, 'utf-8');
        return {
          success: true,
          content,
          size: content.length
        };
      }

      case 'write_file': {
        const { path: filePath, content } = parameters;
        const fullPath = path.join(WORKSPACE_PATH, filePath);
        const fs = require('fs').promises;
        const dirPath = path.dirname(fullPath);

        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');

        return {
          success: true,
          path: filePath,
          size: content.length
        };
      }

      case 'list_directory': {
        const { path: dirPath } = parameters;
        const fullPath = path.join(WORKSPACE_PATH, dirPath);
        const fs = require('fs').promises;

        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const items = await Promise.all(entries.map(async (entry) => {
          const itemPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(itemPath);

          return {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stats.size
          };
        }));

        return {
          success: true,
          items
        };
      }

      case 'search_files': {
        const { pattern, directory = '' } = parameters;
        const searchPath = directory ? path.join(WORKSPACE_PATH, directory) : WORKSPACE_PATH;

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);

        const { stdout } = await execPromise(`fd "${pattern}" "${searchPath}"`, {
          timeout: 10000
        });

        const files = stdout.trim().split('\n').filter(f => f);
        return {
          success: true,
          files
        };
      }

      case 'search_code': {
        const { pattern, fileType } = parameters;

        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execPromise = promisify(exec);

        let command = `rg "${pattern}" ${WORKSPACE_PATH}`;
        if (fileType) {
          command += ` --type ${fileType}`;
        }
        command += ' --line-number --max-count 50';

        const { stdout } = await execPromise(command, {
          timeout: 10000
        });

        return {
          success: true,
          results: stdout
        };
      }

      case 'create_directory': {
        const { path: dirPath } = parameters;
        const fullPath = path.join(WORKSPACE_PATH, dirPath);
        const fs = require('fs').promises;

        await fs.mkdir(fullPath, { recursive: true });

        return {
          success: true,
          path: dirPath
        };
      }

      case 'delete_file': {
        const { path: filePath } = parameters;
        const fullPath = path.join(WORKSPACE_PATH, filePath);
        const fs = require('fs').promises;

        await fs.unlink(fullPath);

        return {
          success: true,
          path: filePath
        };
      }

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Main agent endpoint (multi-provider)
app.post('/api/agent', async (req, res) => {
  try {
    let { model = 'gemini-2.0-flash-exp', messages, temperature = 0.7, maxTokens = 2048 } = req.body;

    // Resolve model alias if needed
    const actualModel = MODEL_ALIASES[model] || model;
    const provider = MODEL_PROVIDERS[actualModel];

    console.log('🤖 AI Agent Request:', {
      requestedModel: model,
      actualModel,
      provider,
      messageCount: messages?.length || 0,
      temperature,
      maxTokens
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required'
      });
    }

    // Validate model
    if (!AVAILABLE_MODELS.includes(model)) {
      return res.status(400).json({
        error: `Invalid model. Available models: ${AVAILABLE_MODELS.join(', ')}`
      });
    }

    // Route to appropriate provider
    if (provider === 'groq') {
      return await handleGroqRequest(req, res, actualModel, messages, temperature, maxTokens);
    } else if (provider === 'claude') {
      return await handleClaudeRequest(req, res, actualModel, messages, temperature, maxTokens);
    } else {
      return await handleGeminiRequest(req, res, actualModel, messages, temperature, maxTokens);
    }
  } catch (error) {
    console.error('❌ Error in agent endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Handle Groq (Llama) requests
async function handleGroqRequest(req, res, model, messages, temperature, maxTokens) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'Groq API key not configured'
      });
    }

    // Convert messages to Groq format
    const groqMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const completion = await groq.chat.completions.create({
      model,
      messages: groqMessages,
      temperature,
      max_tokens: maxTokens,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    res.json({
      response: responseText,
      model,
      provider: 'groq',
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      }
    });
  } catch (error) {
    console.error('❌ Groq API Error:', error);
    return res.status(500).json({
      error: 'Groq API error',
      details: error.message
    });
  }
}

// Handle Claude (Anthropic) requests
async function handleClaudeRequest(req, res, model, messages, temperature, maxTokens) {
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
      return res.status(503).json({
        error: 'Claude API key not configured'
      });
    }

    // Convert messages to Claude format - separate system message
    let systemMessage = '';
    const claudeMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = msg.content;
      } else {
        claudeMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    const requestBody = {
      model,
      messages: claudeMessages,
      temperature,
      max_tokens: maxTokens,
    };

    if (systemMessage) {
      requestBody.system = systemMessage;
    }

    const message = await anthropic.messages.create(requestBody);

    const responseText = message.content[0]?.text || '';

    res.json({
      response: responseText,
      model,
      provider: 'claude',
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: message.usage?.input_tokens || 0,
        completionTokens: message.usage?.output_tokens || 0,
        totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
      }
    });
  } catch (error) {
    console.error('❌ Claude API Error:', error);
    return res.status(500).json({
      error: 'Claude API error',
      details: error.message
    });
  }
}

// Handle Gemini requests
async function handleGeminiRequest(req, res, model, messages, temperature, maxTokens) {
  try {

    // Initialize Gemini model with safety settings
    const geminiModel = genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      }
    });

    // Create conversation history
    const conversation = geminiModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    // Get the last user message
    const lastMessage = messages[messages.length - 1];

    // Send message to Gemini
    const result = await conversation.sendMessage(lastMessage.content);
    const response = await result.response;

    // Check if response was blocked
    if (response.promptFeedback?.blockReason) {
      return res.status(400).json({
        error: 'Content was blocked',
        reason: response.promptFeedback.blockReason,
        details: 'The response was blocked due to safety concerns'
      });
    }

    const geminiResponse = response.text();

    // Prepare the response
    const agentResponse = {
      response: geminiResponse,
      model: model,
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: 0,  // Gemini API doesn't provide token counts
        completionTokens: 0,
        totalTokens: 0
      }
    };

    res.status(200).json(agentResponse);

  } catch (error) {
    console.error('❌ Error in Gemini agent:', error);

    let errorMessage = 'Failed to process request';
    let statusCode = 500;

    if (error.message?.includes('API key')) {
      errorMessage = 'Invalid or missing API key';
      statusCode = 401;
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded';
      statusCode = 429;
    } else if (error.message?.includes('safety')) {
      errorMessage = 'Content filtered for safety reasons';
      statusCode = 400;
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: error.message
    });
  }
}

// Stream endpoint for real-time responses
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { model = 'gemini-2.0-flash-exp', messages, temperature = 0.7, maxTokens = 2048 } = req.body;

    console.log('🔄 Gemini Streaming Request:', {
      model,
      messageCount: messages?.length || 0
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required'
      });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Initialize Gemini model
    const geminiModel = genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      }
    });

    // Create conversation
    const conversation = geminiModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = messages[messages.length - 1];

    // Generate streaming response
    const result = await conversation.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ content: chunkText, type: 'text' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Error in streaming:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Code generation endpoint
app.post('/api/gemini/code-generate', async (req, res) => {
  try {
    const {
      prompt,
      language = 'javascript',
      model = 'gemini-2.0-flash-exp',
      includeComments = true,
      includeTests = false
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'prompt is required'
      });
    }

    console.log('💻 Code Generation Request:', { language, model });

    // Initialize Gemini model for code generation
    const geminiModel = genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,  // Lower temperature for more deterministic code
      }
    });

    // Create a comprehensive system prompt for code generation
    let systemPrompt = `You are an expert ${language} developer. Generate clean, efficient, and production-ready code based on the user's request.`;

    if (includeComments) {
      systemPrompt += '\n- Include detailed comments explaining the code logic.';
    }

    if (includeTests) {
      systemPrompt += '\n- Include unit tests for the generated code.';
    }

    systemPrompt += `\n- Follow ${language} best practices and conventions.`;
    systemPrompt += '\n- Ensure proper error handling.';
    systemPrompt += '\n- Only return the code without additional explanations.';

    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    const generatedCode = response.text();

    // Extract code from markdown if present
    let cleanCode = generatedCode;
    const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\n?([\\s\\S]*?)\\n?\`\`\``, 'gi');
    const match = codeBlockRegex.exec(generatedCode);
    if (match) {
      cleanCode = match[1].trim();
    }

    res.json({
      success: true,
      code: cleanCode,
      language: language,
      model: model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in code generation:', error);
    res.status(500).json({
      error: 'Failed to generate code',
      details: error.message
    });
  }
});

// Code explanation endpoint
app.post('/api/gemini/code-explain', async (req, res) => {
  try {
    const { code, language = 'javascript', model = 'gemini-1.5-flash' } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'code is required'
      });
    }

    const geminiModel = genAI.getGenerativeModel({ model, safetySettings });

    const prompt = `Explain the following ${language} code in detail:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:
1. A brief summary of what the code does
2. Explanation of each major section
3. Any potential improvements or issues`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const explanation = response.text();

    res.json({
      success: true,
      explanation: explanation,
      language: language,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in code explanation:', error);
    res.status(500).json({
      error: 'Failed to explain code',
      details: error.message
    });
  }
});

// Code review endpoint
app.post('/api/gemini/code-review', async (req, res) => {
  try {
    const { code, language = 'javascript', model = 'gemini-1.5-pro' } = req.body;

    if (!code) {
      return res.status(400).json({
        error: 'code is required'
      });
    }

    const geminiModel = genAI.getGenerativeModel({
      model,
      safetySettings,
      generationConfig: {
        temperature: 0.3,
      }
    });

    const prompt = `Perform a comprehensive code review of the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:
1. Overall code quality assessment (1-10)
2. Potential bugs or issues
3. Security concerns
4. Performance optimization suggestions
5. Best practices violations
6. Suggested improvements`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const review = response.text();

    res.json({
      success: true,
      review: review,
      language: language,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in code review:', error);
    res.status(500).json({
      error: 'Failed to review code',
      details: error.message
    });
  }
});

// ========================================
// FILE MANAGEMENT & TERMINAL OPERATIONS
// ========================================

const fs = require('fs').promises;
const fsSync = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';

// FILE READ - Read file contents
app.post('/api/file/read', async (req, res) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    res.json({
      success: true,
      path: filePath,
      content,
      size: content.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read file',
      details: error.message,
      path: req.body.path
    });
  }
});

// FILE WRITE - Write/Create file
app.post('/api/file/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'File path and content are required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, filePath);
    const dirPath = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');

    res.json({
      success: true,
      path: filePath,
      size: content.length,
      message: 'File written successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to write file',
      details: error.message,
      path: req.body.path
    });
  }
});

// FILE DELETE - Delete file
app.post('/api/file/delete', async (req, res) => {
  try {
    const { path: filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, filePath);
    await fs.unlink(fullPath);

    res.json({
      success: true,
      path: filePath,
      message: 'File deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete file',
      details: error.message,
      path: req.body.path
    });
  }
});

// FILE RENAME/MOVE
app.post('/api/file/move', async (req, res) => {
  try {
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }

    const sourcePath = path.join(WORKSPACE_PATH, source);
    const destPath = path.join(WORKSPACE_PATH, destination);
    const destDir = path.dirname(destPath);

    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    await fs.rename(sourcePath, destPath);

    res.json({
      success: true,
      source,
      destination,
      message: 'File moved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to move file',
      details: error.message
    });
  }
});

// FILE COPY
app.post('/api/file/copy', async (req, res) => {
  try {
    const { source, destination } = req.body;

    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination paths are required' });
    }

    const sourcePath = path.join(WORKSPACE_PATH, source);
    const destPath = path.join(WORKSPACE_PATH, destination);
    const destDir = path.dirname(destPath);

    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    await fs.copyFile(sourcePath, destPath);

    res.json({
      success: true,
      source,
      destination,
      message: 'File copied successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to copy file',
      details: error.message
    });
  }
});

// DIRECTORY CREATE
app.post('/api/directory/create', async (req, res) => {
  try {
    const { path: dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, dirPath);
    await fs.mkdir(fullPath, { recursive: true });

    res.json({
      success: true,
      path: dirPath,
      message: 'Directory created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create directory',
      details: error.message
    });
  }
});

// DIRECTORY DELETE
app.post('/api/directory/delete', async (req, res) => {
  try {
    const { path: dirPath, recursive = false } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, dirPath);
    await fs.rm(fullPath, { recursive, force: false });

    res.json({
      success: true,
      path: dirPath,
      message: 'Directory deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete directory',
      details: error.message
    });
  }
});

// DIRECTORY LIST - List files and subdirectories
app.post('/api/directory/list', async (req, res) => {
  try {
    const { path: dirPath = '' } = req.body;

    const fullPath = path.join(WORKSPACE_PATH, dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const items = await Promise.all(entries.map(async (entry) => {
      const itemPath = path.join(fullPath, entry.name);
      const stats = await fs.stat(itemPath);

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    }));

    res.json({
      success: true,
      path: dirPath || '/',
      items,
      count: items.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list directory',
      details: error.message
    });
  }
});

// FILE/DIRECTORY INFO - Get detailed information
app.post('/api/file/info', async (req, res) => {
  try {
    const { path: itemPath } = req.body;

    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const fullPath = path.join(WORKSPACE_PATH, itemPath);
    const stats = await fs.stat(fullPath);

    res.json({
      success: true,
      path: itemPath,
      exists: true,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      permissions: stats.mode.toString(8),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.json({
        success: true,
        path: itemPath,
        exists: false,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to get file info',
      details: error.message
    });
  }
});

// DIRECTORY TREE - Get recursive directory structure
app.post('/api/directory/tree', async (req, res) => {
  try {
    const { path: dirPath = '', maxDepth = 3 } = req.body;

    async function buildTree(currentPath, depth = 0) {
      if (depth > maxDepth) return null;

      const fullPath = path.join(WORKSPACE_PATH, currentPath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      const items = await Promise.all(entries.map(async (entry) => {
        const relativePath = path.join(currentPath, entry.name);
        const item = {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file'
        };

        if (entry.isDirectory()) {
          item.children = await buildTree(relativePath, depth + 1);
        } else {
          const stats = await fs.stat(path.join(fullPath, entry.name));
          item.size = stats.size;
        }

        return item;
      }));

      return items;
    }

    const tree = await buildTree(dirPath);

    res.json({
      success: true,
      path: dirPath || '/',
      tree,
      maxDepth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to build directory tree',
      details: error.message
    });
  }
});

// TERMINAL EXECUTE - Execute shell commands
app.post('/api/terminal/execute', async (req, res) => {
  try {
    const { command, workingDirectory = '' } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    const cwd = path.join(WORKSPACE_PATH, workingDirectory);

    console.log(`🖥️  Executing command: ${command} in ${cwd}`);

    const { stdout, stderr } = await execPromise(command, {
      cwd,
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    res.json({
      success: true,
      command,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      workingDirectory: workingDirectory || '/',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: false,
      command: req.body.command,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
      workingDirectory: req.body.workingDirectory || '/',
      timestamp: new Date().toISOString()
    });
  }
});

// BATCH OPERATIONS - Execute multiple file operations atomically
app.post('/api/batch/operations', async (req, res) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations must be an array' });
    }

    const results = [];

    for (const op of operations) {
      try {
        let result;

        switch (op.type) {
          case 'read':
            const content = await fs.readFile(path.join(WORKSPACE_PATH, op.path), 'utf-8');
            result = { success: true, content };
            break;

          case 'write':
            await fs.mkdir(path.dirname(path.join(WORKSPACE_PATH, op.path)), { recursive: true });
            await fs.writeFile(path.join(WORKSPACE_PATH, op.path), op.content, 'utf-8');
            result = { success: true };
            break;

          case 'delete':
            await fs.unlink(path.join(WORKSPACE_PATH, op.path));
            result = { success: true };
            break;

          case 'mkdir':
            await fs.mkdir(path.join(WORKSPACE_PATH, op.path), { recursive: true });
            result = { success: true };
            break;

          default:
            result = { success: false, error: 'Unknown operation type' };
        }

        results.push({ ...op, result });
      } catch (error) {
        results.push({ ...op, result: { success: false, error: error.message } });
      }
    }

    res.json({
      success: true,
      results,
      total: operations.length,
      succeeded: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute batch operations',
      details: error.message
    });
  }
});

// ========================================
// AUTONOMOUS AGENT WITH TOOL USE
// ========================================

// Convert TOOLS to Gemini function declarations format
const geminiFunctionDeclarations = TOOLS.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters
}));

// Autonomous agent endpoint with tool-use capability
app.post('/api/agent/autonomous', async (req, res) => {
  try {
    let { model = 'gemini-2.0-flash-exp', messages, temperature = 0.7, maxTokens = 4096, maxIterations = 10 } = req.body;

    // Resolve model alias
    const actualModel = MODEL_ALIASES[model] || model;
    const provider = MODEL_PROVIDERS[actualModel];

    console.log('🤖 Autonomous Agent Request (with tools):', {
      requestedModel: model,
      actualModel,
      provider,
      messageCount: messages?.length || 0,
      maxIterations
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required'
      });
    }

    // Currently only Gemini supports function calling in our setup
    if (provider !== 'gemini') {
      return res.status(400).json({
        error: 'Autonomous tool-use is currently only supported for Gemini models',
        details: 'Please use a Gemini model for autonomous agent functionality'
      });
    }

    // Initialize Gemini model with tools
    const geminiModel = genAI.getGenerativeModel({
      model: actualModel,
      safetySettings,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      },
      tools: [{ functionDeclarations: geminiFunctionDeclarations }]
    });

    // Create conversation history
    const conversation = geminiModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = messages[messages.length - 1];
    let currentMessage = lastMessage.content;

    // Array to track all tool executions
    const toolExecutions = [];
    let iteration = 0;
    let finalResponse = '';

    // Autonomous agent loop
    while (iteration < maxIterations) {
      iteration++;
      console.log(`🔄 Iteration ${iteration}/${maxIterations}`);

      // Send message to Gemini
      const result = await conversation.sendMessage(currentMessage);
      const response = result.response;

      // Check for function calls
      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        // No more function calls - final text response
        finalResponse = response.text();
        console.log('✅ Agent completed with final response');
        break;
      }

      // Execute all function calls
      console.log(`🔧 Executing ${functionCalls.length} tool(s)`);
      const functionResponses = [];

      for (const call of functionCalls) {
        const { name, args } = call;
        console.log(`  → Executing: ${name}(${JSON.stringify(args).substring(0, 100)}...)`);

        try {
          const toolResult = await executeTool(name, args);

          // Record execution
          toolExecutions.push({
            iteration,
            tool: name,
            parameters: args,
            result: toolResult,
            success: toolResult.success,
            timestamp: new Date().toISOString()
          });

          // Create function response for Gemini
          functionResponses.push({
            name: name,
            response: toolResult
          });

          console.log(`  ✓ ${name}: ${toolResult.success ? 'Success' : 'Failed'}`);
        } catch (error) {
          console.error(`  ✗ ${name}: Error -`, error.message);

          toolExecutions.push({
            iteration,
            tool: name,
            parameters: args,
            result: { success: false, error: error.message },
            success: false,
            timestamp: new Date().toISOString()
          });

          functionResponses.push({
            name: name,
            response: { success: false, error: error.message }
          });
        }
      }

      // Send function responses back to model
      // For next iteration, we send the function results
      currentMessage = [{
        functionResponse: {
          name: functionResponses[0].name,
          response: functionResponses[0].response
        }
      }];

      // If multiple function calls, add them all
      if (functionResponses.length > 1) {
        currentMessage = functionResponses.map(fr => ({
          functionResponse: {
            name: fr.name,
            response: fr.response
          }
        }));
      }
    }

    // Check if we hit max iterations
    if (iteration >= maxIterations && !finalResponse) {
      finalResponse = 'Maximum iterations reached. The agent was unable to complete the task within the iteration limit.';
    }

    // Send response
    res.json({
      response: finalResponse,
      model: actualModel,
      provider: 'gemini',
      autonomous: true,
      toolExecutions,
      iterations: iteration,
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    });

  } catch (error) {
    console.error('❌ Error in autonomous agent:', error);
    res.status(500).json({
      error: 'Autonomous agent error',
      details: error.message
    });
  }
});

// Streaming autonomous agent endpoint
app.post('/api/agent/autonomous/stream', async (req, res) => {
  try {
    let { model = 'gemini-2.0-flash-exp', messages, temperature = 0.7, maxTokens = 4096, maxIterations = 10 } = req.body;

    const actualModel = MODEL_ALIASES[model] || model;
    const provider = MODEL_PROVIDERS[actualModel];

    console.log('🔄 Streaming Autonomous Agent Request:', {
      model: actualModel,
      messageCount: messages?.length || 0
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required'
      });
    }

    if (provider !== 'gemini') {
      return res.status(400).json({
        error: 'Autonomous tool-use is currently only supported for Gemini models'
      });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Initialize Gemini model with tools
    const geminiModel = genAI.getGenerativeModel({
      model: actualModel,
      safetySettings,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      },
      tools: [{ functionDeclarations: geminiFunctionDeclarations }]
    });

    // Create conversation
    const conversation = geminiModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = messages[messages.length - 1];
    let currentMessage = lastMessage.content;
    let iteration = 0;

    // Autonomous loop with streaming
    while (iteration < maxIterations) {
      iteration++;

      // Send iteration start event
      res.write(`data: ${JSON.stringify({
        type: 'iteration',
        iteration,
        maxIterations
      })}\n\n`);

      const result = await conversation.sendMessage(currentMessage);
      const response = result.response;

      const functionCalls = response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        // Stream final text response
        const text = response.text();
        res.write(`data: ${JSON.stringify({
          type: 'text',
          content: text
        })}\n\n`);
        break;
      }

      // Execute tools and stream results
      const functionResponses = [];

      for (const call of functionCalls) {
        const { name, args } = call;

        // Send tool execution start event
        res.write(`data: ${JSON.stringify({
          type: 'tool_start',
          tool: name,
          parameters: args
        })}\n\n`);

        try {
          const toolResult = await executeTool(name, args);

          // Send tool execution result
          res.write(`data: ${JSON.stringify({
            type: 'tool_result',
            tool: name,
            result: toolResult,
            success: toolResult.success
          })}\n\n`);

          functionResponses.push({
            name: name,
            response: toolResult
          });
        } catch (error) {
          res.write(`data: ${JSON.stringify({
            type: 'tool_error',
            tool: name,
            error: error.message
          })}\n\n`);

          functionResponses.push({
            name: name,
            response: { success: false, error: error.message }
          });
        }
      }

      // Prepare next iteration message
      currentMessage = functionResponses.map(fr => ({
        functionResponse: {
          name: fr.name,
          response: fr.response
        }
      }));
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'done', iterations: iteration })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Error in streaming autonomous agent:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Agent Service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down Agent Service...');
  process.exit(0);
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Agent Service with Gemini 2.5 listening on http://localhost:${PORT}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`📦 Available models: ${AVAILABLE_MODELS.length}`);
  console.log(`🔒 Safety settings: Enabled`);
});

module.exports = { app, server };
