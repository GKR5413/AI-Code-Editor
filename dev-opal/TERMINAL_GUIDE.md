# AI-IDE Terminal Implementation Guide

## Overview

This AI-IDE supports two terminal approaches for different use cases:

1. **Mac Terminal (Basic)** - Direct access to host system
2. **Docker Terminal (Recommended)** - Isolated container-based terminals

## Quick Start

### Option 1: Mac Terminal (Current)
```bash
npm run start           # Run with Mac terminal
```

### Option 2: Docker Terminal (Secure)
```bash
npm run start:docker    # Run with Docker containers
```

## Terminal Approaches Comparison

### Mac Terminal Approach
- **File**: `terminal-server.js`
- **Command**: `npm run terminal`
- **Pros**: Fast, direct file system access, local tools
- **Cons**: Security risk, no isolation, not scalable

### Docker Terminal Approach ⭐️ **Recommended**
- **File**: `docker-terminal-server.js` 
- **Command**: `npm run terminal:docker`
- **Pros**: Secure isolation, consistent environment, multi-user safe
- **Cons**: Slightly more resource usage

## Docker Terminal Features

### Security & Isolation
- Each terminal session runs in its own Docker container
- Isolated file systems prevent cross-contamination
- No access to host system files
- Memory and CPU limits per container

### Workspace Management
- Individual workspace directories per session
- Persistent storage for session files
- Automatic cleanup on disconnect
- Welcome files and sample code

### Container Specifications
- **Base Image**: Ubuntu 22.04
- **User**: `developer` (non-root)
- **Memory Limit**: 512MB
- **Tools Included**:
  - Node.js & npm
  - Python 3
  - Git
  - Vim/Nano editors
  - Build tools (gcc, g++, make)
  - Development utilities

### Network Security
- Containers have no network access (`NetworkMode: 'none'`)
- Prevents external connections for security
- Code compilation and execution only

## File Structure

```
/Users/spider_myan/Documents/AI-IDE/dev-opal/
├── terminal-server.js           # Mac terminal server
├── docker-terminal-server.js    # Docker terminal server
├── Dockerfile.terminal         # Container image definition
├── terminal-workspaces/        # Docker session workspaces
│   └── [session-id]/          # Individual session files
└── package.json               # Scripts for both approaches
```

## Usage Instructions

### Starting Docker Terminal Server

1. **Ensure Docker is running**:
   ```bash
   open -a "Docker Desktop"
   ```

2. **Build terminal image** (one-time setup):
   ```bash
   docker build -f Dockerfile.terminal -t ai-ide-terminal .
   ```

3. **Start the application**:
   ```bash
   npm run start:docker
   ```

### Managing Docker Containers

- **List active containers**:
  ```bash
  docker ps
  ```

- **Clean up all terminal containers**:
  ```bash
  docker stop $(docker ps -q --filter ancestor=ai-ide-terminal)
  docker rm $(docker ps -aq --filter ancestor=ai-ide-terminal)
  ```

- **View container logs**:
  ```bash
  docker logs <container-id>
  ```

## Development Commands

```bash
# Development with Mac terminal
npm run dev:full

# Development with Docker terminal  
npm run dev:docker

# Production with Mac terminal
npm run start

# Production with Docker terminal (recommended)
npm run start:docker

# Terminal servers only
npm run terminal           # Mac terminal
npm run terminal:docker    # Docker terminal
```

## Configuration

### Docker Container Limits
```javascript
// In docker-terminal-server.js
HostConfig: {
  Memory: 512 * 1024 * 1024,  // 512MB RAM limit
  CpuShares: 512,             // CPU limit
  NetworkMode: 'none',        // No network access
  ReadonlyRootfs: false,      // Allow file creation
}
```

### Session Management
- **Session ID**: Timestamp-based unique identifier
- **Workspace**: `/workspace` inside container
- **Host Path**: `./terminal-workspaces/[session-id]/`
- **Auto-cleanup**: On disconnect and server shutdown

## Troubleshooting

### Docker Issues
- **"Cannot connect to Docker daemon"**: Start Docker Desktop
- **"Image not found"**: Run `docker build` command
- **"Port already in use"**: Kill existing processes on port 3001

### Performance
- **Slow container startup**: Normal for first run, subsequent faster
- **Memory usage**: Each container uses ~50-100MB baseline
- **Cleanup**: Automatic on disconnect, manual cleanup available

## Security Considerations

### Docker Terminal (Secure)
✅ Isolated environments per session  
✅ No host system access  
✅ Resource limits prevent abuse  
✅ No network access  
✅ Non-root user execution  

### Mac Terminal (Insecure)
❌ Direct host system access  
❌ No user isolation  
❌ Potential system damage  
❌ Not suitable for production  

## Monitoring

The Docker terminal server provides comprehensive logging:
- Container creation/destruction
- Session management
- Resource usage
- Error tracking
- Automatic cleanup operations

## Future Enhancements

- [ ] Container resource monitoring dashboard
- [ ] Session persistence across server restarts  
- [ ] Language-specific container images
- [ ] Integration with compiler service
- [ ] File upload/download capabilities
- [ ] Collaborative terminal sessions