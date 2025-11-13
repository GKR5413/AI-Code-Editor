import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import winston from "winston";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 6001;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Validate API key
if (!CLAUDE_API_KEY) {
  logger.error("❌ CLAUDE_API_KEY or ANTHROPIC_API_KEY not set in environment. Exiting.");
  process.exit(1);
}

// Initialize Anthropic client with latest SDK
const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

// Available Claude models
const AVAILABLE_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-opus-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: 'ok',
    service: 'Claude Agent Service',
    version: '2.0.0',
    sdk_version: '0.68.0',
    api_configured: !!CLAUDE_API_KEY,
    available_models: AVAILABLE_MODELS,
    features: {
      streaming: true,
      function_calling: true,
      vision: true,
      prompt_caching: true
    }
  });
});

// Get available models
app.get("/api/models", (req, res) => {
  res.json({
    success: true,
    models: AVAILABLE_MODELS.map(model => ({
      id: model,
      name: model.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      provider: 'Anthropic Claude',
      features: {
        text: true,
        vision: model.includes('claude-3'),
        function_calling: true,
        streaming: true
      }
    }))
  });
});

// Legacy endpoint (backward compatibility)
app.post("/v1/claude/completions", async (req, res) => {
  try {
    const {
      prompt,
      max_tokens = 4096,
      stop_sequences,
      model = "claude-3-5-sonnet-20241022",
      temperature = 0.7
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "'prompt' is required." });
    }

    logger.info('📝 Legacy completion request', { model, prompt_length: prompt.length });

    const response = await anthropic.messages.create({
      model,
      max_tokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
      stop_sequences,
    });

    res.json({
      completion: response.content[0].text,
      model: response.model,
      usage: response.usage,
      raw: response
    });

  } catch (error) {
    logger.error("ClaudeAPI Error", { error: error.message });
    res.status(500).json({
      error: "Claude API error",
      details: error.message
    });
  }
});

// Modern messages endpoint (recommended)
app.post("/api/claude/messages", async (req, res) => {
  try {
    const {
      messages,
      model = process.env.DEFAULT_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens = parseInt(process.env.MAX_TOKENS) || 4096,
      temperature = parseFloat(process.env.DEFAULT_TEMPERATURE) || 0.7,
      top_p,
      top_k,
      stop_sequences,
      system,
      metadata,
      tools
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "'messages' array is required." });
    }

    // Validate model
    if (!AVAILABLE_MODELS.includes(model)) {
      return res.status(400).json({
        error: `Invalid model. Available models: ${AVAILABLE_MODELS.join(', ')}`
      });
    }

    logger.info('💬 Claude messages request', {
      model,
      message_count: messages.length,
      has_tools: !!tools,
      has_system: !!system
    });

    const requestParams = {
      model,
      max_tokens,
      temperature,
      messages,
      ...(top_p && { top_p }),
      ...(top_k && { top_k }),
      ...(stop_sequences && { stop_sequences }),
      ...(system && { system }),
      ...(metadata && { metadata }),
      ...(tools && { tools })
    };

    const response = await anthropic.messages.create(requestParams);

    res.json({
      success: true,
      id: response.id,
      type: response.type,
      role: response.role,
      content: response.content,
      model: response.model,
      stop_reason: response.stop_reason,
      stop_sequence: response.stop_sequence,
      usage: response.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("Claude messages error", { error: error.message });

    let statusCode = 500;
    if (error.status) statusCode = error.status;

    res.status(statusCode).json({
      error: error.message || "Claude API error",
      type: error.type,
      details: error
    });
  }
});

// Streaming endpoint
app.post("/api/claude/stream", async (req, res) => {
  try {
    const {
      messages,
      model = "claude-3-5-sonnet-20241022",
      max_tokens = 4096,
      temperature = 0.7,
      system,
      tools
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "'messages' array is required." });
    }

    logger.info('🔄 Claude streaming request', { model, message_count: messages.length });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const requestParams = {
      model,
      max_tokens,
      temperature,
      messages,
      stream: true,
      ...(system && { system }),
      ...(tools && { tools })
    };

    const stream = await anthropic.messages.create(requestParams);

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({
            type: 'text',
            content: event.delta.text
          })}\n\n`);
        }
      } else if (event.type === 'message_start') {
        res.write(`data: ${JSON.stringify({
          type: 'start',
          message: event.message
        })}\n\n`);
      } else if (event.type === 'message_delta') {
        res.write(`data: ${JSON.stringify({
          type: 'delta',
          delta: event.delta,
          usage: event.usage
        })}\n\n`);
      } else if (event.type === 'message_stop') {
        res.write(`data: ${JSON.stringify({
          type: 'done'
        })}\n\n`);
      }
    }

    res.end();

  } catch (error) {
    logger.error("Claude streaming error", { error: error.message });
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Code generation endpoint
app.post("/api/claude/code-generate", async (req, res) => {
  try {
    const {
      prompt,
      language = 'javascript',
      model = 'claude-3-5-sonnet-20241022',
      include_tests = false,
      include_comments = true
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    logger.info('💻 Code generation request', { language, model });

    let systemPrompt = `You are an expert ${language} developer. Generate clean, efficient, and production-ready code.`;

    if (include_comments) {
      systemPrompt += '\n- Include detailed comments explaining the code.';
    }

    if (include_tests) {
      systemPrompt += '\n- Include unit tests for the code.';
    }

    systemPrompt += `\n- Follow ${language} best practices.\n- Ensure proper error handling.\n- Return only the code without markdown formatting.`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const code = response.content[0].text;

    res.json({
      success: true,
      code,
      language,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("Code generation error", { error: error.message });
    res.status(500).json({
      error: 'Failed to generate code',
      details: error.message
    });
  }
});

// Code review endpoint
app.post("/api/claude/code-review", async (req, res) => {
  try {
    const {
      code,
      language = 'javascript',
      model = 'claude-3-5-sonnet-20241022'
    } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    logger.info('🔍 Code review request', { language, model });

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.3,
      system: `You are an expert code reviewer. Analyze the provided code and provide comprehensive feedback.`,
      messages: [{
        role: 'user',
        content: `Review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:
1. Overall quality assessment (1-10)
2. Potential bugs or issues
3. Security concerns
4. Performance optimization suggestions
5. Best practices violations
6. Recommended improvements`
      }]
    });

    res.json({
      success: true,
      review: response.content[0].text,
      language,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("Code review error", { error: error.message });
    res.status(500).json({
      error: 'Failed to review code',
      details: error.message
    });
  }
});

// Vision endpoint (for image analysis)
app.post("/api/claude/vision", async (req, res) => {
  try {
    const {
      image_url,
      image_base64,
      image_media_type = 'image/jpeg',
      prompt,
      model = 'claude-3-5-sonnet-20241022'
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!image_url && !image_base64) {
      return res.status(400).json({ error: 'Either image_url or image_base64 is required' });
    }

    logger.info('👁️ Vision request', { model, has_url: !!image_url, has_base64: !!image_base64 });

    // Construct image content
    const imageContent = image_url ? {
      type: "image",
      source: {
        type: "url",
        url: image_url
      }
    } : {
      type: "image",
      source: {
        type: "base64",
        media_type: image_media_type,
        data: image_base64
      }
    };

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          imageContent,
          {
            type: "text",
            text: prompt
          }
        ]
      }]
    });

    res.json({
      success: true,
      analysis: response.content[0].text,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error("Vision error", { error: error.message });
    res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Shutting down Claude Agent Service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down Claude Agent Service...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Claude Agent Service listening on http://localhost:${PORT}`);
  logger.info(`🤖 Claude API: ${CLAUDE_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  logger.info(`📦 Available models: ${AVAILABLE_MODELS.length}`);
  logger.info(`✨ SDK version: 0.68.0`);
  logger.info(`🎯 Features: Streaming ✓ | Function Calling ✓ | Vision ✓ | Caching ✓`);
});
