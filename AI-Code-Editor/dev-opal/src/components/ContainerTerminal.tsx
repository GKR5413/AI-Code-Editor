import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/**
 * Container Terminal - Direct HTTP API integration
 * Connects to the compiler service HTTP terminal endpoint
 */
export const ContainerTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const sessionIdRef = useRef<string>(`terminal_${Date.now()}`);

  useEffect(() => {
    if (!terminalRef.current) return;

    const initTerminal = async () => {
      try {
        // Create terminal
        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            black: '#000000',
            red: '#cd3131',
            green: '#0dbc79',
            yellow: '#e5e510',
            blue: '#2472c8',
            magenta: '#bc3fbc',
            cyan: '#11a8cd',
            white: '#e5e5e5'
          },
          cols: 80,
          rows: 30
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);

        terminal.open(terminalRef.current!);
        fitAddon.fit();

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Connect to backend terminal
        await connectToBackend(terminal);

      } catch (error) {
        console.error('Terminal initialization error:', error);
        setStatus(`Error: ${error}`);
      }
    };

    const timer = setTimeout(initTerminal, 100);
    return () => clearTimeout(timer);
  }, []);

  const connectToBackend = async (terminal: Terminal) => {
    try {
      // Connect to enhanced terminal server via WebSocket
      const ws = new WebSocket('ws://localhost:3001/terminal');

      ws.onopen = () => {
        console.log('✅ WebSocket connected to enhanced terminal server');
        setStatus('Connected');
      };

      ws.onmessage = (event) => {
        terminal.write(event.data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        throw new Error('WebSocket connection failed');
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setStatus('Disconnected');
        terminal.write('\r\n\x1b[31m✗ Connection closed\x1b[0m\r\n');
      };

      // Setup terminal input to send to WebSocket
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Store WebSocket reference for cleanup
      (terminal as any).ws = ws;

    } catch (error) {
      console.error('Backend connection error:', error);
      terminal.write('Failed to connect to container terminal\r\n');
      terminal.write('Using local echo mode instead\r\n\r\n');
      setStatus('Local Mode');

      // Fallback to local mode
      setupLocalMode(terminal);
    }
  };


  const setupLocalMode = (terminal: Terminal) => {
    let currentLine = '';
    
    terminal.onData((data) => {
      if (data === '\r' || data === '\n') {
        terminal.write('\r\n');
        
        if (currentLine.trim()) {
          const cmd = currentLine.trim().toLowerCase();
          
          if (cmd === 'clear') {
            terminal.clear();
          } else if (cmd === 'ls') {
            terminal.write('workspace/  src/  package.json  README.md\r\n');
          } else if (cmd === 'pwd') {
            terminal.write('/workspace\r\n');
          } else if (cmd === 'whoami') {
            terminal.write('velocide-user\r\n');
          } else if (cmd.startsWith('echo ')) {
            terminal.write(cmd.substring(5) + '\r\n');
          } else {
            terminal.write(`bash: ${cmd}: command not found\r\n`);
          }
        }
        
        terminal.write('$ ');
        currentLine = '';
      } else if (data === '\u007F') { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (data >= ' ') {
        currentLine += data;
        terminal.write(data);
      }
    });
    
    terminal.write('$ ');
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        // Close WebSocket if it exists
        const ws = (xtermRef.current as any).ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        xtermRef.current.dispose();
      }
    };
  }, []);

  // Handle resize
  const handleResize = () => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-full w-full relative">
      <div
        ref={terminalRef}
        className="h-full w-full"
        style={{ background: '#1e1e1e' }}
      />
      
      {/* Status indicator */}
      <div className="absolute top-2 right-2 text-xs">
        <div className={`inline-flex items-center px-2 py-1 rounded text-white text-xs ${
          status === 'Connected' ? 'bg-green-600' : 
          status === 'Local Mode' ? 'bg-yellow-600' : 'bg-gray-600'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${
            status === 'Connected' ? 'bg-green-300' : 
            status === 'Local Mode' ? 'bg-yellow-300' : 'bg-gray-300'
          }`} />
          {status}
        </div>
      </div>
    </div>
  );
};