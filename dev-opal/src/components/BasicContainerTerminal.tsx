import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

/**
 * Basic Container Terminal - No gRPC dependencies
 * Just xterm.js with WebSocket connection for testing
 */
export const BasicContainerTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState('Initializing...');

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
            cursor: '#ffffff'
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

        // Basic functionality
        terminal.write('VelocIDE Basic Terminal\r\n');
        terminal.write('gRPC connection: Not implemented yet\r\n');
        terminal.write('Status: Local echo mode\r\n\r\n');
        terminal.write('$ ');

        setStatus('Ready');

        // Simple input handling
        let currentLine = '';
        terminal.onData((data) => {
          if (data === '\r' || data === '\n') {
            terminal.write('\r\n');
            if (currentLine.trim()) {
              if (currentLine.trim() === 'clear') {
                terminal.clear();
                terminal.write('$ ');
              } else {
                terminal.write(`Echo: ${currentLine}\r\n`);
                terminal.write('$ ');
              }
            } else {
              terminal.write('$ ');
            }
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

      } catch (error) {
        console.error('Terminal initialization error:', error);
        setStatus(`Error: ${error}`);
      }
    };

    const timer = setTimeout(initTerminal, 100);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="h-full w-full relative">
      <div
        ref={terminalRef}
        className="h-full w-full"
        style={{ background: '#1e1e1e' }}
      />
      
      {/* Status */}
      <div className="absolute top-2 right-2 text-xs bg-gray-800 text-white px-2 py-1 rounded">
        {status}
      </div>
    </div>
  );
};