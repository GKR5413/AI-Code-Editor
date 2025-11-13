# 🚀 AI-Powered IDE - Integrated Container Setup

This guide explains how to run your AI-Powered IDE with fully integrated containers that share volumes for seamless file management, compilation, and terminal access.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IDE Frontend  │    │  Terminal       │    │   Compiler      │
│   (React/Vite)  │    │  Service        │    │   Service       │
│   Port: 8080    │    │  Port: 3003     │    │   Port: 3002    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────┬───────────┴───────────┬────────────┘
                      │                       │
              ┌───────▼───────┐      ┌───────▼───────┐
              │ Shared        │      │ File System   │
              │ Workspace     │      │ API           │
              │ Volume        │      │ Port: 3005    │
              └───────────────┘      └───────────────┘
```

## 🔧 Shared Volumes

### Workspace Integration
- **`shared_workspace`**: Main development workspace accessible by all containers
- **`shared_projects`**: User project files shared across IDE, terminal, and compiler
- **Real-time synchronization**: Changes made in any container are immediately visible in others

### Volume Mapping
```yaml
# IDE Container
/app/workspace  → shared_workspace
/app/projects   → shared_projects

# Terminal Container  
/workspace      → shared_workspace
/projects       → shared_projects

# Compiler Container
/workspace      → shared_workspace  
/projects       → shared_projects
```

## 🚀 Quick Start

### 1. Start the Integrated Environment
```bash
# Make sure you're in the project directory
cd /path/to/your/AI-IDE/dev-opal

# Run the integrated setup
./start-integrated-ide.sh
```

### 2. Alternative Manual Start
```bash
# Build and start all services
docker-compose -f docker-compose.integrated.yml up -d --build

# View logs
docker-compose -f docker-compose.integrated.yml logs -f
```

## 📱 Service Access

| Service | URL | Description |
|---------|-----|-------------|
| **IDE Interface** | http://localhost:8080 | Main IDE frontend |
| **Terminal Service** | http://localhost:3003 | Docker-based terminal |
| **Compiler Service** | http://localhost:3002 | Multi-language compiler |
| **File System API** | http://localhost:3005 | Shared workspace API |

## 💻 Usage Examples

### File Management
1. **Create files in IDE**: Files appear in terminal and compiler containers
2. **Edit in terminal**: `vim /workspace/myfile.js` - changes visible in IDE
3. **Compile code**: Compiler can access all workspace files

### Terminal Integration
```bash
# In your terminal container
cd /workspace           # Access shared workspace
cd /projects           # Access your projects
ls -la                 # See files created in IDE
```

### Compiler Integration
```bash
# Compile files from shared workspace
curl -X POST http://localhost:3002/compile \
  -H "Content-Type: application/json" \
  -d '{"language": "javascript", "code": "console.log(\"Hello World\")"}'
```

## 🛠️ Container Details

### IDE Container (`ide-app`)
- **Frontend**: React + Vite development server
- **File Manager**: Integrated with shared volumes
- **Ports**: 8080 (IDE), 3004 (File API)

### Terminal Container (`docker-terminal`) 
- **Base**: Node.js with Docker-in-Docker
- **Features**: Full development environment
- **Access**: Shared workspace at `/workspace` and `/projects`

### Compiler Container (`compiler`)
- **Languages**: 20+ programming languages
- **Compilers**: GCC, Node.js, Python, Java, Go, Rust, etc.
- **Workspace**: Direct access to shared files

### File System API (`file-system-api`)
- **Purpose**: Bridge between IDE and shared volumes  
- **Features**: File operations, directory listing
- **Security**: Path validation and access control

## 📁 Directory Structure in Containers

```
Container Filesystem:
├── /workspace/          # Shared workspace (volume)
├── /projects/           # User projects (volume)
│   ├── my-app/
│   ├── python-project/
│   └── ...
├── /app/                # Container-specific files
└── /tmp/                # Temporary files
```

## 🔧 Configuration

### Environment Variables
```bash
# IDE Container
WORKSPACE_PATH=/app/workspace
PROJECTS_PATH=/app/projects
VITE_COMPILER_SERVICE_URL=http://localhost:3002
VITE_TERMINAL_SERVICE_URL=http://localhost:3003

# Terminal Container
WORKSPACE_PATH=/workspace
PROJECTS_PATH=/projects
TERMINAL_CONTAINER_IMAGE=ai-ide-terminal-container:latest

# Compiler Container
WORKSPACE_PATH=/workspace
PROJECTS_PATH=/projects
OUTPUT_PATH=/app/output
```

### Volume Persistence
- **Workspace files**: Persist across container restarts
- **Project files**: Maintained in Docker volumes
- **Compilation cache**: Speeds up repeated builds

## 🔍 Troubleshooting

### Common Issues

1. **Services not starting**:
   ```bash
   docker-compose -f docker-compose.integrated.yml logs
   ```

2. **Volume mounting issues**:
   ```bash
   docker volume ls
   docker volume inspect dev-opal_shared_workspace
   ```

3. **Port conflicts**:
   ```bash
   # Check port usage
   lsof -i :8080
   lsof -i :3002
   lsof -i :3003
   lsof -i :3005
   ```

### Reset Environment
```bash
# Stop all containers
docker-compose -f docker-compose.integrated.yml down

# Remove volumes (⚠️ This deletes all workspace data)
docker volume prune

# Rebuild and restart
./start-integrated-ide.sh
```

## 🎯 Key Features

✅ **Seamless File Sharing**: All containers access the same workspace  
✅ **Real-time Sync**: Changes immediately visible across services  
✅ **Multi-language Compilation**: 20+ languages supported  
✅ **Docker Terminal**: Full development environment  
✅ **Persistent Storage**: Data survives container restarts  
✅ **Security**: Path validation and access controls  
✅ **Health Monitoring**: Built-in service health checks  

## 📈 Next Steps

1. **Custom Languages**: Add more compilers to the compiler service
2. **IDE Extensions**: Integrate language servers and linting
3. **Git Integration**: Add version control features
4. **Collaboration**: Multi-user workspace support
5. **Cloud Storage**: Backup and sync with cloud services

---

🎉 **Your integrated AI-Powered IDE is ready!** All containers now share the same workspace, providing a seamless development experience across file management, terminal access, and compilation.