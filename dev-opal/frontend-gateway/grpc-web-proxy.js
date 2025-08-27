const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.GRPC_WEB_PORT || 8080;

// gRPC service targets
const TERMINAL_GRPC_URL = process.env.TERMINAL_GRPC_URL || 'grpc-terminal:50051';
const COMPILER_GRPC_URL = process.env.COMPILER_GRPC_URL || 'compiler:50052';
const AGENT_GRPC_URL = process.env.AGENT_GRPC_URL || 'agent:50053';

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'grpc-timeout',
    'grpc-encoding',
    'grpc-accept-encoding',
    'x-grpc-web',
    'x-user-agent'
  ]
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, grpc-timeout, grpc-encoding, grpc-accept-encoding, x-grpc-web, x-user-agent');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Create proxy options factory
const createGrpcProxyOptions = (target, serviceName) => ({
  target: `http://${target}`,
  changeOrigin: true,
  ws: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${serviceName} gRPC-Web request: ${req.method} ${req.url}`);
    
    // Set appropriate headers for gRPC-Web
    proxyReq.setHeader('Content-Type', req.headers['content-type'] || 'application/grpc-web+proto');
    
    if (req.headers['grpc-timeout']) {
      proxyReq.setHeader('grpc-timeout', req.headers['grpc-timeout']);
    }
    
    if (req.headers['grpc-encoding']) {
      proxyReq.setHeader('grpc-encoding', req.headers['grpc-encoding']);
    }
    
    if (req.headers['grpc-accept-encoding']) {
      proxyReq.setHeader('grpc-accept-encoding', req.headers['grpc-accept-encoding']);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Set CORS headers on response
    proxyRes.headers['access-control-allow-origin'] = req.headers.origin || '*';
    proxyRes.headers['access-control-allow-credentials'] = 'true';
    proxyRes.headers['access-control-expose-headers'] = 'grpc-status, grpc-message, grpc-status-details-bin';
    
    console.log(`${serviceName} gRPC-Web response: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`${serviceName} gRPC-Web proxy error:`, err);
    res.status(500).json({
      error: `${serviceName} gRPC-Web proxy error`,
      message: err.message
    });
  }
});

// Route-specific proxies
app.use('/terminal.TerminalService', createProxyMiddleware(createGrpcProxyOptions(TERMINAL_GRPC_URL, 'Terminal')));
app.use('/compiler.CompilerService', createProxyMiddleware(createGrpcProxyOptions(COMPILER_GRPC_URL, 'Compiler')));
app.use('/agent.AgentService', createProxyMiddleware(createGrpcProxyOptions(AGENT_GRPC_URL, 'Agent')));

// Fallback proxy for any other requests
app.use('/', createProxyMiddleware(createGrpcProxyOptions(TERMINAL_GRPC_URL, 'Default')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 gRPC-Web proxy server listening on port ${PORT}`);
  console.log(`🔌 Terminal service: ${TERMINAL_GRPC_URL}`);
  console.log(`🔧 Compiler service: ${COMPILER_GRPC_URL}`);
  console.log(`🤖 Agent service: ${AGENT_GRPC_URL}`);
  console.log(`🔗 CORS enabled for frontend origins`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gRPC-Web proxy...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gRPC-Web proxy...');
  process.exit(0);
});