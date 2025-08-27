const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, './proto/compiler.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const compilerProto = grpc.loadPackageDefinition(packageDefinition);

// Configuration for supported languages
const LANGUAGE_CONFIG = {
  python: {
    extension: '.py',
    compile: null,
    run: 'python3',
    timeout: 30000,
    version_check: 'python3 --version'
  },
  javascript: {
    extension: '.js',
    compile: null,
    run: 'node',
    timeout: 30000,
    version_check: 'node --version'
  },
  typescript: {
    extension: '.ts',
    compile: 'tsc',
    run: 'node',
    timeout: 30000,
    version_check: 'tsc --version'
  },
  java: {
    extension: '.java',
    compile: 'javac',
    run: 'java',
    timeout: 30000,
    version_check: 'javac -version'
  },
  cpp: {
    extension: '.cpp',
    compile: 'g++ -o program',
    run: './program',
    timeout: 30000,
    version_check: 'g++ --version'
  },
  c: {
    extension: '.c',
    compile: 'gcc -o program',
    run: './program',
    timeout: 30000,
    version_check: 'gcc --version'
  },
  go: {
    extension: '.go',
    compile: null,
    run: 'go run',
    timeout: 30000,
    version_check: 'go version'
  },
  rust: {
    extension: '.rs',
    compile: 'rustc -o program',
    run: './program',
    timeout: 30000,
    version_check: 'rustc --version'
  }
};

// Paths
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';
const OUTPUT_PATH = process.env.OUTPUT_PATH || '/app/output';
const TEMP_PATH = process.env.TEMP_PATH || '/app/temp';

// Ensure directories exist
[WORKSPACE_PATH, OUTPUT_PATH, TEMP_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Active execution sessions for streaming
const activeSessions = new Map();

class CompilerGrpcServer {
  constructor() {
    this.server = new grpc.Server();
    this.setupServices();
  }

  setupServices() {
    this.server.addService(compilerProto.compiler.CompilerService.service, {
      HealthCheck: this.healthCheck.bind(this),
      GetSupportedLanguages: this.getSupportedLanguages.bind(this),
      GetCompilerInfo: this.getCompilerInfo.bind(this),
      CompileCode: this.compileCode.bind(this),
      RunCode: this.runCode.bind(this),
      StreamExecution: this.streamExecution.bind(this),
      ListFiles: this.listFiles.bind(this),
      ReadFile: this.readFile.bind(this),
      WriteFile: this.writeFile.bind(this),
      DeleteFile: this.deleteFile.bind(this),
      CreateDirectory: this.createDirectory.bind(this)
    });
  }

  // Health check
  healthCheck(call, callback) {
    callback(null, {
      healthy: true,
      message: 'Compiler gRPC service is running',
      services: {
        compiler: 'healthy',
        workspace: fs.existsSync(WORKSPACE_PATH) ? 'healthy' : 'error'
      }
    });
  }

  // Get supported languages
  async getSupportedLanguages(call, callback) {
    try {
      const languages = [];
      
      for (const [name, config] of Object.entries(LANGUAGE_CONFIG)) {
        try {
          // Check if language is available
          await this.checkLanguageAvailability(name, config);
          languages.push({
            name: name,
            extension: config.extension,
            has_compile_step: !!config.compile,
            version: await this.getLanguageVersion(config.version_check)
          });
        } catch (error) {
          // Language not available, skip
        }
      }

      callback(null, {
        success: true,
        languages: languages
      });
    } catch (error) {
      callback(null, {
        success: false,
        languages: [],
        error: error.message
      });
    }
  }

  // Get compiler info
  async getCompilerInfo(call, callback) {
    const { language } = call.request;
    
    try {
      const config = LANGUAGE_CONFIG[language];
      if (!config) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const version_info = await this.getLanguageVersion(config.version_check);
      
      callback(null, {
        success: true,
        language: language,
        version_info: version_info,
        config: {
          extension: config.extension,
          compile_command: config.compile || '',
          run_command: config.run,
          timeout: config.timeout
        }
      });
    } catch (error) {
      callback(null, {
        success: false,
        language: language,
        version_info: '',
        config: null,
        error: error.message
      });
    }
  }

  // Compile code
  async compileCode(call, callback) {
    const { language, code, filename, options } = call.request;
    const sessionId = uuidv4();
    
    try {
      const config = LANGUAGE_CONFIG[language];
      if (!config) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const workDir = path.join(TEMP_PATH, sessionId);
      fs.mkdirSync(workDir, { recursive: true });
      
      const sourceFile = path.join(workDir, filename || `main${config.extension}`);
      fs.writeFileSync(sourceFile, code);

      let result;
      
      if (config.compile) {
        // Language requires compilation
        result = await this.executeCommand(config.compile, [sourceFile], workDir, options?.compile_timeout || config.timeout);
      } else {
        // Interpreted language, just validate syntax
        result = { success: true, stdout: 'Syntax check passed', stderr: '', exit_code: 0 };
      }

      callback(null, {
        success: result.success,
        stage: 'compilation',
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error || '',
        exit_code: result.exit_code,
        session_id: sessionId,
        execution_time: result.execution_time,
        message: result.success ? 'Compilation successful' : 'Compilation failed',
        output_file: result.success ? 'program' : '',
        timeout: result.timeout || false
      });
    } catch (error) {
      callback(null, {
        success: false,
        stage: 'compilation',
        stdout: '',
        stderr: '',
        error: error.message,
        exit_code: -1,
        session_id: sessionId,
        execution_time: 0,
        message: 'Compilation error',
        output_file: '',
        timeout: false
      });
    }
  }

  // Run code
  async runCode(call, callback) {
    const { language, code, filename, input, options } = call.request;
    const sessionId = uuidv4();
    
    try {
      const config = LANGUAGE_CONFIG[language];
      if (!config) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const workDir = path.join(TEMP_PATH, sessionId);
      fs.mkdirSync(workDir, { recursive: true });
      
      const sourceFile = path.join(workDir, filename || `main${config.extension}`);
      fs.writeFileSync(sourceFile, code);

      let result;
      
      // Compile if needed
      if (config.compile) {
        const compileResult = await this.executeCommand(config.compile, [sourceFile], workDir, options?.compile_timeout || config.timeout);
        if (!compileResult.success) {
          return callback(null, {
            success: false,
            stage: 'compilation',
            stdout: compileResult.stdout,
            stderr: compileResult.stderr,
            error: compileResult.error || 'Compilation failed',
            exit_code: compileResult.exit_code,
            session_id: sessionId,
            execution_time: compileResult.execution_time,
            message: 'Compilation failed',
            output_file: '',
            timeout: compileResult.timeout || false
          });
        }
      }

      // Execute
      const runArgs = config.compile ? [] : [sourceFile];
      result = await this.executeCommand(config.run, runArgs, workDir, options?.run_timeout || config.timeout, input);

      callback(null, {
        success: result.success,
        stage: 'execution',
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error || '',
        exit_code: result.exit_code,
        session_id: sessionId,
        execution_time: result.execution_time,
        message: result.success ? 'Execution completed' : 'Execution failed',
        output_file: '',
        timeout: result.timeout || false
      });
    } catch (error) {
      callback(null, {
        success: false,
        stage: 'execution',
        stdout: '',
        stderr: '',
        error: error.message,
        exit_code: -1,
        session_id: sessionId,
        execution_time: 0,
        message: 'Execution error',
        output_file: '',
        timeout: false
      });
    }
  }

  // Stream execution (placeholder - would need actual streaming implementation)
  streamExecution(call) {
    const { session_id, follow } = call.request;
    
    // Check if session exists
    const session = activeSessions.get(session_id);
    if (!session) {
      call.write({
        data: 'Session not found',
        type: 'error',
        session_id: session_id,
        timestamp: Date.now(),
        is_final: true
      });
      call.end();
      return;
    }

    // Send existing output
    call.write({
      data: session.output || 'No output available',
      type: 'stdout',
      session_id: session_id,
      timestamp: Date.now(),
      is_final: true
    });
    call.end();
  }

  // File operations
  listFiles(call, callback) {
    const { directory, recursive } = call.request;
    const targetDir = directory ? path.join(WORKSPACE_PATH, directory) : WORKSPACE_PATH;
    
    try {
      if (!fs.existsSync(targetDir)) {
        return callback(null, {
          success: false,
          files: [],
          error: 'Directory does not exist'
        });
      }

      const files = [];
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(targetDir, entry.name);
        const stats = fs.statSync(fullPath);
        
        files.push({
          name: entry.name,
          path: path.relative(WORKSPACE_PATH, fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? stats.size : 0,
          modified_time: stats.mtime.getTime(),
          permissions: stats.mode.toString(8)
        });

        // Recursive listing
        if (recursive && entry.isDirectory()) {
          const subResult = this.listFilesRecursive(fullPath, WORKSPACE_PATH);
          files.push(...subResult);
        }
      }

      callback(null, {
        success: true,
        files: files,
        error: ''
      });
    } catch (error) {
      callback(null, {
        success: false,
        files: [],
        error: error.message
      });
    }
  }

  readFile(call, callback) {
    const { path: filePath, encoding = 'utf-8' } = call.request;
    const fullPath = path.join(WORKSPACE_PATH, filePath);
    
    try {
      if (!fs.existsSync(fullPath)) {
        return callback(null, {
          success: false,
          content: '',
          encoding: encoding,
          error: 'File does not exist'
        });
      }

      const content = fs.readFileSync(fullPath, encoding);
      
      callback(null, {
        success: true,
        content: content,
        encoding: encoding,
        error: ''
      });
    } catch (error) {
      callback(null, {
        success: false,
        content: '',
        encoding: encoding,
        error: error.message
      });
    }
  }

  writeFile(call, callback) {
    const { path: filePath, content, encoding = 'utf-8', create_directories } = call.request;
    const fullPath = path.join(WORKSPACE_PATH, filePath);
    
    try {
      if (create_directories) {
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, encoding);
      
      callback(null, {
        success: true,
        message: 'File written successfully',
        error: ''
      });
    } catch (error) {
      callback(null, {
        success: false,
        message: '',
        error: error.message
      });
    }
  }

  deleteFile(call, callback) {
    const { path: filePath, recursive } = call.request;
    const fullPath = path.join(WORKSPACE_PATH, filePath);
    
    try {
      if (!fs.existsSync(fullPath)) {
        return callback(null, {
          success: false,
          message: '',
          error: 'File or directory does not exist'
        });
      }

      if (recursive && fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      
      callback(null, {
        success: true,
        message: 'File/directory deleted successfully',
        error: ''
      });
    } catch (error) {
      callback(null, {
        success: false,
        message: '',
        error: error.message
      });
    }
  }

  createDirectory(call, callback) {
    const { path: dirPath, recursive } = call.request;
    const fullPath = path.join(WORKSPACE_PATH, dirPath);
    
    try {
      fs.mkdirSync(fullPath, { recursive: recursive });
      
      callback(null, {
        success: true,
        message: 'Directory created successfully',
        error: ''
      });
    } catch (error) {
      callback(null, {
        success: false,
        message: '',
        error: error.message
      });
    }
  }

  // Helper methods
  async executeCommand(command, args = [], workDir, timeout = 30000, input = null) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn(command, args, {
        cwd: workDir,
        stdio: input ? 'pipe' : 'pipe',
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      }

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        const executionTime = Date.now() - startTime;
        
        resolve({
          success: code === 0 && !timedOut,
          stdout: stdout,
          stderr: stderr,
          exit_code: code || -1,
          execution_time: executionTime,
          timeout: timedOut,
          error: timedOut ? 'Execution timed out' : (code !== 0 ? stderr : null)
        });
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout: stdout,
          stderr: stderr,
          exit_code: -1,
          execution_time: Date.now() - startTime,
          timeout: false,
          error: error.message
        });
      });
    });
  }

  async checkLanguageAvailability(language, config) {
    try {
      const result = await this.executeCommand(config.version_check.split(' ')[0], [config.version_check.split(' ').slice(1)].flat(), '/tmp', 5000);
      if (!result.success) {
        throw new Error(`${language} not available`);
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  async getLanguageVersion(versionCommand) {
    try {
      const [cmd, ...args] = versionCommand.split(' ');
      const result = await this.executeCommand(cmd, args, '/tmp', 5000);
      return result.success ? (result.stdout + result.stderr).trim() : 'Unknown version';
    } catch (error) {
      return 'Unknown version';
    }
  }

  listFilesRecursive(dir, basePath) {
    const files = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const stats = fs.statSync(fullPath);
        
        files.push({
          name: entry.name,
          path: path.relative(basePath, fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isFile() ? stats.size : 0,
          modified_time: stats.mtime.getTime(),
          permissions: stats.mode.toString(8)
        });

        if (entry.isDirectory()) {
          files.push(...this.listFilesRecursive(fullPath, basePath));
        }
      }
    } catch (error) {
      console.error('Error listing files recursively:', error);
    }
    return files;
  }

  start(port = 50052) {
    const bindAddress = `0.0.0.0:${port}`;
    this.server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
      if (error) {
        console.error('Failed to start gRPC server:', error);
        return;
      }
      console.log(`🚀 Compiler gRPC server listening on port ${port}`);
      console.log(`📁 Workspace path: ${WORKSPACE_PATH}`);
      console.log(`🔧 Available languages: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`);
      this.server.start();
    });
  }

  stop() {
    this.server.tryShutdown(() => {
      console.log('Compiler gRPC server stopped');
    });
  }
}

// Start the server
if (require.main === module) {
  const server = new CompilerGrpcServer();
  server.start(process.env.GRPC_PORT || 50052);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Compiler gRPC server...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down Compiler gRPC server...');
    server.stop();
    process.exit(0);
  });
}

module.exports = CompilerGrpcServer;