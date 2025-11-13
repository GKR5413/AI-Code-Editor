# Agent Service - Gemini AI Integration

Version: 2.0.0
Powered by: Google Gemini 2.5 Flash & Gemini 1.5 Pro

## Overview

The Agent Service is an advanced AI-powered code assistant service that provides intelligent code generation, explanation, review, and conversation capabilities using Google's Gemini AI models. It supports both HTTP REST API and gRPC interfaces for seamless integration.

## Features

✨ **Latest Gemini Models**
- Gemini 2.0 Flash (Experimental) - Latest cutting-edge model
- Gemini 1.5 Flash - Fast and efficient
- Gemini 1.5 Flash 8B - Lightweight variant
- Gemini 1.5 Pro - Advanced model for complex tasks

🔐 **Safety First**
- Built-in content safety filters
- Configurable harm thresholds
- Secure API key management
- Helmet.js security middleware

🚀 **Capabilities**
- AI-powered code generation
- Code explanation and documentation
- Code review and quality assessment
- Real-time streaming responses
- Conversation management
- Multi-language support

📡 **Dual Interface**
- RESTful HTTP API
- gRPC service for high-performance communication
- Server-Sent Events (SSE) for streaming

## Installation

### Prerequisites
- Node.js 20.0.0 or higher
- Google Gemini API key
- Docker (for containerized deployment)

### Local Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the service
npm start

# Development mode with auto-reload
npm run dev
```

### Docker Setup

```bash
# Build the image
docker compose build agent

# Run the container
docker compose up -d agent
```

## Configuration

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your_google_gemini_api_key_here

# Optional
AGENT_SERVICE_PORT=6000       # HTTP API port
GRPC_PORT=50053              # gRPC service port
NODE_ENV=production          # production or development
WORKSPACE_PATH=/workspace    # Workspace directory path
```

### Safety Settings

The service includes configurable content safety filters:
- Harassment: BLOCK_MEDIUM_AND_ABOVE
- Hate Speech: BLOCK_MEDIUM_AND_ABOVE
- Sexually Explicit: BLOCK_MEDIUM_AND_ABOVE
- Dangerous Content: BLOCK_MEDIUM_AND_ABOVE

## HTTP REST API

### Base URL
```
http://localhost:6000
```

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "message": "Agent Service with Gemini 2.5 is running!",
  "version": "2.0.0",
  "services": {
    "gemini": true,
    "models": ["gemini-2.0-flash-exp", "gemini-1.5-flash", ...]
  }
}
```

#### 2. Get Available Models
```http
GET /api/models
```

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "id": "gemini-2.0-flash-exp",
      "name": "Gemini 2.0 Flash Exp",
      "provider": "Google Gemini"
    },
    ...
  ]
}
```

#### 3. Send Message (Chat)
```http
POST /api/agent
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    { "role": "user", "content": "Explain async/await in JavaScript" }
  ],
  "temperature": 0.7,
  "maxTokens": 2048
}
```

**Response:**
```json
{
  "response": "Async/await is a modern JavaScript syntax...",
  "model": "gemini-2.0-flash-exp",
  "timestamp": "2025-01-30T10:00:00.000Z",
  "usage": {
    "promptTokens": 0,
    "completionTokens": 0,
    "totalTokens": 0
  }
}
```

#### 4. Stream Response (SSE)
```http
POST /api/agent/stream
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    { "role": "user", "content": "Write a hello world program" }
  ]
}
```

**Response:** Server-Sent Events stream
```
data: {"content":"Hello","type":"text"}

data: {"content":" World","type":"text"}

data: {"type":"done"}
```

#### 5. Generate Code
```http
POST /api/gemini/code-generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "Create a REST API endpoint for user authentication",
  "language": "javascript",
  "model": "gemini-2.0-flash-exp",
  "includeComments": true,
  "includeTests": false
}
```

**Response:**
```json
{
  "success": true,
  "code": "// Generated code here...",
  "language": "javascript",
  "model": "gemini-2.0-flash-exp",
  "timestamp": "2025-01-30T10:00:00.000Z"
}
```

#### 6. Explain Code
```http
POST /api/gemini/code-explain
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "const result = await fetch('/api/users');",
  "language": "javascript",
  "model": "gemini-1.5-flash"
}
```

**Response:**
```json
{
  "success": true,
  "explanation": "This code makes an asynchronous HTTP GET request...",
  "language": "javascript",
  "timestamp": "2025-01-30T10:00:00.000Z"
}
```

#### 7. Review Code
```http
POST /api/gemini/code-review
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "function add(a, b) { return a + b; }",
  "language": "javascript",
  "model": "gemini-1.5-pro"
}
```

**Response:**
```json
{
  "success": true,
  "review": "Overall Quality: 7/10\n\nStrengths:\n- Clear function purpose...",
  "language": "javascript",
  "timestamp": "2025-01-30T10:00:00.000Z"
}
```

## gRPC API

### Service Definition

See `proto/agent.proto` for the complete service definition.

### Available RPC Methods

#### 1. HealthCheck
```protobuf
rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
```

#### 2. SendMessage
```protobuf
rpc SendMessage(MessageRequest) returns (MessageResponse);
```

#### 3. StreamConversation
```protobuf
rpc StreamConversation(StreamRequest) returns (stream StreamChunk);
```

#### 4. GenerateCode
```protobuf
rpc GenerateCode(CodeGenerationRequest) returns (CodeGenerationResponse);
```

#### 5. GetSupportedModels
```protobuf
rpc GetSupportedModels(ModelsRequest) returns (ModelsResponse);
```

### Connection

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('proto/agent.proto');
const agentProto = grpc.loadPackageDefinition(packageDefinition);

const client = new agentProto.agent.AgentService(
  'localhost:50053',
  grpc.credentials.createInsecure()
);
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Chat with AI
async function chat() {
  const response = await axios.post('http://localhost:6000/api/agent', {
    model: 'gemini-2.0-flash-exp',
    messages: [
      { role: 'user', content: 'Explain promises in JavaScript' }
    ]
  });

  console.log(response.data.response);
}

// Generate code
async function generateCode() {
  const response = await axios.post('http://localhost:6000/api/gemini/code-generate', {
    prompt: 'Create a binary search function',
    language: 'python',
    includeComments: true
  });

  console.log(response.data.code);
}
```

### Python

```python
import requests

# Chat endpoint
response = requests.post('http://localhost:6000/api/agent', json={
    'model': 'gemini-2.0-flash-exp',
    'messages': [
        {'role': 'user', 'content': 'What is TypeScript?'}
    ]
})

print(response.json()['response'])

# Code generation
response = requests.post('http://localhost:6000/api/gemini/code-generate', json={
    'prompt': 'Create a quicksort function',
    'language': 'javascript',
    'includeComments': True
})

print(response.json()['code'])
```

### cURL

```bash
# Health check
curl http://localhost:6000/health

# Send message
curl -X POST http://localhost:6000/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.0-flash-exp",
    "messages": [
      {"role": "user", "content": "Hello, AI!"}
    ]
  }'

# Generate code
curl -X POST http://localhost:6000/api/gemini/code-generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a function to calculate factorial",
    "language": "javascript"
  }'
```

## Supported Models

| Model ID | Name | Description | Max Tokens | Streaming |
|----------|------|-------------|------------|-----------|
| `gemini-2.0-flash-exp` | Gemini 2.0 Flash | Latest experimental model | 2048 | ✅ |
| `gemini-1.5-flash` | Gemini 1.5 Flash | Fast and efficient | 2048 | ✅ |
| `gemini-1.5-flash-8b` | Gemini 1.5 Flash 8B | Lightweight variant | 2048 | ✅ |
| `gemini-1.5-pro` | Gemini 1.5 Pro | Advanced model | 4096 | ✅ |

## Dependencies

### Production
- `@google/generative-ai@^0.24.1` - Latest Gemini SDK
- `@grpc/grpc-js@^1.13.4` - gRPC framework
- `@grpc/proto-loader@^0.8.0` - Protocol buffer loader
- `express@^5.1.0` - Latest Express.js
- `helmet@^8.1.0` - Security middleware
- `compression@^1.7.5` - Response compression
- `morgan@^1.10.0` - HTTP logging
- `groq-sdk@^0.34.0` - Groq AI support (future)
- `cors@^2.8.5` - CORS support
- `dotenv@^16.4.7` - Environment configuration

### Development
- `nodemon@^3.1.9` - Auto-reload for development

## Error Handling

The service provides detailed error messages:

```json
{
  "error": "API quota exceeded",
  "details": "You have exceeded your API quota limit"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `429` - Too many requests (rate limited)
- `500` - Internal server error

## Performance

- Request timeout: 2 minutes
- Max request size: 10MB
- Compression: Enabled
- Connection pooling: Enabled
- Graceful shutdown: Supported

## Monitoring

### Logs

The service logs all requests and errors:
```
🤖 Gemini Agent Request: { model: 'gemini-2.0-flash-exp', messageCount: 1 }
💻 Code Generation Request: { language: 'javascript', model: 'gemini-2.0-flash-exp' }
❌ Error in Gemini agent: [error details]
```

### Health Check

Monitor service health:
```bash
curl http://localhost:6000/health
```

## Security Best Practices

1. **API Key Management**
   - Store API keys in environment variables
   - Never commit `.env` files to version control
   - Use secrets management in production

2. **Network Security**
   - Use HTTPS in production
   - Configure CORS appropriately
   - Enable rate limiting

3. **Content Safety**
   - Safety filters are enabled by default
   - Responses are blocked if they violate guidelines
   - Review content before displaying to users

## Troubleshooting

### Common Issues

**Issue: "Invalid or missing API key"**
```bash
# Solution: Check your .env file
echo $GEMINI_API_KEY
```

**Issue: "API quota exceeded"**
```bash
# Solution: Check your Google Cloud quota or upgrade your plan
```

**Issue: "Content was blocked"**
```bash
# Solution: The content violated safety guidelines. Rephrase your request.
```

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
agent-service/
├── server.js           # HTTP REST API server
├── grpc-server.js      # gRPC service implementation
├── proto/
│   ├── agent.proto     # Service definitions
│   └── terminal.proto  # Terminal service proto
├── package.json        # Dependencies
├── Dockerfile          # Container configuration
└── README.md          # This file
```

## Contributing

When contributing to the agent service:

1. Update dependencies to latest stable versions
2. Test all endpoints thoroughly
3. Update documentation
4. Follow existing code style
5. Add appropriate error handling

## License

Part of the VelocIDE project.

## Support

For issues and questions:
- GitHub Issues: [project repository]
- Documentation: [link to docs]
- Email: support@velocide.com

---

**Last Updated:** January 30, 2025
**Version:** 2.0.0
**Maintainer:** VelocIDE Team
