# VelocIDE Local Setup Guide

This guide will help you set up and run VelocIDE locally with all AI providers configured.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development)
- API keys from AI providers (optional, but recommended)

## 🔑 API Keys Setup

VelocIDE supports 6 AI providers. You can use one or all of them.

### 1. Get Your API Keys

#### Gemini (Google AI)
- Visit: https://aistudio.google.com/app/apikey
- Add your key to `.env.docker`: `GEMINI_API_KEY=your_key_here`

#### Groq
- Visit: https://console.groq.com/
- Add your key to `.env.docker`: `GROQ_API_KEY=your_key_here`

#### Claude (Anthropic) - **Optional**
- Visit: https://console.anthropic.com/
- Models: Claude 3.5 Sonnet, Opus, Haiku

#### OpenAI - **Optional**
- Visit: https://platform.openai.com/api-keys
- Models: GPT-4, GPT-4o, GPT-3.5

#### Mistral AI - **Optional**
- Visit: https://console.mistral.ai/
- Models: Mistral Large, Medium, Small

#### Cohere - **Optional**
- Visit: https://dashboard.cohere.com/api-keys
- Models: Command R+, Command

### 2. Configure Environment Files

The following files have been created for you:

#### ✅ Already Configured Files:

1. **`agent-service/.env`** - Multi-AI agent configuration
   - Gemini and Groq keys already set
   - Add other provider keys if needed

2. **`claude-agent-service/.env`** - Claude-specific service
   - Add your Claude API key here to use Claude

3. **`.env.docker`** - Docker Compose environment
   - Gemini and Groq keys already set
   - Shared across all containers

## 🚀 Running the Application

### Option 1: Docker Compose (Recommended)

```bash
# Navigate to the dev-opal directory
cd AI-Code-Editor/dev-opal

# Start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Local Development (Frontend only)

```bash
# Navigate to the dev-opal directory
cd AI-Code-Editor/dev-opal

# Install dependencies
npm install

# Start the frontend
npm run dev

# In separate terminals, start backend services:
# Terminal 2: Agent Service
cd agent-service && npm install && npm start

# Terminal 3: Claude Agent Service (optional)
cd claude-agent-service && npm install && npm start

# Terminal 4: Auth Service
cd auth-service && npm install && npm start
```

## 🌐 Access the Application

Once running, access the IDE at:
- **Frontend**: http://localhost:5173
- **Agent Service**: http://localhost:6000
- **Claude Agent**: http://localhost:6001
- **Auth Service**: http://localhost:3010
- **Compiler**: http://localhost:3002

## 🔧 Service Ports

| Service | HTTP Port | gRPC Port | WebSocket |
|---------|-----------|-----------|-----------|
| Frontend | 5173 | - | - |
| Agent (Multi-AI) | 6000 | 50053 | - |
| Claude Agent | 6001 | - | - |
| Auth Service | 3010 | 50054 | - |
| Compiler | 3002 | 50052 | - |
| Terminal | - | 50051 | 3003 |
| Frontend Gateway | 8080 | 50051 | - |

## 📝 Adding More API Keys

To add additional AI provider keys:

1. **Edit `.env.docker`**:
   ```bash
   CLAUDE_API_KEY=your_claude_key_here
   OPENAI_API_KEY=your_openai_key_here
   MISTRAL_API_KEY=your_mistral_key_here
   COHERE_API_KEY=your_cohere_key_here
   ```

2. **Edit `agent-service/.env`**:
   - Same as above

3. **Edit `claude-agent-service/.env`** (for Claude):
   ```bash
   CLAUDE_API_KEY=your_claude_key_here
   ```

4. **Restart services**:
   ```bash
   docker-compose restart agent claude-agent
   ```

## 🎯 Testing AI Providers

Once running, you can test each AI provider:

### Gemini (Default)
- Already configured and working
- Fastest for most tasks
- Best for code generation

### Groq
- Already configured and working
- Ultra-fast inference
- Great for quick responses

### Claude (if configured)
- Best for complex reasoning
- Excellent code review
- Vision API for image analysis

### OpenAI (if configured)
- GPT-4o for advanced tasks
- GPT-3.5 for quick responses

## 🛠️ Troubleshooting

### Issue: Services won't start
```bash
# Check if ports are already in use
lsof -i :5173
lsof -i :6000

# Kill processes if needed
kill -9 <PID>
```

### Issue: API keys not working
```bash
# Verify environment variables are loaded
docker-compose config

# Check service logs
docker-compose logs agent
docker-compose logs claude-agent
```

### Issue: "API key invalid" error
- Verify your API key is correct in `.env.docker`
- Make sure there are no extra spaces or quotes
- Restart the service: `docker-compose restart agent`

## 📚 Features

With VelocIDE running locally, you can:

✅ **Code Editing**
- Monaco Editor (VS Code engine)
- Multi-language syntax highlighting
- IntelliSense and autocomplete

✅ **AI Assistance**
- Code generation with 6 AI providers
- Code review and suggestions
- Terminal command execution via AI

✅ **Code Execution**
- Compile and run 20+ languages
- Sandboxed Docker containers
- Real-time output

✅ **Terminal**
- Full Docker-based terminal
- Workspace synchronization
- Multiple terminal sessions

✅ **Authentication**
- GitHub OAuth
- Email/password registration
- JWT sessions

## 🔒 Security Notes

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Keep API keys secure** - Rotate them regularly
3. **Use different keys** - Separate dev and production keys
4. **Monitor usage** - Check API provider dashboards for costs
5. **Rate limiting** - Built-in to prevent abuse

## 💡 Tips

1. **Start with Gemini** - Already configured, free tier available
2. **Add Groq** - Already configured, very fast inference
3. **Claude for quality** - Best for complex reasoning tasks
4. **Test locally first** - Before deploying to production
5. **Check logs** - Use `docker-compose logs -f` to debug

## 📖 Additional Documentation

- Main README: `README.md`
- gRPC Integration: `GRPC_INTEGRATION_README.md`
- GitHub Setup: `GITHUB_SETUP.md`
- AI SDK Upgrade: `AI_SDK_UPGRADE_SUMMARY.md`

## 🤝 Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f [service-name]`
2. Verify API keys are set correctly
3. Ensure all ports are available
4. Check Docker is running properly

## 🎉 You're Ready!

Your VelocIDE is now configured with:
- ✅ Gemini API (ready to use)
- ✅ Groq API (ready to use)
- 🔧 Claude API (add your key)
- 🔧 OpenAI API (add your key)
- 🔧 Mistral API (add your key)
- 🔧 Cohere API (add your key)

Run `docker-compose up --build` to start coding! 🚀
