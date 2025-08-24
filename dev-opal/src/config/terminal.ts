import getConfig from './environment';

// Terminal configuration
export const TERMINAL_CONFIG = {
  // WebSocket connection URL for terminal
  WEBSOCKET_URL: getConfig().TERMINAL.WEBSOCKET_URL,
  
  // HTTP API base URL for terminal service
  API_BASE_URL: getConfig().TERMINAL.API_BASE_URL,
  
  // Health check endpoint
  HEALTH_ENDPOINT: getConfig().TERMINAL.HEALTH_ENDPOINT,
  
  // Auto-reconnect delay in milliseconds
  RECONNECT_DELAY: getConfig().CONNECTION.RECONNECT_DELAY,
  
  // Connection timeout in milliseconds
  CONNECTION_TIMEOUT: getConfig().CONNECTION.TIMEOUT,
};

// Environment-based configuration
const getTerminalConfig = () => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    // In development, try to use environment variables or fallback to defaults
    const wsUrl = import.meta.env.VITE_TERMINAL_WS_URL || TERMINAL_CONFIG.WEBSOCKET_URL;
    const apiUrl = import.meta.env.VITE_TERMINAL_API_URL || TERMINAL_CONFIG.API_BASE_URL;
    
    return {
      ...TERMINAL_CONFIG,
      WEBSOCKET_URL: wsUrl,
      API_BASE_URL: apiUrl,
      HEALTH_ENDPOINT: `${apiUrl}/health`,
    };
  }
  
  return TERMINAL_CONFIG;
};

export const terminalConfig = getTerminalConfig();
