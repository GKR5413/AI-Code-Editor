require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load protobuf definitions
const FRONTEND_PROTO_PATH = path.join(__dirname, './proto/frontend.proto');
const COMPILER_PROTO_PATH = path.join(__dirname, './proto/compiler.proto');
const AGENT_PROTO_PATH = path.join(__dirname, './proto/agent.proto');
const AUTH_PROTO_PATH = path.join(__dirname, './proto/auth.proto');

// Load all proto definitions
const frontendPackageDef = protoLoader.loadSync(FRONTEND_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const compilerPackageDef = protoLoader.loadSync(COMPILER_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const agentPackageDef = protoLoader.loadSync(AGENT_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const authPackageDef = protoLoader.loadSync(AUTH_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const frontendProto = grpc.loadPackageDefinition(frontendPackageDef);
const compilerProto = grpc.loadPackageDefinition(compilerPackageDef);
const agentProto = grpc.loadPackageDefinition(agentPackageDef);
const authProto = grpc.loadPackageDefinition(authPackageDef);

class FrontendGatewayServer {
  constructor() {
    this.server = new grpc.Server();
    this.setupClients();
    this.setupServices();
  }

  setupClients() {
    // Initialize gRPC clients for backend services
    this.compilerClient = new compilerProto.compiler.CompilerService(
      process.env.COMPILER_GRPC_URL || 'compiler:50052',
      grpc.credentials.createInsecure()
    );

    this.agentClient = new agentProto.agent.AgentService(
      process.env.AGENT_GRPC_URL || 'agent:50053',
      grpc.credentials.createInsecure()
    );

    this.authClient = new authProto.auth.AuthService(
      process.env.AUTH_GRPC_URL || 'auth-service:50054',
      grpc.credentials.createInsecure()
    );
  }

  setupServices() {
    this.server.addService(frontendProto.frontend.FrontendGatewayService.service, {
      HealthCheck: this.healthCheck.bind(this),
      
      // Agent service proxying
      SendMessageToAgent: this.sendMessageToAgent.bind(this),
      StreamConversationWithAgent: this.streamConversationWithAgent.bind(this),
      GenerateCode: this.generateCode.bind(this),
      
      // Compiler service proxying
      CompileCode: this.compileCode.bind(this),
      RunCode: this.runCode.bind(this),
      StreamExecution: this.streamExecution.bind(this),
      GetSupportedLanguages: this.getSupportedLanguages.bind(this),
      
      // File operations
      ListFiles: this.listFiles.bind(this),
      ReadFile: this.readFile.bind(this),
      WriteFile: this.writeFile.bind(this),
      DeleteFile: this.deleteFile.bind(this),
      CreateDirectory: this.createDirectory.bind(this),
      
      // Authentication proxying
      Login: this.login.bind(this),
      Register: this.register.bind(this),
      Logout: this.logout.bind(this),
      ValidateToken: this.validateToken.bind(this),
      
      // System operations
      GetSystemStatus: this.getSystemStatus.bind(this)
    });
  }

  // Health check
  async healthCheck(call, callback) {
    try {
      // Check health of all backend services
      const healthChecks = await Promise.allSettled([
        this.checkServiceHealth(this.compilerClient, 'compiler'),
        this.checkServiceHealth(this.agentClient, 'agent'),
        this.checkServiceHealth(this.authClient, 'auth')
      ]);

      const services = {};
      let allHealthy = true;

      healthChecks.forEach((result, index) => {
        const serviceName = ['compiler', 'agent', 'auth'][index];
        if (result.status === 'fulfilled') {
          services[serviceName] = result.value.healthy ? 'healthy' : 'unhealthy';
          if (!result.value.healthy) allHealthy = false;
        } else {
          services[serviceName] = 'unreachable';
          allHealthy = false;
        }
      });

      callback(null, {
        healthy: allHealthy,
        message: allHealthy ? 'All services healthy' : 'Some services unhealthy',
        services: services
      });
    } catch (error) {
      callback(null, {
        healthy: false,
        message: 'Health check failed',
        services: {}
      });
    }
  }

  // Agent service methods
  sendMessageToAgent(call, callback) {
    this.agentClient.SendMessage(call.request, callback);
  }

  streamConversationWithAgent(call) {
    const stream = this.agentClient.StreamConversation(call.request);
    stream.on('data', (chunk) => call.write(chunk));
    stream.on('error', (error) => call.emit('error', error));
    stream.on('end', () => call.end());
  }

  generateCode(call, callback) {
    this.agentClient.GenerateCode(call.request, callback);
  }

  // Compiler service methods
  compileCode(call, callback) {
    this.compilerClient.CompileCode(call.request, callback);
  }

  runCode(call, callback) {
    this.compilerClient.RunCode(call.request, callback);
  }

  streamExecution(call) {
    const stream = this.compilerClient.StreamExecution(call.request);
    stream.on('data', (chunk) => call.write(chunk));
    stream.on('error', (error) => call.emit('error', error));
    stream.on('end', () => call.end());
  }

  getSupportedLanguages(call, callback) {
    this.compilerClient.GetSupportedLanguages(call.request, callback);
  }

  // File operation methods
  listFiles(call, callback) {
    this.compilerClient.ListFiles(call.request, callback);
  }

  readFile(call, callback) {
    this.compilerClient.ReadFile(call.request, callback);
  }

  writeFile(call, callback) {
    this.compilerClient.WriteFile(call.request, callback);
  }

  deleteFile(call, callback) {
    this.compilerClient.DeleteFile(call.request, callback);
  }

  createDirectory(call, callback) {
    this.compilerClient.CreateDirectory(call.request, callback);
  }

  // Authentication methods
  login(call, callback) {
    this.authClient.Login(call.request, callback);
  }

  register(call, callback) {
    this.authClient.Register(call.request, callback);
  }

  logout(call, callback) {
    this.authClient.Logout(call.request, callback);
  }

  validateToken(call, callback) {
    this.authClient.ValidateToken(call.request, callback);
  }

  // System status
  async getSystemStatus(call, callback) {
    try {
      const timestamp = Date.now();
      
      // Get health status of all services
      const healthChecks = await Promise.allSettled([
        this.checkServiceHealth(this.compilerClient, 'compiler'),
        this.checkServiceHealth(this.agentClient, 'agent'),
        this.checkServiceHealth(this.authClient, 'auth')
      ]);

      const services = {};
      let overallHealthy = true;

      healthChecks.forEach((result, index) => {
        const serviceName = ['compiler', 'agent', 'auth'][index];
        if (result.status === 'fulfilled') {
          services[serviceName] = {
            healthy: result.value.healthy,
            status: result.value.healthy ? 'running' : 'error',
            version: '1.0.0',
            uptime: Date.now() - (timestamp - 3600000), // Mock uptime
            error: result.value.healthy ? '' : 'Service unhealthy'
          };
          if (!result.value.healthy) overallHealthy = false;
        } else {
          services[serviceName] = {
            healthy: false,
            status: 'unreachable',
            version: 'unknown',
            uptime: 0,
            error: result.reason?.message || 'Service unreachable'
          };
          overallHealthy = false;
        }
      });

      // Mock system metrics
      const metrics = {
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
        disk_usage: Math.random() * 100,
        active_sessions: Math.floor(Math.random() * 50),
        total_requests: Math.floor(Math.random() * 10000)
      };

      callback(null, {
        healthy: overallHealthy,
        services: services,
        metrics: metrics,
        timestamp: timestamp
      });
    } catch (error) {
      callback(null, {
        healthy: false,
        services: {},
        metrics: null,
        timestamp: Date.now()
      });
    }
  }

  // Helper methods
  async checkServiceHealth(client, serviceName) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${serviceName} health check timeout`));
      }, 5000);

      client.HealthCheck({}, (error, response) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  start(port = 50051) {
    const bindAddress = `0.0.0.0:${port}`;
    this.server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        console.error('Failed to start Frontend Gateway gRPC server:', error);
        return;
      }
      console.log(`🚀 Frontend Gateway gRPC server listening on port ${port}`);
      console.log(`🔗 Connected to services:`);
      console.log(`  - Compiler: ${process.env.COMPILER_GRPC_URL || 'compiler:50052'}`);
      console.log(`  - Agent: ${process.env.AGENT_GRPC_URL || 'agent:50053'}`);
      console.log(`  - Auth: ${process.env.AUTH_GRPC_URL || 'auth-service:50054'}`);
      this.server.start();
    });
  }

  stop() {
    // Close client connections
    this.compilerClient?.close();
    this.agentClient?.close();
    this.authClient?.close();

    this.server.tryShutdown(() => {
      console.log('Frontend Gateway gRPC server stopped');
    });
  }
}

// Start the server
if (require.main === module) {
  const server = new FrontendGatewayServer();
  server.start(process.env.GRPC_PORT || 50051);

  // Also start gRPC-Web proxy if enabled
  if (process.env.GRPC_WEB_PORT) {
    const { fork } = require('child_process');
    const webProxyProcess = fork(path.join(__dirname, 'grpc-web-proxy.js'), [], {
      env: {
        ...process.env,
        GRPC_TARGET: `http://localhost:${process.env.GRPC_PORT || 50051}`
      }
    });

    webProxyProcess.on('error', (error) => {
      console.error('gRPC-Web proxy error:', error);
    });

    // Graceful shutdown for both services
    const shutdown = () => {
      console.log('\n🛑 Shutting down Frontend Gateway services...');
      server.stop();
      webProxyProcess.kill();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } else {
    // Graceful shutdown for gRPC server only
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Frontend Gateway gRPC server...');
      server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down Frontend Gateway gRPC server...');
      server.stop();
      process.exit(0);
    });
  }
}

module.exports = FrontendGatewayServer;