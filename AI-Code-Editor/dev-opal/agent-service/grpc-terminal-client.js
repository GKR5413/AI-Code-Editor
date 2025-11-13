const { loadPackageDefinition } = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');
const path = require('path');

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, 'proto/terminal.proto');
const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const terminalProto = loadPackageDefinition(packageDefinition);

class GrpcTerminalClient {
  constructor(serverAddress = 'localhost:50051') {
    this.client = new terminalProto.terminal.TerminalService(
      serverAddress,
      require('@grpc/grpc-js').credentials.createInsecure()
    );
    this.serverAddress = serverAddress;
  }

  // Create a new terminal session
  createSession(sessionId, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        session_id: sessionId,
        shell: options.shell,
        working_directory: options.workingDirectory,
        environment: options.environment || {},
        cols: options.cols || 100,
        rows: options.rows || 30
      };

      this.client.createSession(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Execute a command in the terminal
  executeCommand(sessionId, command, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        session_id: sessionId,
        command: command,
        working_directory: options.workingDirectory,
        environment: options.environment || {}
      };

      this.client.executeCommand(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Get terminal output
  getOutput(sessionId, maxLines = 50) {
    return new Promise((resolve, reject) => {
      const request = {
        session_id: sessionId,
        max_lines: maxLines
      };

      this.client.getOutput(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Stream terminal output in real-time
  streamOutput(sessionId, follow = true, onData) {
    return new Promise((resolve, reject) => {
      const request = {
        session_id: sessionId,
        follow: follow
      };

      const stream = this.client.streamOutput(request);
      
      stream.on('data', (chunk) => {
        if (onData) {
          onData(chunk);
        }
      });

      stream.on('error', (error) => {
        reject(error);
      });

      stream.on('end', () => {
        resolve();
      });

      // Return the stream for manual control
      return stream;
    });
  }

  // List active terminal sessions
  listSessions() {
    return new Promise((resolve, reject) => {
      const request = {};

      this.client.listSessions(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Kill a terminal session
  killSession(sessionId) {
    return new Promise((resolve, reject) => {
      const request = {
        session_id: sessionId
      };

      this.client.killSession(request, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Helper method to execute a series of commands
  async executeCommands(sessionId, commands, options = {}) {
    const results = [];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(sessionId, command, options);
        results.push({
          command,
          success: result.success,
          output: result.output,
          error: result.error,
          exitCode: result.exit_code
        });
        
        // Wait a bit between commands
        if (options.delayBetweenCommands) {
          await new Promise(resolve => setTimeout(resolve, options.delayBetweenCommands));
        }
      } catch (error) {
        results.push({
          command,
          success: false,
          output: '',
          error: error.message,
          exitCode: -1
        });
      }
    }
    
    return results;
  }

  // Helper method to create a session and execute commands
  async createSessionAndExecute(sessionId, commands, options = {}) {
    try {
      // Create session
      const sessionResult = await this.createSession(sessionId, options);
      if (!sessionResult.success) {
        throw new Error(`Failed to create session: ${sessionResult.message}`);
      }

      // Execute commands
      const results = await this.executeCommands(sessionId, commands, options);
      
      return {
        sessionId,
        sessionCreated: true,
        commands: results
      };
    } catch (error) {
      throw error;
    }
  }

  // Close the gRPC client connection
  close() {
    if (this.client) {
      this.client.close();
    }
  }
}

module.exports = GrpcTerminalClient;
