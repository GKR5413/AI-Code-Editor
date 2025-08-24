# Docker Terminal Setup Guide 🐳

This guide will help you get the Docker terminal working in your AI-IDE.

## 🚨 Current Issues Fixed

1. **Missing Docker Images**: The terminal server was trying to use non-existent images
2. **Port Conflicts**: Both terminal servers were trying to use port 3001
3. **Missing Build Process**: Terminal container images weren't being built
4. **Configuration Issues**: Docker Compose wasn't properly configured

## 🔧 Quick Fix Steps

### Step 1: Build the Terminal Container Image

```bash
# Make sure you're in the dev-opal directory
cd dev-opal

# Build the terminal container image
./build-terminal-image.sh

# Or manually:
docker build -f Dockerfile.terminal-container -t ai-ide-terminal-container:latest .
```

### Step 2: Start the Docker IDE

```bash
# Option A: Use the startup script (recommended)
npm run start:docker:full

# Option B: Manual Docker Compose
docker-compose up --build

# Option C: Build and start separately
npm run docker:build
npm run docker:up
```

### Step 3: Access the IDE

- **IDE**: http://localhost:5173
- **Terminal Service**: http://localhost:3003
- **Compiler Service**: http://localhost:3002

## 🐳 Docker Services Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   IDE App       │    │  Docker Terminal │    │   Compiler      │
│   (Port 5173)   │◄──►│  (Port 3001)     │◄──►│   (Port 3002)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ Terminal        │              │
         │              │ Containers      │              │
         │              │ (Isolated)      │              │
         │              └─────────────────┘              │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File System   │    │  Workspace       │    │   Build Output  │
│   Operations    │    │  Directories     │    │   & Temp Files  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📁 File Structure

```
dev-opal/
├── Dockerfile.terminal              # Terminal service container
├── Dockerfile.terminal-container    # Terminal session containers
├── docker-terminal-server.js        # Docker terminal server
├── docker-compose.yml               # Service orchestration
├── terminal-workspaces/             # User workspace directories
├── start-docker-ide.js             # Docker startup script
└── build-terminal-image.sh         # Image build script
```

## 🚀 Available Commands

### NPM Scripts
```bash
# Docker IDE (recommended)
npm run start:docker:full          # Start complete Docker IDE
npm run docker:build               # Build all Docker images
npm run docker:up                  # Start Docker services
npm run docker:down                # Stop Docker services
npm run docker:logs                # View service logs

# Local Development
npm run dev:full                   # Start local IDE + terminal
npm run start                      # Start with custom script
```

### Docker Commands
```bash
# Build images
docker build -f Dockerfile.terminal-container -t ai-ide-terminal-container:latest .
docker build -f Dockerfile.terminal -t ai-ide-terminal:latest .

# View running containers
docker ps

# View logs
docker-compose logs -f docker-terminal

# Clean up
docker-compose down
docker system prune -f
```

## 🔍 Troubleshooting

### Problem: "Image not found" error
**Solution**: Build the terminal container image first
```bash
./build-terminal-image.sh
```

### Problem: Port 3003 already in use
**Solution**: Stop conflicting services
```bash
# Kill processes on port 3003
kill-port 3003

# Or stop Docker services
docker-compose down
```

### Problem: Permission denied for Docker socket
**Solution**: Ensure Docker is running and you have permissions
```bash
# Check Docker status
docker info

# Fix permissions (if needed)
sudo chmod 666 /var/run/docker.sock
```

### Problem: Terminal containers not starting
**Solution**: Check Docker logs and rebuild
```bash
# View logs
docker-compose logs docker-terminal

# Rebuild and restart
docker-compose down
docker-compose up --build
```

### Problem: IDE can't connect to terminal
**Solution**: Check service health and network
```bash
# Check terminal service health
curl http://localhost:3003/health

# Check Docker network
docker network ls
docker network inspect dev-opal_ide-network
```

## 🧪 Testing the Setup

### 1. Health Check
```bash
curl http://localhost:3003/health
# Should return: {"status":"ok","message":"Docker terminal server is running"}
```

### 2. WebSocket Connection
```bash
# Test WebSocket connection
wscat -c ws://localhost:3003
# Should connect and show connection message
```

### 3. Container Creation
```bash
# Check if containers are being created
docker ps -a | grep ai-ide-terminal-container
```

## 🔒 Security Features

- **Process Isolation**: Each terminal session runs in isolated container
- **Resource Limits**: 512MB memory, CPU limits per session
- **Network Isolation**: No network access by default
- **User Isolation**: Non-root user in containers
- **Workspace Isolation**: Separate directories per session

## 📊 Performance Monitoring

### Resource Usage
```bash
# Monitor container resources
docker stats

# View container logs
docker-compose logs -f docker-terminal

# Check workspace usage
du -sh terminal-workspaces/*
```

### Health Monitoring
```bash
# Service health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Container status
docker-compose ps
```

## 🚀 Advanced Configuration

### Custom Terminal Images
Edit `Dockerfile.terminal-container` to add more tools:
```dockerfile
# Add custom packages
RUN apt-get install -y \
    your-package \
    another-package

# Add custom configurations
COPY custom-config /etc/custom-config
```

### Resource Limits
Modify limits in `docker-terminal-server.js`:
```javascript
HostConfig: {
  Memory: 1024 * 1024 * 1024, // 1GB limit
  CpuShares: 1024, // Higher CPU priority
  // ... other settings
}
```

### Network Access
Enable network access for specific containers:
```javascript
HostConfig: {
  NetworkMode: 'bridge', // Enable network access
  // ... other settings
}
```

## 📝 Troubleshooting Checklist

- [ ] Docker is running (`docker info`)
- [ ] Terminal container image is built (`docker images | grep ai-ide-terminal`)
- [ ] Port 3003 is available (`lsof -i :3003`)
- [ ] Docker socket permissions are correct
- [ ] Services are healthy (`curl http://localhost:3003/health`)
- [ ] WebSocket connection works
- [ ] Containers are being created
- [ ] IDE can connect to terminal service

## 🆘 Getting Help

If you're still having issues:

1. **Check the logs**: `docker-compose logs -f`
2. **Verify Docker setup**: `docker info`
3. **Check service health**: `curl http://localhost:3001/health`
4. **Review this guide**: Look for your specific error
5. **Check file permissions**: Ensure scripts are executable

## 🎯 Expected Behavior

After successful setup:
- ✅ Terminal service shows "Online" status
- ✅ WebSocket connection established
- ✅ New terminal sessions create isolated containers
- ✅ Commands execute in container environment
- ✅ Workspace files persist between sessions
- ✅ Resource limits enforced per session

---

**Happy Coding with Docker Terminals! 🐳💻**
