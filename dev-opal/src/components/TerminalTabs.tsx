import React, { useState, useRef } from 'react';
import { Terminal, Code, Zap, Settings, X, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompilerTerminal, CompilerTerminalRef } from './CompilerTerminal';
import DirectTerminal from './DirectTerminal';

interface TerminalTabsProps {
  className?: string;
  onCompilerTerminalReady?: (terminalRef: CompilerTerminalRef | null) => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ 
  className, 
  onCompilerTerminalReady 
}) => {
  const [activeTab, setActiveTab] = useState('system');
  const [compilerTerminalActive, setCompilerTerminalActive] = useState(false);
  const compilerTerminalRef = useRef<CompilerTerminalRef>(null);

  const handleCompilerTerminalReady = (terminal: any) => {
    console.log('🔌 Compiler terminal ready:', terminal);
    onCompilerTerminalReady?.(compilerTerminalRef.current);
    // Also make it globally available
    (window as any).compilerTerminalRef = compilerTerminalRef.current;
  };

  const openCompilerTerminal = () => {
    setCompilerTerminalActive(true);
    setActiveTab('compiler');
  };

  // Expose switch function globally and auto-open compiler terminal
  React.useEffect(() => {
    (window as any).switchToCompilerTerminal = () => {
      openCompilerTerminal();
    };
    
    // Auto-open compiler terminal by default
    setCompilerTerminalActive(true);
  }, []);

  const closeCompilerTerminal = () => {
    setCompilerTerminalActive(false);
    setActiveTab('system');
  };

  return (
    <div className={`terminal-tabs ${className || ''}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <TabsList className="bg-transparent border-none">
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              System Terminal
            </TabsTrigger>
            {compilerTerminalActive && (
              <TabsTrigger value="compiler" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Compiler Terminal
                <Badge variant="secondary" className="text-xs">
                  Interactive
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex items-center gap-2 p-2">
            {!compilerTerminalActive && (
              <Button
                onClick={openCompilerTerminal}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 h-8"
                title="Open Compiler Terminal"
              >
                <Plus className="w-3 h-3" />
                <Code className="w-4 h-4" />
              </Button>
            )}
            {compilerTerminalActive && activeTab === 'compiler' && (
              <Button
                onClick={closeCompilerTerminal}
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Close Compiler Terminal"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              title="Terminal Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <TabsContent value="system" className="h-full m-0 p-0">
            <div className="h-full relative">
              <div className="absolute inset-0">
                <DirectTerminal />
              </div>
            </div>
          </TabsContent>

          {compilerTerminalActive && (
            <TabsContent value="compiler" className="h-full m-0 p-0">
              <div className="h-full relative">
                <div className="absolute inset-0">
                  <CompilerTerminal
                    ref={compilerTerminalRef}
                    className="h-full"
                    onReady={handleCompilerTerminalReady}
                  />
                </div>
              </div>
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Terminal status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs">
        <div className="flex items-center gap-4">
          <span className="text-gray-600 dark:text-gray-400">
            {activeTab === 'system' ? 'System Terminal' : 'Compiler Terminal'}
          </span>
          {activeTab === 'compiler' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-600 dark:text-green-400">Ready for execution</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-gray-500">
          <Zap className="w-3 h-3" />
          <span>Terminal Service</span>
        </div>
      </div>
    </div>
  );
};