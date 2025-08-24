import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
// import { terminalConfig } from '@/config/terminal';

// Temporary hardcoded configuration for testing
const terminalConfig = {
  WEBSOCKET_URL: 'ws://localhost:3003',
  API_BASE_URL: 'http://localhost:3003',
  HEALTH_ENDPOINT: 'http://localhost:3003/health',
  RECONNECT_DELAY: 3000,
  CONNECTION_TIMEOUT: 10000,
};

const TerminalComponent: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const initializeTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    if (terminal.current) {
      terminal.current.dispose();
    }

    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#3a3d41',
      },
      rows: 24,
      cols: 80,
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());

    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Auto-connect on initialization with a small delay to ensure component is mounted
    setTimeout(() => {
      connectWebSocket();
    }, 100);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    setConnected(false);
    
    console.log('🔌 Attempting to connect to:', terminalConfig.WEBSOCKET_URL);
    console.log('📋 Terminal config:', terminalConfig);
    console.log('🔌 WebSocket URL type:', typeof terminalConfig.WEBSOCKET_URL);
    console.log('🔌 WebSocket URL value:', terminalConfig.WEBSOCKET_URL);
    
    try {
      ws.current = new WebSocket(terminalConfig.WEBSOCKET_URL);

      ws.current.onopen = () => {
        console.log('Terminal WebSocket connected');
        setConnected(true);
        
        // Set up input handler after connection is established
        if (terminal.current) {
          terminal.current.onData((data) => {
            console.log('Terminal input received:', JSON.stringify(data));
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              console.log('Sending input to server:', JSON.stringify({ type: 'input', data }));
              ws.current.send(JSON.stringify({ type: 'input', data }));
            } else {
              console.log('WebSocket not ready:', ws.current?.readyState);
            }
          });
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'output' && terminal.current) {
            terminal.current.write(message.data);
          }
          
          if (message.type === 'connected' && terminal.current) {
            // Connection established - store session ID for file explorer integration
            setSessionId(message.sessionId);
            
            // Store session ID in localStorage for file explorer access
            localStorage.setItem('terminalSessionId', message.sessionId);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('Terminal WebSocket disconnected');
        setConnected(false);
        
        // Auto-reconnect after configured delay
        setTimeout(() => {
          connectWebSocket();
        }, terminalConfig.RECONNECT_DELAY);
      };

      ws.current.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
        setConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, []);

  useEffect(() => {
    initializeTerminal();

    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.current) {
        ws.current.close();
      }
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, [initializeTerminal]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Terminal</span>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Connecting...'}
          </span>
          {sessionId && (
            <span className="text-xs text-blue-400">
              Session: {sessionId.slice(-8)}
            </span>
          )}
        </div>
        {sessionId && (
          <button 
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => {
              // Trigger file explorer to connect to this terminal workspace
              window.dispatchEvent(new CustomEvent('connectToTerminalWorkspace', { 
                detail: { sessionId } 
              }));
            }}
          >
            Connect Explorer
          </button>
        )}
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 p-2"
        style={{ background: '#1e1e1e' }}
      />
    </div>
  );
};

export default TerminalComponent;