import React, { useRef } from 'react';
import { CompilerTerminal, CompilerTerminalRef } from './CompilerTerminal';

interface TerminalTabsProps {
  className?: string;
  onCompilerTerminalReady?: (terminalRef: CompilerTerminalRef | null) => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ 
  className, 
  onCompilerTerminalReady 
}) => {
  const compilerTerminalRef = useRef<CompilerTerminalRef>(null);

  const handleCompilerTerminalReady = (terminal: any) => {
    console.log('🔌 Compiler terminal ready:', terminal);
    onCompilerTerminalReady?.(compilerTerminalRef.current);
    // Also make it globally available
    (window as any).compilerTerminalRef = compilerTerminalRef.current;
  };

  // Expose compiler terminal globally
  React.useEffect(() => {
    (window as any).switchToCompilerTerminal = () => {
      // No switching needed - only compiler terminal exists
    };
  }, []);

  return (
    <div className={`terminal-container ${className || ''}`}>
      <div className="h-full flex flex-col">
        {/* Minimal Status Bar - Just status indicator and container info */}
        <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-700 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            {/* Status indicator - green dot for online, red for offline */}
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Container Terminal</span>
          </div>
          
          <div className="flex items-center gap-2 text-gray-400">
            <span></span>
          </div>
        </div>

        {/* Clean Terminal - No extra text or bars */}
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <CompilerTerminal
              ref={compilerTerminalRef}
              className="h-full"
              onReady={handleCompilerTerminalReady}
            />
          </div>
        </div>
      </div>
    </div>
  );
};