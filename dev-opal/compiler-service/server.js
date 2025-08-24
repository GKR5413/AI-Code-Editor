const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3002;

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: './logs/compiler.log' })
  ]
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

// CORS middleware first (before helmet to avoid conflicts)
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:9000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware with relaxed CORS settings
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
  crossOriginOpenerPolicy: { policy: "unsafe-none" },    // Relax for development
}));
app.use(compression());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create necessary directories
const ensureDirectories = async () => {
  await fs.ensureDir('./workspace');
  await fs.ensureDir('./output');
  await fs.ensureDir('./temp');
  await fs.ensureDir('./logs');
};

// Multipart form data handling for file uploads
const upload = multer({
  dest: './temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Language configurations
const LANGUAGES = {
  javascript: {
    extension: '.js',
    compile: null,
    run: (file) => `node "${file}"`,
    timeout: 30000
  },
  typescript: {
    extension: '.ts',
    compile: (file, output) => `npx tsc "${file}" --outDir "${path.dirname(output)}" --target es2020 --module commonjs`,
    run: (file) => `node "${file.replace('.ts', '.js')}"`,
    timeout: 30000
  },
  python: {
    extension: '.py',
    compile: null,
    run: (file) => `python3 "${file}"`,
    timeout: 30000
  },
  java: {
    extension: '.java',
    compile: (file, output) => `javac -d "${path.dirname(output)}" "${file}"`,
    run: (file) => {
      const className = path.basename(file, '.java');
      const dir = path.dirname(file);
      return `cd "${dir}" && java ${className}`;
    },
    timeout: 30000
  },
  cpp: {
    extension: '.cpp',
    compile: (file, output) => `g++ -std=c++17 -o "${output}" "${file}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  c: {
    extension: '.c',
    compile: (file, output) => `gcc -o "${output}" "${file}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  go: {
    extension: '.go',
    compile: null,
    run: (file) => `go run "${file}"`,
    timeout: 30000
  },
  rust: {
    extension: '.rs',
    compile: (file, output) => `rustc "${file}" -o "${output}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  csharp: {
    extension: '.cs',
    compile: (file, output) => `csc /out:"${output}.exe" "${file}"`,
    run: (file) => `mono "${file}.exe"`,
    timeout: 30000
  },
  php: {
    extension: '.php',
    compile: null,
    run: (file) => `php "${file}"`,
    timeout: 30000
  },
  ruby: {
    extension: '.rb',
    compile: null,
    run: (file) => `ruby "${file}"`,
    timeout: 30000
  },
  swift: {
    extension: '.swift',
    compile: (file, output) => `swiftc "${file}" -o "${output}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  kotlin: {
    extension: '.kt',
    compile: (file, output) => `kotlinc "${file}" -include-runtime -d "${output}.jar"`,
    run: (file) => `java -jar "${file}.jar"`,
    timeout: 30000
  },
  dart: {
    extension: '.dart',
    compile: null,
    run: (file) => `dart "${file}"`,
    timeout: 30000
  },
  haskell: {
    extension: '.hs',
    compile: (file, output) => `ghc -o "${output}" "${file}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  scala: {
    extension: '.scala',
    compile: (file, output) => `scalac -d "${path.dirname(output)}" "${file}"`,
    run: (file) => {
      const className = path.basename(file, '.scala');
      const dir = path.dirname(file);
      return `cd "${dir}" && scala ${className}`;
    },
    timeout: 30000
  },
  lua: {
    extension: '.lua',
    compile: null,
    run: (file) => `lua "${file}"`,
    timeout: 30000
  },
  perl: {
    extension: '.pl',
    compile: null,
    run: (file) => `perl "${file}"`,
    timeout: 30000
  },
  r: {
    extension: '.R',
    compile: null,
    run: (file) => `Rscript "${file}"`,
    timeout: 30000
  },
  julia: {
    extension: '.jl',
    compile: null,
    run: (file) => `julia "${file}"`,
    timeout: 30000
  },
  assembly: {
    extension: '.asm',
    compile: (file, output) => `nasm -f elf64 "${file}" -o "${output}.o" && ld "${output}.o" -o "${output}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  },
  fortran: {
    extension: '.f90',
    compile: (file, output) => `gfortran -o "${output}" "${file}"`,
    run: (file) => `"${file}"`,
    timeout: 30000
  }
};

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: rejRes.msBeforeNext
    });
  }
};

// Apply rate limiting to compilation endpoints
app.use('/api/compile', rateLimitMiddleware);
app.use('/api/run', rateLimitMiddleware);

// Execute command with timeout and resource limits
const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    const { timeout = 30000, cwd = '/app/workspace' } = options;
    
    logger.info(`Executing command: ${command}`);
    
    const child = exec(command, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      env: {
        ...process.env,
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin:/root/.cargo/bin:/opt/flutter/bin:/root/.sdkman/candidates/kotlin/current/bin:/opt/swift/usr/bin:/root/.sdkman/candidates/scala/current/bin:/opt/julia/bin'
      }
    }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Command execution error: ${error.message}`);
        resolve({
          success: false,
          error: error.message,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error.code || 1,
          timeout: error.code === 'TIMEOUT'
        });
      } else {
        logger.info(`Command executed successfully`);
        resolve({
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0
        });
      }
    });

    // Kill process if it runs too long
    setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        child.kill('SIGKILL');
      }, 5000);
    }, timeout);
  });
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supportedLanguages: Object.keys(LANGUAGES)
  });
});

// Get supported languages
app.get('/api/languages', (req, res) => {
  const languages = Object.keys(LANGUAGES).map(lang => ({
    name: lang,
    extension: LANGUAGES[lang].extension,
    hasCompileStep: LANGUAGES[lang].compile !== null
  }));
  
  res.json({
    success: true,
    languages
  });
});

// Compile code
app.post('/api/compile', async (req, res) => {
  const { language, code, filename, options = {} } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({
      success: false,
      error: 'Language and code are required'
    });
  }
  
  if (!LANGUAGES[language]) {
    return res.status(400).json({
      success: false,
      error: `Unsupported language: ${language}`
    });
  }
  
  const sessionId = uuidv4();
  const lang = LANGUAGES[language];
  const actualFilename = filename || `main${lang.extension}`;
  const workspaceDir = path.join('./workspace', sessionId);
  const sourceFile = path.join(workspaceDir, actualFilename);
  const outputFile = path.join('./output', sessionId, 'output');
  
  try {
    // Create workspace directory
    await fs.ensureDir(workspaceDir);
    await fs.ensureDir(path.dirname(outputFile));
    
    // Write source code to file
    await fs.writeFile(sourceFile, code, 'utf8');
    
    // If language requires compilation
    if (lang.compile) {
      const compileCommand = lang.compile(sourceFile, outputFile);
      const compileResult = await executeCommand(compileCommand, {
        timeout: options.timeout || lang.timeout,
        cwd: workspaceDir
      });
      
      if (!compileResult.success) {
        return res.json({
          success: false,
          stage: 'compilation',
          error: compileResult.error,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          sessionId
        });
      }
      
      return res.json({
        success: true,
        stage: 'compilation',
        message: 'Code compiled successfully',
        stdout: compileResult.stdout,
        stderr: compileResult.stderr,
        sessionId,
        outputFile: outputFile
      });
    } else {
      // No compilation needed
      return res.json({
        success: true,
        stage: 'compilation',
        message: 'No compilation needed for this language',
        sessionId,
        outputFile: sourceFile
      });
    }
  } catch (error) {
    logger.error(`Compilation error: ${error.message}`);
    res.status(500).json({
      success: false,
      stage: 'compilation',
      error: error.message,
      sessionId
    });
  }
});

// Run code
app.post('/api/run', async (req, res) => {
  const { language, code, filename, input = '', options = {} } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({
      success: false,
      error: 'Language and code are required'
    });
  }
  
  if (!LANGUAGES[language]) {
    return res.status(400).json({
      success: false,
      error: `Unsupported language: ${language}`
    });
  }
  
  const sessionId = uuidv4();
  const lang = LANGUAGES[language];
  const actualFilename = filename || `main${lang.extension}`;
  const workspaceDir = path.join('./workspace', sessionId);
  const sourceFile = path.join(workspaceDir, actualFilename);
  const outputFile = path.join('./output', sessionId, 'output');
  
  try {
    // Create workspace directory
    await fs.ensureDir(workspaceDir);
    await fs.ensureDir(path.dirname(outputFile));
    
    // Write source code to file
    await fs.writeFile(sourceFile, code, 'utf8');
    
    let executableFile = sourceFile;
    
    // Compile if necessary
    if (lang.compile) {
      const compileCommand = lang.compile(sourceFile, outputFile);
      const compileResult = await executeCommand(compileCommand, {
        timeout: options.compileTimeout || lang.timeout,
        cwd: workspaceDir
      });
      
      if (!compileResult.success) {
        return res.json({
          success: false,
          stage: 'compilation',
          error: compileResult.error,
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          sessionId
        });
      }
      
      executableFile = outputFile;
    }
    
    // Run the code
    // Make file path relative to workspace for execution
    const relativeFile = path.relative(workspaceDir, executableFile);
    const runCommand = lang.run(relativeFile);
    
    // Handle input if provided
    let runResult;
    if (input) {
      runResult = await new Promise((resolve) => {
        const child = spawn('bash', ['-c', runCommand], {
          cwd: workspaceDir,
          env: {
            ...process.env,
            PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin:/root/.cargo/bin:/opt/flutter/bin:/root/.sdkman/candidates/kotlin/current/bin:/opt/swift/usr/bin:/root/.sdkman/candidates/scala/current/bin:/opt/julia/bin'
          }
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', (code) => {
          resolve({
            success: code === 0,
            stdout,
            stderr,
            exitCode: code || 0
          });
        });
        
        // Send input to the process
        child.stdin.write(input);
        child.stdin.end();
        
        // Timeout handling
        setTimeout(() => {
          child.kill('SIGTERM');
          setTimeout(() => {
            child.kill('SIGKILL');
          }, 5000);
        }, options.runTimeout || lang.timeout);
      });
    } else {
      runResult = await executeCommand(runCommand, {
        timeout: options.runTimeout || lang.timeout,
        cwd: workspaceDir
      });
    }
    
    res.json({
      success: runResult.success,
      stage: 'execution',
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode,
      sessionId,
      executionTime: Date.now()
    });
    
  } catch (error) {
    logger.error(`Execution error: ${error.message}`);
    res.status(500).json({
      success: false,
      stage: 'execution',
      error: error.message,
      sessionId
    });
  } finally {
    // Clean up workspace after execution
    setTimeout(async () => {
      try {
        await fs.remove(workspaceDir);
        await fs.remove(path.dirname(outputFile));
      } catch (cleanupError) {
        logger.warn(`Cleanup error for session ${sessionId}: ${cleanupError.message}`);
      }
    }, 60000); // Clean up after 1 minute
  }
});

// Get compiler information
app.get('/api/info/:language', async (req, res) => {
  const { language } = req.params;
  
  if (!LANGUAGES[language]) {
    return res.status(404).json({
      success: false,
      error: `Language ${language} not supported`
    });
  }
  
  const versionCommands = {
    javascript: 'node --version',
    typescript: 'npx tsc --version',
    python: 'python3 --version',
    java: 'java --version',
    cpp: 'g++ --version',
    c: 'gcc --version',
    go: 'go version',
    rust: 'rustc --version',
    csharp: 'mcs --version',
    php: 'php --version',
    ruby: 'ruby --version',
    swift: 'swift --version',
    kotlin: 'kotlin -version',
    dart: 'dart --version',
    haskell: 'ghc --version',
    scala: 'scala -version',
    lua: 'lua -v',
    perl: 'perl --version',
    r: 'R --version',
    julia: 'julia --version'
  };
  
  try {
    const versionCommand = versionCommands[language];
    let versionInfo = 'Version info not available';
    
    if (versionCommand) {
      const result = await executeCommand(versionCommand);
      if (result.success) {
        versionInfo = result.stdout || result.stderr;
      }
    }
    
    res.json({
      success: true,
      language,
      versionInfo: versionInfo.trim(),
      config: LANGUAGES[language]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Handle interactive WebSocket messages
async function handleInteractiveMessage(ws, sessionId, data) {
  const { type, payload } = data;
  
  switch (type) {
    case 'start':
      // Start interactive execution
      await startInteractiveExecution(ws, sessionId, payload);
      break;
      
    case 'input':
      // Forward input to running process
      const session = activeSessions.get(sessionId);
      if (session && session.process && session.process.stdin) {
        session.process.stdin.write(payload.data);
      }
      break;
      
    case 'stop':
      // Stop execution
      const stopSession = activeSessions.get(sessionId);
      if (stopSession && stopSession.process) {
        stopSession.process.kill('SIGTERM');
        activeSessions.delete(sessionId);
        ws.send(JSON.stringify({
          type: 'stopped',
          message: 'Execution stopped'
        }));
      }
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`
      }));
  }
}

// Start interactive execution
async function startInteractiveExecution(ws, sessionId, payload) {
  const { language, code, filename } = payload;
  
  if (!LANGUAGES[language]) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `Unsupported language: ${language}`
    }));
    return;
  }
  
  const lang = LANGUAGES[language];
  const actualFilename = filename || `main${lang.extension}`;
  const workspaceDir = path.join('./workspace', sessionId);
  const sourceFile = path.join(workspaceDir, actualFilename);
  
  try {
    // Create workspace directory
    await fs.ensureDir(workspaceDir);
    
    // Write source code to file
    await fs.writeFile(sourceFile, code, 'utf8');
    
    // Create interactive process
    const runCommand = lang.run(sourceFile, workspaceDir);
    const args = runCommand.split(' ');
    const command = args.shift();
    
    const process = spawn(command, args, {
      cwd: workspaceDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PYTHONUNBUFFERED: '1' // Important for Python interactive programs
      }
    });
    
    // Store session
    activeSessions.set(sessionId, {
      process,
      workspaceDir,
      startTime: Date.now()
    });
    
    // Handle process output
    process.stdout.on('data', (data) => {
      ws.send(JSON.stringify({
        type: 'stdout',
        data: data.toString()
      }));
    });
    
    process.stderr.on('data', (data) => {
      ws.send(JSON.stringify({
        type: 'stderr',
        data: data.toString()
      }));
    });
    
    // Handle process exit
    process.on('close', (code) => {
      ws.send(JSON.stringify({
        type: 'exit',
        code,
        message: `Process exited with code ${code}`
      }));
      
      // Clean up
      activeSessions.delete(sessionId);
      setTimeout(async () => {
        try {
          await fs.remove(workspaceDir);
        } catch (error) {
          logger.warn(`Cleanup error for session ${sessionId}: ${error.message}`);
        }
      }, 5000);
    });
    
    process.on('error', (error) => {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Process error: ${error.message}`
      }));
      activeSessions.delete(sessionId);
    });
    
    // Send start confirmation
    ws.send(JSON.stringify({
      type: 'started',
      sessionId,
      message: 'Interactive execution started'
    }));
    
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `Execution error: ${error.message}`
    }));
  }
}

// Initialize server
const startServer = async () => {
  try {
    await ensureDirectories();
    
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Compiler service running on port ${PORT}`);
      logger.info(`📋 Supported languages: ${Object.keys(LANGUAGES).join(', ')}`);
      
      // Start WebSocket server for interactive execution
      wss = new WebSocket.Server({ port: 4002 }); // WebSocket on port 4002
      logger.info(`🔌 WebSocket server for interactive execution running on port 4002`);
      
      wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('sessionId');
        logger.info(`📡 Interactive session connected: ${sessionId}`);
        
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message);
            await handleInteractiveMessage(ws, sessionId, data);
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Parse error: ${error.message}`
            }));
          }
        });
        
        ws.on('close', () => {
          logger.info(`📡 Interactive session disconnected: ${sessionId}`);
          // Clean up session
          const session = activeSessions.get(sessionId);
          if (session && session.process) {
            session.process.kill('SIGTERM');
          }
          activeSessions.delete(sessionId);
        });
        
        ws.on('error', (error) => {
          logger.error(`WebSocket error for session ${sessionId}:`, error);
        });
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Interactive execution endpoint via WebSocket
app.post('/api/run-interactive', async (req, res) => {
  const { language, code, filename } = req.body;
  
  if (!language || !code) {
    return res.status(400).json({
      success: false,
      error: 'Language and code are required'
    });
  }
  
  if (!LANGUAGES[language]) {
    return res.status(400).json({
      success: false,
      error: `Unsupported language: ${language}`
    });
  }
  
  const sessionId = uuidv4();
  const wsPort = 3003 + Math.floor(Math.random() * 100); // Random port for this session
  
  // Return session info for WebSocket connection
  res.json({
    success: true,
    sessionId,
    wsPort,
    message: 'Interactive session prepared. Connect via WebSocket.'
  });
});

// WebSocket server for interactive execution
let server;
let wss;

// Store active sessions
const activeSessions = new Map();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (wss) {
    wss.close();
  }
  if (server) {
    server.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (wss) {
    wss.close();
  }
  if (server) {
    server.close();
  }
  process.exit(0);
});

startServer();