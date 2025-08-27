# gRPC Integration: Gemini 2.5 ↔ Terminal Communication

This document describes the implementation of gRPC communication between the Gemini 2.5 AI agent and the terminal service, enabling seamless AI-driven terminal operations.

## 🏗️ Architecture Overview

```
┌─────────────────┐    gRPC     ┌──────────────────┐    HTTP/WS    ┌─────────────────┐
│   Gemini 2.5    │ ──────────→ │  gRPC Terminal  │ ────────────→ │   Frontend      │
│   Agent         │              │   Service       │               │   Terminal      │
└─────────────────┘              └──────────────────┘              └─────────────────┘
         │                                │
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌──────────────────┐
│   Agent API     │              │   Terminal       │
│   Endpoints     │              │   Sessions       │
└─────────────────┘              └──────────────────┘
```

## 🚀 Key Features

- **Real-time Communication**: gRPC enables low-latency, bidirectional communication
- **Terminal Session Management**: Create, manage, and destroy terminal sessions
- **Command Execution**: Execute shell commands with full output capture
- **Streaming Output**: Real-time terminal output streaming
- **AI Integration**: Gemini 2.5 can control terminal operations directly
- **Code Generation & Execution**: Generate code and execute it in terminal

## 📁 File Structure

```
dev-opal/
├── proto/
│   └── terminal.proto              # gRPC service definition
├── grpc-terminal-server.js         # gRPC terminal server
├── agent-service/
│   ├── grpc-terminal-client.js     # gRPC client for agent
│   └── server.js                   # Updated agent service
├── Dockerfile.grpc-terminal        # Docker image for gRPC service
├── docker-compose.yml              # Updated with gRPC services
└── test-grpc-communication.js      # Test script
```

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
# In agent-service directory
cd dev-opal/agent-service
npm install @grpc/grpc-js @grpc/proto-loader

# In root directory
cd dev-opal
npm install @grpc/grpc-js @grpc/proto-loader
```

### 2. Environment Variables

Create a `.env` file in the `agent-service` directory:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
TERMINAL_GRPC_URL=grpc-terminal:50051
WORKSPACE_PATH=/workspace
```

### 3. Start Services

```bash
# Start all services including gRPC
docker-compose up -d

# Or start specific services
docker-compose up grpc-terminal agent -d
```

## 📡 gRPC Service Definition

### Terminal Service Methods

```protobuf
service TerminalService {
  // Create a new terminal session
  rpc CreateSession(SessionRequest) returns (SessionResponse);
  
  // Execute a command in the terminal
  rpc ExecuteCommand(CommandRequest) returns (CommandResponse);
  
  // Get terminal output
  rpc GetOutput(OutputRequest) returns (OutputResponse);
  
  // Stream real-time terminal output
  rpc StreamOutput(StreamRequest) returns (stream OutputChunk);
  
  // List active terminal sessions
  rpc ListSessions(ListSessionsRequest) returns (ListSessionsResponse);
  
  // Kill a terminal session
  rpc KillSession(KillSessionRequest) returns (KillSessionResponse);
}
```

## 🎯 Usage Examples

### 1. Basic Terminal Control

```javascript
const GrpcTerminalClient = require('./grpc-terminal-client');

const client = new GrpcTerminalClient('localhost:50051');

// Create session
const session = await client.createSession('my-session', {
  shell: 'bash',
  workingDirectory: '/workspace'
});

// Execute command
const result = await client.executeCommand('my-session', 'ls -la');
console.log(result.output);

// Clean up
await client.killSession('my-session');
```

### 2. Gemini Agent with Terminal Integration

```javascript
// POST /api/agent
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    { "role": "user", "content": "Check the current directory and list files" }
  ],
  "terminalCommands": [
    "pwd",
    "ls -la"
  ]
}
```

### 3. Code Generation and Execution

```javascript
// POST /api/gemini/code-execute
{
  "prompt": "Create a Python script that prints hello world",
  "language": "python",
  "executeInTerminal": true
}
```

## 🔌 API Endpoints

### Agent Service Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Main Gemini agent endpoint with terminal integration |
| `/api/terminal/session` | POST | Create terminal session |
| `/api/terminal/execute` | POST | Execute command in terminal |
| `/api/terminal/sessions` | GET | List active sessions |
| `/api/terminal/session/:id` | DELETE | Kill session |
| `/api/gemini/code-execute` | POST | Generate and execute code |

### gRPC Terminal Service

- **Port**: 50051
- **Protocol**: gRPC
- **Authentication**: None (internal network)
- **Health Check**: Available

## 🧪 Testing

### Run Test Suite

```bash
# Make script executable
chmod +x test-grpc-communication.js

# Run tests
node test-grpc-communication.js
```

### Manual Testing

```bash
# Test gRPC terminal service
curl -X POST http://localhost:6000/api/terminal/session \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "options": {"shell": "bash"}}'

# Test Gemini agent
curl -X POST http://localhost:6000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}], "terminalCommands": ["echo hello"]}'
```

## 🐳 Docker Configuration

### Services

- **grpc-terminal**: gRPC terminal service (port 50051)
- **agent**: Gemini agent service with gRPC client (port 6000)
- **docker-terminal**: HTTP/WebSocket terminal service (port 3003)

### Network

All services communicate through the `ide-network` bridge network.

### Volumes

- `shared_workspace`: Accessible by all services
- `shared_projects`: User project files
- `terminal_sessions`: Session persistence

## 🔒 Security Considerations

- gRPC communication is internal (Docker network)
- No external access to gRPC port
- Terminal sessions run with limited permissions
- Environment variables for sensitive configuration

## 🚨 Troubleshooting

### Common Issues

1. **gRPC Connection Failed**
   - Check if `grpc-terminal` service is running
   - Verify network connectivity in Docker
   - Check logs: `docker-compose logs grpc-terminal`

2. **Terminal Commands Not Executing**
   - Verify session exists
   - Check working directory permissions
   - Review terminal service logs

3. **Gemini API Errors**
   - Verify `GEMINI_API_KEY` is set
   - Check API quota and limits
   - Review agent service logs

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f grpc-terminal
docker-compose logs -f agent
```

## 🔮 Future Enhancements

- **Authentication**: Add gRPC authentication
- **Rate Limiting**: Implement command execution limits
- **Session Persistence**: Save terminal state across restarts
- **Multi-language Support**: Support for more programming languages
- **File Operations**: Direct file manipulation through gRPC
- **Real-time Collaboration**: Multiple agents sharing terminal sessions

## 📚 Additional Resources

- [gRPC Documentation](https://grpc.io/docs/)
- [Google Generative AI](https://ai.google.dev/)
- [Node.js gRPC](https://grpc.io/docs/languages/node/)
- [Docker Compose](https://docs.docker.com/compose/)

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Test with Docker environment
5. Submit pull request with detailed description

---

**Note**: This integration provides a powerful foundation for AI-driven development workflows, enabling Gemini 2.5 to directly interact with the development environment through secure, efficient gRPC communication.
