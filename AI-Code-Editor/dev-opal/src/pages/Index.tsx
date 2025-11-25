import React, { useRef } from 'react';
import AIChat from '@/components/AIChat';
import TopBar from '@/components/TopBar';
import FileExplorer from '@/components/FileExplorer';
import CodeEditor from '@/components/CodeEditor';
import ResizablePanel from '@/components/ResizablePanel';
import { ContainerTerminal } from '@/components/ContainerTerminal';
import { TerminalManager } from '@/components/terminal/TerminalManager';

export default function Index() {


  return (
    <div className="h-screen flex flex-col bg-md-surface">
      <TopBar />
      {/* Ensure content starts below sticky header height (h-12) */}
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
            <ContainerTerminal />
          </ResizablePanel>
        </div>

        <ResizablePanel
          direction="vertical"
          minSize={300}
          maxSize={600}
          defaultSize={400}
          persistKey="aiChatPanelWidth"
          className="border-l border-ide-panel-border"
        >
          <AIChat />
        </ResizablePanel>
      </div>

      {/* Agentic Terminal System - Auto-spawns when agents need terminal access */}
      <TerminalManager />
    </div>
  );
}
