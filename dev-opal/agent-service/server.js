require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const PORT = process.env.AGENT_SERVICE_PORT || 6000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Agent Service with Gemini 2.5 is running!',
    services: {
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

// Main agent endpoint for Gemini 2.5
app.post('/api/agent', async (req, res) => {
  try {
    const { model = 'gemini-2.0-flash-exp', messages } = req.body;
    
    console.log('🤖 Gemini Agent Request:', {
      model,
      messageCount: messages?.length || 0
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'messages array is required' 
      });
    }

    // Initialize Gemini model
    const geminiModel = genAI.getGenerativeModel({ model });
    
    // Create conversation history
    const conversation = geminiModel.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.content
      })),
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    
    // Send message to Gemini
    const result = await conversation.sendMessage(lastMessage.content);
    const response = await result.response;
    const geminiResponse = response.text();

    // Prepare the response
    const agentResponse = {
      response: geminiResponse,
      model: model,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(agentResponse);

  } catch (error) {
    console.error('❌ Error in Gemini agent:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
});


// Gemini-specific endpoint for code generation
app.post('/api/gemini/code-generate', async (req, res) => {
  try {
    const { prompt, language } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: 'prompt is required' 
      });
    }

    // Initialize Gemini model for code generation
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    // Create a system prompt for code generation
    const systemPrompt = `You are an expert ${language || 'programming'} developer. 
    Generate clean, efficient, and well-commented code based on the user's request.
    Only return the code, no explanations unless specifically requested.`;
    
    const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;
    
    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    const generatedCode = response.text();

    res.json({
      code: generatedCode,
      language: language || 'unknown',
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Agent Service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down Agent Service...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Agent Service with Gemini 2.5 listening on http://localhost:${PORT}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
});
