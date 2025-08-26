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
  executeProgram: (language: string, code: string, filename: string) => void;
}

export const CompilerTerminal = forwardRef<CompilerTerminalRef, CompilerTerminalProps>(
  ({ className, onReady }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTermTerminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      getTerminal: () => xtermRef.current,
      focus: () => xtermRef.current?.focus(),
      clear: () => xtermRef.current?.clear(),
      write: (data: string) => xtermRef.current?.write(data),
      runCommand: (command: string) => {
        if (wsRef.current && isConnected && isReady) {
          wsRef.current.send(JSON.stringify({
            type: 'input',
            data: `${command}\r`
          }));
        }
      },
      executeProgram: async (language: string, code: string, filename: string) => {
        await executeProgram(language, code, filename);
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
          selection: 'rgba(255, 255, 255, 0.3)',
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

      // Connect to actual Docker terminal service
      connectToTerminalService();

      // Handle terminal input - send to real terminal
      terminal.onData((data) => {
        if (wsRef.current && isConnected && isReady) {
          wsRef.current.send(JSON.stringify({
            type: 'input',
            data: data
          }));
        }
      });

      // Handle resize
      const handleResize = () => {
        fitAddon.fit();
        // Send resize to terminal service
        if (wsRef.current && isConnected) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            rows: terminal.rows,
            cols: terminal.cols
          }));
        }
      };

      window.addEventListener('resize', handleResize);
      onReady?.(terminal);

      return () => {
        terminal.dispose();
        wsRef.current?.close();
        window.removeEventListener('resize', handleResize);
      };
    }, [onReady]);

    const connectToTerminalService = () => {
      try {
        xtermRef.current?.write('\x1b[36m🔌 Connecting to Docker terminal...\x1b[0m\r\n');
        
        // Connect to real Docker terminal service
        const ws = new WebSocket('ws://localhost:3003');
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          xtermRef.current?.write('\x1b[32m✅ Connected to Docker terminal\x1b[0m\r\n');
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              setIsReady(true);
              setSessionId(data.sessionId);
              xtermRef.current?.write('\x1b[32m🐳 Docker container ready for compilation\x1b[0m\r\n');
              break;
              
            case 'output':
              xtermRef.current?.write(data.data);
              break;
              
            case 'clear':
              xtermRef.current?.clear();
              break;
              
            default:
              console.log('Terminal message:', data);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          setIsReady(false);
          xtermRef.current?.write('\r\n\x1b[31m❌ Terminal disconnected\x1b[0m\r\n');
        };

        ws.onerror = (error) => {
          console.error('Terminal WebSocket error:', error);
          setIsConnected(false);
          setIsReady(false);
          xtermRef.current?.write('\x1b[31m❌ Failed to connect to terminal\x1b[0m\r\n');
        };

      } catch (error) {
        console.error('Failed to connect to terminal service:', error);
        xtermRef.current?.write('\x1b[31m❌ Failed to connect to terminal service\x1b[0m\r\n');
      }
    };

    const executeProgram = async (language: string, code: string, filename: string) => {
      if (!wsRef.current || !isConnected || !isReady) {
        xtermRef.current?.write('\x1b[31m❌ Terminal not ready\x1b[0m\r\n');
        return;
      }

      xtermRef.current?.write(`\x1b[36m🚀 Compiling and running ${filename}...\x1b[0m\r\n`);
      
      // Create temporary file and execute
      const tempFilename = `/tmp/compiler_${Date.now()}_${filename}`;
      
      // Write code to file
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: `cat > ${tempFilename} << 'EOF'\r`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: `${code}\r`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: `EOF\r`
      }));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Execute the program based on language
      let runCommand = '';
      switch (language) {
        case 'python':
          runCommand = `python3 ${tempFilename}`;
          break;
        case 'javascript':
          runCommand = `node ${tempFilename}`;
          break;
        case 'java':
          const className = filename.replace('.java', '');
          runCommand = `cd /tmp && javac ${tempFilename} && java ${className}`;
          break;
        case 'c':
          const cExecutable = tempFilename.replace('.c', '');
          runCommand = `gcc ${tempFilename} -o ${cExecutable} && ${cExecutable}`;
          break;
        case 'cpp':
          const cppExecutable = tempFilename.replace('.cpp', '');
          runCommand = `g++ ${tempFilename} -o ${cppExecutable} && ${cppExecutable}`;
          break;
        default:
          runCommand = `python3 ${tempFilename}`;
      }
      
      xtermRef.current?.write(`\x1b[33m📤 Executing: ${runCommand}\x1b[0m\r\n`);
      xtermRef.current?.write('\x1b[33m' + '='.repeat(50) + '\x1b[0m\r\n');
      
      wsRef.current.send(JSON.stringify({
        type: 'input',
        data: `${runCommand}\r`
      }));
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