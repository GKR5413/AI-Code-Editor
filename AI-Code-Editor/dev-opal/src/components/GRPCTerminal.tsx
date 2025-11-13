import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { GrpcWebClient } from '@improbable-eng/grpc-web';
import { TerminalService } from '../../proto/terminal_grpc_web_pb';
import { StreamOutputRequest, ExecuteCommandRequest, CreateSessionRequest } from '../../proto/terminal_pb';

interface GRPCTerminalProps {
  sessionId: string;
  initialCommand?: string;
}

export const GRPCTerminal: React.FC<GRPCTerminalProps> = ({ sessionId, initialCommand }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const grpcClientRef = useRef<GrpcWebClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  const createTerminalSession = useCallback(async () => {
    if (!grpcClientRef.current) return;

    const request = new CreateSessionRequest();
    request.setSessionId(sessionId);
    request.setShell('bash'); // Or 'powershell.exe' for Windows
    request.setWorkingDirectory('/workspace'); // Set default workspace

    try {
      await new Promise<void>((resolve, reject) => {
        grpcClientRef.current?.rpcCall(
          TerminalService.CreateSession,
          request,
          {},
          (err, response) => {
            if (err) {
              console.error('Error creating gRPC terminal session:', err);
              reject(err);
              return;
            }
            if (!response?.getSuccess()) {
              console.error('Failed to create gRPC terminal session:', response?.getMessage());
              reject(new Error(response?.getMessage()));
              return;
            }
            console.log('gRPC terminal session created:', response?.getMessage());
            resolve();
          }
        );
      });
      setIsReady(true);
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      xtermRef.current?.write('\r\nFailed to connect to terminal service. Please check server logs.\r\n');
    }
  }, [sessionId]);

  const executeCommand = useCallback((command: string) => {
    if (!grpcClientRef.current || !xtermRef.current) return;

    const request = new ExecuteCommandRequest();
    request.setSessionId(sessionId);
    request.setCommand(command);
    request.setWorkingDirectory('/workspace'); // Ensure command executes in shared workspace

    grpcClientRef.current?.rpcCall(
      TerminalService.ExecuteCommand,
      request,
      {},
      (err, response) => {
        if (err) {
          console.error('Error executing command:', err);
          xtermRef.current?.write(`\r\nError: ${err.message}\r\n`);
          return;
        }
        if (!response?.getSuccess()) {
          console.error('Failed to execute command:', response?.getError());
          xtermRef.current?.write(`\r\nError: ${response?.getError()}\r\n`);
          return;
        }
        // Output is streamed via streamOutput, so no need to write here
      }
    );
  }, [sessionId]);

  const streamTerminalOutput = useCallback(() => {
    if (!grpcClientRef.current || !xtermRef.current) return;

    const request = new StreamOutputRequest();
    request.setSessionId(sessionId);
    request.setFollow(true);

    const stream = grpcClientRef.current?.serverStreaming(
      TerminalService.StreamOutput,
      request,
      {}
    );

    stream?.on('data', (response) => {
      xtermRef.current?.write(response.getData());
    });

    stream?.on('end', () => {
      console.log('Terminal output stream ended.');
    });

    stream?.on('status', (status) => {
      console.log('Terminal output stream status:', status);
    });

    stream?.on('error', (err) => {
      console.error('Terminal output stream error:', err);
      xtermRef.current?.write(`\r\nStream Error: ${err.message}\r\n`);
    });
  }, [sessionId]);

  useEffect(() => {
    if (terminalRef.current) {
      // Initialize xterm.js
      const term = new Terminal({
        convertEol: true,
        fontFamily: `'Fira Code', monospace`,
        fontSize: 14,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selectionBackground: '#5f5f5f',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e7e7e7',
        },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Initialize gRPC client
      // Assuming gRPC-Web proxy is running on the same host as the frontend
      grpcClientRef.current = new GrpcWebClient('http://localhost:8080'); // gRPC-Web proxy port

      // Create session and start streaming
      createTerminalSession();

      // Handle user input
      term.onData((data) => {
        // For now, we'll just echo input. In a real scenario, you'd send this to the backend.
        // For simplicity, we'll treat input as commands for now.
        if (data === '\r') { // Enter key
          const command = term.buffer.active.getLine(term.buffer.active.cursorY)?.translateToString(true);
          if (command) {
            executeCommand(command.trim());
            term.write('\r\n'); // New line after command
          }
        } else {
          term.write(data);
        }
      });

      // Resize observer
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserver.observe(terminalRef.current);

      return () => {
        term.dispose();
        resizeObserver.disconnect();
      };
    }
  }, [createTerminalSession, executeCommand, streamTerminalOutput, sessionId]);

  useEffect(() => {
    if (isReady && initialCommand) {
      executeCommand(initialCommand);
    }
  }, [isReady, initialCommand, executeCommand]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-700 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>Container Terminal</span>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1" />
    </div>
  );
};
