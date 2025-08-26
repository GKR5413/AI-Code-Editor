// Environment configuration for the AI IDE
export const ENV_CONFIG = {
  // Development mode
  IS_DEV: import.meta.env.DEV,
  
  // Terminal service configuration
  TERMINAL: {
    WEBSOCKET_URL: 'ws://localhost:3006',
    API_BASE_URL: 'http://localhost:3006',
    HEALTH_ENDPOINT: 'http://localhost:3006/health',
    PORT: 3006,
  },
  
  // Compiler service configuration
  COMPILER: {
    API_BASE_URL: 'http://localhost:3002',
    HEALTH_ENDPOINT: 'http://localhost:3002/health',
    PORT: 3002,
  },
  
  // Frontend configuration
  FRONTEND: {
    PORT: 5173,
    DEV_SERVER_URL: 'http://localhost:5173',
  },
  
  // Docker configuration
  DOCKER: {
    TERMINAL_PORT: 3003,
    COMPILER_PORT: 3002,
    NETWORK_NAME: 'ide-network',
  },
  
  // Connection settings
  CONNECTION: {
    TIMEOUT: 10000,
    RECONNECT_DELAY: 3000,
    HEARTBEAT_INTERVAL: 5000,
  },
};

// Helper function to get configuration with environment overrides
export const getConfig = () => {
  const config = { ...ENV_CONFIG };
  
  // Override with environment variables if available
  if (import.meta.env.VITE_TERMINAL_WS_URL) {
    config.TERMINAL.WEBSOCKET_URL = import.meta.env.VITE_TERMINAL_WS_URL;
  }
  
  if (import.meta.env.VITE_TERMINAL_API_URL) {
    config.TERMINAL.API_BASE_URL = import.meta.env.VITE_TERMINAL_API_URL;
    config.TERMINAL.HEALTH_ENDPOINT = `${import.meta.env.VITE_TERMINAL_API_URL}/health`;
  }
  
  if (import.meta.env.VITE_COMPILER_SERVICE_URL) {
    config.COMPILER.API_BASE_URL = import.meta.env.VITE_COMPILER_SERVICE_URL;
    config.COMPILER.HEALTH_ENDPOINT = `${import.meta.env.VITE_COMPILER_SERVICE_URL}/health`;
  }
  
  return config;
};

// Export the function instead of calling it immediately
export default getConfig;
