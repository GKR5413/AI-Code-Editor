import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalSession } from '../hooks/useTerminalSession';

interface IntegratedTerminalProps {
  className?: string;
  workingDirectory?: string;
  onSessionChange?: (sessionId: string | null) => void;
}

/**
 * Minimal Integrated Terminal Component
 * - Uses xterm.js for display
 * - Communicates with container terminal via gRPC
 * - Minimal UI, extensible architecture
 * - Supports multiple sessions via useTerminalSession hook
 */
export const IntegratedTerminal: React.FC<IntegratedTerminalProps> = ({ 
  className = '',
  workingDirectory = '/workspace',
  onSessionChange
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use the terminal session hook for extensibility
  const {
    currentSession,
    createSession,
    executeCommand,
    startOutputStreaming,
    currentSessionId
  } = useTerminalSession(workingDirectory);

  // Initialize terminal session
  const initializeTerminal = useCallback(async () => {
    if (!terminalRef.current || isInitialized) return;

    try {
      // Create xterm instance
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace, "Courier New"',
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
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        },
        cols: 80,
        rows: 30
      });

      // Add fit addon
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Mount terminal
      terminal.open(terminalRef.current);
      fitAddon.fit();

      // Store refs
      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Show connection status
      terminal.write('Connecting to container terminal...\r\n');

      // Create gRPC terminal session using the hook
      const sessionResult = await createSession(workingDirectory, 'bash');

      if (sessionResult.success && sessionResult.session) {
        terminal.write(`✓ Connected to terminal session: ${sessionResult.session.sessionId}\r\n`);
        terminal.write('VelocIDE Container Terminal\r\n');
        terminal.write(`Working directory: ${workingDirectory}\r\n\r\n`);

        // Notify parent component of session change
        onSessionChange?.(sessionResult.session.sessionId);

        // Start output streaming
        startOutputStreaming(
          sessionResult.session.sessionId,
          (data) => terminal.write(data),
          (error) => {
            terminal.write(`\r\nStream error: ${error}\r\n`);
          }
        );

        // Handle terminal input
        terminal.onData((data) => {
          handleTerminalInput(data);
        });

      } else {
        terminal.write(`✗ Failed to create terminal session: ${sessionResult.error}\r\n`);
        terminal.write('Terminal will run in local mode.\r\n\r\n');
      }

      setIsInitialized(true);

    } catch (error) {
      console.error('Terminal initialization error:', error);
      if (xtermRef.current) {
        xtermRef.current.write(`✗ Terminal connection failed: ${error}\r\n`);
        xtermRef.current.write('Check that the terminal service is running.\r\n\r\n');
      }
    }
  }, [workingDirectory, isInitialized, createSession, startOutputStreaming, onSessionChange]);

  // Handle terminal input and send to container
  const handleTerminalInput = useCallback(async (data: string) => {
    if (!currentSession || !currentSession.isConnected || !currentSessionId) return;

    try {
      // Send input as command to terminal service
      await executeCommand(currentSessionId, data);
    } catch (error) {
      console.error('Terminal input error:', error);
      if (xtermRef.current) {
        xtermRef.current.write(`\r\nError: ${error}\r\n`);
      }
    }
  }, [currentSession, currentSessionId, executeCommand]);

  // The streaming is now handled by the useTerminalSession hook

  // Resize terminal
  const resizeTerminal = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const timer = setTimeout(initializeTerminal, 100);
    return () => clearTimeout(timer);
  }, [initializeTerminal]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', resizeTerminal);
    return () => window.removeEventListener('resize', resizeTerminal);
  }, [resizeTerminal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className={`h-full w-full relative ${className}`}>
      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="h-full w-full"
        style={{ background: '#1e1e1e' }}
      />
      
      {/* Status indicator */}
      <div className="absolute top-2 right-2 text-xs">
        <div className={`inline-flex items-center px-2 py-1 rounded text-white ${
          currentSession?.isConnected ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${
            currentSession?.isConnected ? 'bg-green-300' : 'bg-red-300'
          }`} />
          {currentSession?.isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
};