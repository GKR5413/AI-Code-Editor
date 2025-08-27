require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, './proto/agent.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const agentProto = grpc.loadPackageDefinition(packageDefinition);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Supported models configuration
const SUPPORTED_MODELS = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'gemini',
    description: 'Latest Gemini model with enhanced capabilities',
    max_tokens: 2048,
    supports_streaming: true,
    capabilities: ['text', 'code', 'analysis']
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    description: 'Fast and efficient Gemini model',
    max_tokens: 2048,
    supports_streaming: true,
    capabilities: ['text', 'code']
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    description: 'Advanced Gemini model for complex tasks',
    max_tokens: 4096,
    supports_streaming: true,
    capabilities: ['text', 'code', 'analysis']
  }
];

class AgentGrpcServer {
  constructor() {
    this.server = new grpc.Server();
    this.activeStreams = new Map(); // Track active streaming sessions
    this.setupServices();
  }

  setupServices() {
    this.server.addService(agentProto.agent.AgentService.service, {
      HealthCheck: this.healthCheck.bind(this),
      SendMessage: this.sendMessage.bind(this),
      StreamConversation: this.streamConversation.bind(this),
      GenerateCode: this.generateCode.bind(this),
      GetSupportedModels: this.getSupportedModels.bind(this)
    });
  }

  // Health check
  healthCheck(call, callback) {
    callback(null, {
      healthy: true,
      message: 'Agent gRPC service is running',
      services: {
        gemini: !!process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
        models: SUPPORTED_MODELS.length.toString()
      }
    });
  }

  // Send message to AI
  async sendMessage(call, callback) {
    try {
      const { model = 'gemini-2.0-flash-exp', messages, options } = call.request;
      
      console.log('🤖 Gemini Agent gRPC Request:', {
        model,
        messageCount: messages?.length || 0,
        hasOptions: !!options
      });

      if (!messages || messages.length === 0) {
        return callback(null, {
          success: false,
          response: '',
          model: model,
          timestamp: Date.now(),
          error: 'messages array is required',
          token_usage: null
        });
      }

      // Validate model
      const modelConfig = SUPPORTED_MODELS.find(m => m.id === model);
      if (!modelConfig) {
        return callback(null, {
          success: false,
          response: '',
          model: model,
          timestamp: Date.now(),
          error: `Unsupported model: ${model}`,
          token_usage: null
        });
      }

      // Initialize Gemini model
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Create conversation history
      const conversation = geminiModel.startChat({
        history: messages.slice(0, -1).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          maxOutputTokens: options?.max_tokens || modelConfig.max_tokens,
          temperature: options?.temperature || 0.7,
          stopSequences: options?.stop_sequences || []
        },
      });

      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      
      // Send message to Gemini
      const result = await conversation.sendMessage(lastMessage.content);
      const response = await result.response;
      const geminiResponse = response.text();

      callback(null, {
        success: true,
        response: geminiResponse,
        model: model,
        timestamp: Date.now(),
        error: '',
        token_usage: {
          prompt_tokens: 0, // Gemini doesn't provide token counts
          completion_tokens: 0,
          total_tokens: 0
        }
      });

    } catch (error) {
      console.error('❌ Error in Gemini agent:', error);
      
      // Handle specific Gemini errors
      let errorMessage = error.message;
      if (error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please try again later.';
      } else if (error.message.includes('safety')) {
        errorMessage = 'Content filtered for safety reasons.';
      }

      callback(null, {
        success: false,
        response: '',
        model: call.request.model || 'unknown',
        timestamp: Date.now(),
        error: errorMessage,
        token_usage: null
      });
    }
  }

  // Stream conversation with AI
  streamConversation(call) {
    const { model = 'gemini-2.0-flash-exp', messages, options } = call.request;
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔄 Starting streaming conversation:', { model, streamId, messageCount: messages?.length || 0 });

    this.activeStreams.set(streamId, call);

    // Validate input
    if (!messages || messages.length === 0) {
      call.write({
        content: '',
        type: 'error',
        is_final: true,
        timestamp: Date.now(),
        model: model
      });
      call.end();
      this.activeStreams.delete(streamId);
      return;
    }

    // Validate model
    const modelConfig = SUPPORTED_MODELS.find(m => m.id === model);
    if (!modelConfig || !modelConfig.supports_streaming) {
      call.write({
        content: `Model ${model} does not support streaming`,
        type: 'error',
        is_final: true,
        timestamp: Date.now(),
        model: model
      });
      call.end();
      this.activeStreams.delete(streamId);
      return;
    }

    // Start streaming response
    this.performStreamingGeneration(model, messages, options, call, streamId);
  }

  async performStreamingGeneration(model, messages, options, call, streamId) {
    try {
      // Initialize Gemini model
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Send status
      call.write({
        content: '',
        type: 'status',
        is_final: false,
        timestamp: Date.now(),
        model: model
      });

      // Create conversation
      const conversation = geminiModel.startChat({
        history: messages.slice(0, -1).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          maxOutputTokens: options?.max_tokens || 2048,
          temperature: options?.temperature || 0.7,
        },
      });

      const lastMessage = messages[messages.length - 1];
      
      // Generate streaming response
      const result = await conversation.sendMessageStream(lastMessage.content);
      let fullResponse = '';

      for await (const chunk of result.stream) {
        if (!this.activeStreams.has(streamId)) {
          // Stream was cancelled
          break;
        }

        const chunkText = chunk.text();
        fullResponse += chunkText;
        
        call.write({
          content: chunkText,
          type: 'text',
          is_final: false,
          timestamp: Date.now(),
          model: model
        });
      }

      // Send final message
      call.write({
        content: '',
        type: 'done',
        is_final: true,
        timestamp: Date.now(),
        model: model
      });

      call.end();
      this.activeStreams.delete(streamId);
      
      console.log('✅ Streaming conversation completed:', streamId);

    } catch (error) {
      console.error('❌ Error in streaming conversation:', error);
      
      if (this.activeStreams.has(streamId)) {
        call.write({
          content: error.message,
          type: 'error',
          is_final: true,
          timestamp: Date.now(),
          model: model
        });
        call.end();
        this.activeStreams.delete(streamId);
      }
    }
  }

  // Generate code
  async generateCode(call, callback) {
    try {
      const { prompt, language = 'javascript', model = 'gemini-2.0-flash-exp', options } = call.request;
      
      if (!prompt) {
        return callback(null, {
          success: false,
          code: '',
          language: language,
          explanation: '',
          suggestions: [],
          error: 'prompt is required',
          timestamp: Date.now()
        });
      }

      // Initialize Gemini model for code generation
      const geminiModel = genAI.getGenerativeModel({ model });
      
      // Create a system prompt for code generation
      const systemPrompt = `You are an expert ${language} developer. Generate clean, efficient, and well-commented code based on the user's request.`;
      
      let fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;
      
      // Add options if provided
      if (options?.include_comments) {
        fullPrompt += '\n\nPlease include detailed comments explaining the code.';
      }
      
      if (options?.style) {
        fullPrompt += `\n\nCode style: ${options.style}`;
      }
      
      if (options?.frameworks && options.frameworks.length > 0) {
        fullPrompt += `\n\nUse these frameworks if applicable: ${options.frameworks.join(', ')}`;
      }
      
      fullPrompt += `\n\nOnly return the ${language} code, no explanations unless specifically requested.`;
      
      const result = await geminiModel.generateContent(fullPrompt);
      const response = await result.response;
      const generatedCode = response.text();

      // Try to extract just the code (remove markdown formatting if present)
      let cleanCode = generatedCode;
      const codeBlockRegex = new RegExp(`\`\`\`(?:${language})?\\n?([\\s\\S]*?)\\n?\`\`\``, 'gi');
      const match = codeBlockRegex.exec(generatedCode);
      if (match) {
        cleanCode = match[1].trim();
      }

      // Generate simple suggestions
      const suggestions = [
        'Consider adding error handling',
        'Add input validation',
        'Include unit tests',
        'Optimize for performance'
      ];

      callback(null, {
        success: true,
        code: cleanCode,
        language: language,
        explanation: `Generated ${language} code based on the prompt: "${prompt}"`,
        suggestions: suggestions,
        error: '',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error in code generation:', error);
      callback(null, {
        success: false,
        code: '',
        language: call.request.language || 'unknown',
        explanation: '',
        suggestions: [],
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Get supported models
  getSupportedModels(call, callback) {
    callback(null, {
      success: true,
      models: SUPPORTED_MODELS,
      error: ''
    });
  }

  start(port = 50053) {
    const bindAddress = `0.0.0.0:${port}`;
    this.server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        console.error('Failed to start Agent gRPC server:', error);
        return;
      }
      console.log(`🚀 Agent gRPC server listening on port ${port}`);
      console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
      console.log(`📋 Supported models: ${SUPPORTED_MODELS.length}`);
      this.server.start();
    });
  }

  stop() {
    // Close all active streams
    for (const [streamId, call] of this.activeStreams.entries()) {
      try {
        call.write({
          content: 'Server is shutting down',
          type: 'status',
          is_final: true,
          timestamp: Date.now(),
          model: 'system'
        });
        call.end();
      } catch (error) {
        console.error('Error closing stream:', streamId, error);
      }
    }
    this.activeStreams.clear();

    this.server.tryShutdown(() => {
      console.log('Agent gRPC server stopped');
    });
  }
}

// Start the server
if (require.main === module) {
  const server = new AgentGrpcServer();
  server.start(process.env.GRPC_PORT || 50053);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Agent gRPC server...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down Agent gRPC server...');
    server.stop();
    process.exit(0);
  });
}

module.exports = AgentGrpcServer;