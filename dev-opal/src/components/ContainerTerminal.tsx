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
      // Try to connect to compiler service terminal endpoint
      const response = await fetch('http://localhost:3002/terminal/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          shell: 'bash',
          working_directory: '/workspace',
          cols: terminal.cols,
          rows: terminal.rows
        })
      });

      if (response.ok) {
        setStatus('Connected');

        // Setup command execution
        setupCommandExecution(terminal);
        
        // Show initial prompt
        terminal.write('$ ');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Backend connection error:', error);
      terminal.write('Failed to connect to container terminal\r\n');
      terminal.write('Using local echo mode instead\r\n\r\n');
      setStatus('Local Mode');
      
      // Fallback to local mode
      setupLocalMode(terminal);
    }
  };

  const setupCommandExecution = (terminal: Terminal) => {
    let currentLine = '';
    
    terminal.onData(async (data) => {
      if (data === '\r' || data === '\n') {
        terminal.write('\r\n');
        
        if (currentLine.trim()) {
          await executeCommand(terminal, currentLine.trim());
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
  };

  const executeCommand = async (terminal: Terminal, command: string) => {
    try {
      const response = await fetch('http://localhost:3002/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          command: command,
          working_directory: '/workspace'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.output) {
          // Properly format the output with correct line breaks
          let formattedOutput = result.output;
          
          // Convert Unix line endings to terminal line endings
          formattedOutput = formattedOutput.replace(/\n/g, '\r\n');
          
          // Ensure proper spacing for ls output
          if (command.trim().startsWith('ls')) {
            // For ls command, format as proper lines
            formattedOutput = formattedOutput
              .split('\r\n')
              .filter(line => line.trim())
              .join('\r\n');
            
            if (formattedOutput && !formattedOutput.endsWith('\r\n')) {
              formattedOutput += '\r\n';
            }
          }
          
          terminal.write(formattedOutput);
        }
        if (result.error) {
          terminal.write(`${result.error.replace(/\n/g, '\r\n')}`);
        }
      } else {
        terminal.write(`HTTP Error: ${response.status}\r\n`);
      }
    } catch (error) {
      terminal.write(`Command error: ${error}\r\n`);
    }
    
    terminal.write('$ ');
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