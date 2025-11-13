import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTermTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface CompilerTerminalProps {
  className?: string;
  onReady?: (terminal: XTermTerminal) => void;
}

export interface CompilerTerminalRef {
  getTerminal: () => XTermTerminal | null;
  focus: () => void;
  clear: () => void;
  write: (data: string) => void;
  runCommand: (command: string) => void;
}

export const CompilerTerminal = forwardRef<CompilerTerminalRef, CompilerTerminalProps>(
  ({ className, onReady }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTermTerminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      getTerminal: () => xtermRef.current,
      focus: () => xtermRef.current?.focus(),
      clear: () => xtermRef.current?.clear(),
      write: (data: string) => xtermRef.current?.write(data),
      runCommand: async (command: string) => {
        if (isConnected && isReady && sessionId) {
          try {
            xtermRef.current?.write(`\x1b[33m$ ${command}\x1b[0m\r\n`);
            const response = await fetch('http://localhost:3002/terminal/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: sessionId,
                command: command
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                if (data.output) {
                  xtermRef.current?.write(data.output);
                }
                if (data.error) {
                  xtermRef.current?.write(`\x1b[31m${data.error}\x1b[0m\r\n`);
                }
              } else {
                xtermRef.current?.write(`\x1b[31mCommand failed: ${data.error}\x1b[0m\r\n`);
              }
            } else {
              xtermRef.current?.write(`\x1b[31mHTTP error: ${response.status}\x1b[0m\r\n`);
            }
          } catch (error) {
            xtermRef.current?.write(`\x1b[31mError executing command: ${error}\x1b[0m\r\n`);
          }
        }
      }
    }));

    useEffect(() => {
      if (!terminalRef.current) return;

      // Initialize terminal
      const terminal = new XTermTerminal({
        theme: {
          background: '#1a1a1a',
          foreground: '#ffffff',
          cursor: '#ffffff',
        },
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        rows: 20,
        cols: 80,
        scrollback: 1000,
        allowProposedApi: true
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Connect to terminal service via HTTP
      connectToTerminalService();

      // Handle terminal input
      let currentInput = '';
      
      terminal.onData(async (data) => {
        // Always handle input, even if not fully connected
        try {
          if (data === '\r' || data === '\n') {
            if (currentInput.trim()) {
              xtermRef.current?.write('\r\n');
              
              if (isConnected && isReady && sessionId) {
                try {
                  const response = await fetch('http://localhost:3002/terminal/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      session_id: sessionId,
                      command: currentInput.trim()
                    })
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                      if (data.output) {
                        xtermRef.current?.write(data.output);
                      }
                      if (data.error) {
                        xtermRef.current?.write(`\x1b[31m${data.error}\x1b[0m\r\n`);
                      }
                    } else {
                      xtermRef.current?.write(`\x1b[31mCommand failed: ${data.error}\x1b[0m\r\n`);
                    }
                  } else {
                    xtermRef.current?.write(`\x1b[31mHTTP error: ${response.status}\x1b[0m\r\n`);
                  }
                } catch (error) {
                  xtermRef.current?.write(`\x1b[31mError: ${error}\x1b[0m\r\n`);
                }
              } else {
                // Not connected, show local echo
                xtermRef.current?.write(`\x1b[33m$ ${currentInput.trim()}\x1b[0m\r\n`);
                xtermRef.current?.write('\x1b[31mTerminal not connected to container\x1b[0m\r\n');
              }
              
              currentInput = '';
              xtermRef.current?.write('$ ');
            } else {
              xtermRef.current?.write('\r\n$ ');
            }
          } else if (data === '\u007F') {
            // Handle backspace
            if (currentInput.length > 0) {
              currentInput = currentInput.slice(0, -1);
              xtermRef.current?.write('\b \b');
            }
          } else if (data >= ' ') {
            // Handle printable characters
            currentInput += data;
            xtermRef.current?.write(data);
          } else if (data === '\u0003') {
            // Handle Ctrl+C
            currentInput = '';
            xtermRef.current?.write('^C\r\n$ ');
          }
        } catch (error) {
          console.error('Error handling terminal input:', error);
        }
      });

      // Handle resize
      const handleResize = () => {
        fitAddon.fit();
      };

      window.addEventListener('resize', handleResize);
      onReady?.(terminal);

      return () => {
        terminal.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }, [onReady]);

    const connectToTerminalService = async () => {
      try {
        // Generate unique session ID
        const newSessionId = `terminal_${Date.now()}`;
        
        // Create terminal session via HTTP
        const response = await fetch('http://localhost:3002/terminal/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: newSessionId,
            shell: 'bash',
            working_directory: '/workspace',
            environment: {},
            cols: 100,
            rows: 30
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSessionId(newSessionId);
            setIsConnected(true);
            setIsReady(true);
            
            xtermRef.current?.write(`\x1b[32mConnected to container\x1b[0m\r\n`);
            xtermRef.current?.write('$ ');
          } else {
            setIsConnected(false);
            setIsReady(false);
            xtermRef.current?.write(`\x1b[31mFailed: ${data.message}\x1b[0m\r\n`);
          }
        } else {
          setIsConnected(false);
          setIsReady(false);
          xtermRef.current?.write(`\x1b[31mHTTP error: ${response.status}\x1b[0m\r\n`);
        }

      } catch (error) {
        // Connection failed
        setIsConnected(false);
        setIsReady(false);
        xtermRef.current?.write(`\x1b[31mFailed: ${error}\x1b[0m\r\n`);
      }
    };

    return (
      <div className={`compiler-terminal ${className || ''}`}>
        <div 
          ref={terminalRef} 
          className="h-full w-full"
          style={{ minHeight: '300px' }}
        />
      </div>
    );
  }
);

CompilerTerminal.displayName = 'CompilerTerminal';