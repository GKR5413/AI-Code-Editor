import React, { useRef } from 'react';
import TopBar from '@/components/TopBar';
import FileExplorer from '@/components/FileExplorer';
import CompilerPanel from '@/components/CompilerPanel';
import CodeEditor from '@/components/CodeEditor';
import ResizablePanel from '@/components/ResizablePanel';
import { TerminalTabs } from '@/components/TerminalTabs';

export default function Index() {
  const compilerTerminalRef = useRef(null);

  const handleCompilerTerminalReady = (terminalRef: any) => {
    compilerTerminalRef.current = terminalRef;
    // Make it globally available for CompilerPanel
    (window as any).compilerTerminalRef = terminalRef;
    (window as any).switchToCompilerTerminal = () => {
      // This will be implemented by TerminalTabs component
    };
  };

  return (
    <div className="h-screen flex flex-col bg-md-surface">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanel
          direction="vertical"
          minSize={200}
          maxSize={400}
          defaultSize={280}
          persistKey="fileExplorerWidth"
          className="border-r border-ide-panel-border"
        >
          <FileExplorer />
        </ResizablePanel>

        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <CodeEditor />
          </div>
          <ResizablePanel
            direction="horizontal"
            minSize={150}
            maxSize={400}
            defaultSize={200}
            persistKey="terminalHeight"
            className="border-t border-ide-panel-border"
          >
            <TerminalTabs 
              onCompilerTerminalReady={handleCompilerTerminalReady}
              className="h-full"
            />
          </ResizablePanel>
        </div>

        <ResizablePanel
          direction="vertical"
          minSize={300}
          maxSize={500}
          defaultSize={350}
          persistKey="compilerPanelWidth"
          className="border-l border-ide-panel-border"
        >
          <CompilerPanel />
        </ResizablePanel>
      </div>
    </div>
  );
}
