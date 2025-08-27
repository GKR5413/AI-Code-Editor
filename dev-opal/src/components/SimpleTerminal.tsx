import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface SimpleTerminalProps {
  className?: string;
}

export const SimpleTerminal: React.FC<SimpleTerminalProps> = ({ className }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: '#264f78'
      },
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Connect to Docker terminal
    connectToDockerTerminal();

    // Handle terminal input
    let currentInput = '';
    terminal.onData(async (data) => {
      if (isConnected && sessionId) {
        if (data === '\r' || data === '\n') {
          if (currentInput.trim()) {
            terminal.write('\r\n');
            
            try {
              const response = await fetch('http://localhost:3002/terminal/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  session_id: sessionId,
                  command: currentInput.trim()
                })
              });

              const result = await response.json();
              
              if (result.success) {
                if (result.output) terminal.write(result.output);
                if (result.error) terminal.write(`\x1b[31m${result.error}\x1b[0m\r\n`);
              } else {
                terminal.write(`\x1b[31mCommand failed: ${result.error}\x1b[0m\r\n`);
              }
            } catch (error) {
              terminal.write(`\x1b[31mError: ${error}\x1b[0m\r\n`);
            }
            
            currentInput = '';
            terminal.write('\r\n$ ');
          } else {
            terminal.write('\r\n$ ');
          }
        } else if (data === '\u007F') {
          if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1);
            terminal.write('\b \b');
          }
        } else if (data >= ' ') {
          currentInput += data;
          terminal.write(data);
        } else if (data === '\u0003') {
          currentInput = '';
          terminal.write('^C\r\n$ ');
        }
      }
    });

    // Handle resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      terminal.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const connectToDockerTerminal = async () => {
    try {
      const sessionId = `terminal_${Date.now()}`;
      
      const response = await fetch('http://localhost:3002/terminal/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          shell: 'bash',
          working_directory: '/workspace',
          environment: {},
          cols: 100,
          rows: 30
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSessionId(sessionId);
        setIsConnected(true);
        xtermRef.current?.write('\x1b[32m✅ Connected to Docker Terminal\x1b[0m\r\n');
        xtermRef.current?.write('\x1b[33mType commands and press Enter\x1b[0m\r\n');
        xtermRef.current?.write('\r\n$ ');
      } else {
        xtermRef.current?.write(`\x1b[31m❌ Connection failed: ${result.error}\x1b[0m\r\n`);
      }
    } catch (error) {
      xtermRef.current?.write(`\x1b[31m❌ Connection error: ${error}\x1b[0m\r\n`);
    }
  };

  return (
    <div className={`simple-terminal ${className || ''}`}>
      <div 
        ref={terminalRef} 
        className="terminal-container"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#1e1e1e',
          padding: '0',
          margin: '0'
        }}
      />
    </div>
  );
};

export default SimpleTerminal;
