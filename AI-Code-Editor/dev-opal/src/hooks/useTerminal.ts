import { useRef, useCallback, useState } from 'react';

export interface TerminalMethods {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
  fit: () => void;
  isConnected: boolean;
}

export const useTerminal = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);

  const getTerminalMethods = useCallback((): TerminalMethods | null => {
    const terminalElement = terminalRef.current;
    if (terminalElement && (terminalElement as any).terminalMethods) {
      return (terminalElement as any).terminalMethods;
    }
    return null;
  }, []);

  const writeToTerminal = useCallback((data: string) => {
    const methods = getTerminalMethods();
    if (methods) {
      methods.write(data);
    }
  }, [getTerminalMethods]);

  const clearTerminal = useCallback(() => {
    const methods = getTerminalMethods();
    if (methods) {
      methods.clear();
    }
    setTerminalOutput([]);
  }, [getTerminalMethods]);

  const focusTerminal = useCallback(() => {
    const methods = getTerminalMethods();
    if (methods) {
      methods.focus();
    }
  }, [getTerminalMethods]);

  const fitTerminal = useCallback(() => {
    const methods = getTerminalMethods();
    if (methods) {
      methods.fit();
    }
  }, [getTerminalMethods]);

  const executeCommand = useCallback((command: string) => {
    const methods = getTerminalMethods();
    if (methods && methods.isConnected) {
      methods.write(command + '\\r');
      setTerminalOutput(prev => [...prev, `$ ${command}`]);
    } else {
      console.warn('Terminal is not connected');
    }
  }, [getTerminalMethods]);

  const handleTerminalData = useCallback((data: string) => {
    // Log terminal output for debugging or processing
    console.log('Terminal output:', data);
    setTerminalOutput(prev => [...prev, data]);
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    console.log(`Terminal resized to ${cols}x${rows}`);
  }, []);

  return {
    terminalRef,
    isConnected,
    terminalOutput,
    writeToTerminal,
    clearTerminal,
    focusTerminal,
    fitTerminal,
    executeCommand,
    handleTerminalData,
    handleTerminalResize,
    getTerminalMethods
  };
};