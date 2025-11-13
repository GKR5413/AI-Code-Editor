import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useIDE } from '@/contexts/IDEContext';
import Editor, { Monaco } from '@monaco-editor/react';
import { X } from 'lucide-react';

export const CodeEditor: React.FC = () => {
  const { theme } = useTheme();
  const { activeTab, tabs, setActiveTab, closeTab, updateActiveContent, editorRef } = useIDE();

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
  };

  if (!activeTab) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-12 text-gray-500 border-b border-ide-panel-border">
          No files open
        </div>
        <div className="flex items-center justify-center h-32 text-gray-500">
          Select a file to begin editing.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex items-center bg-md-surface border-b border-ide-panel-border overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2 border-r border-ide-panel-border cursor-pointer hover:bg-md-surface-variant transition-colors ${
              activeTab?.id === tab.id
                ? 'bg-md-surface-variant border-b-2 border-b-primary text-primary'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="text-sm font-medium truncate max-w-32">
              {tab.name}
              {tab.isDirty && <span className="text-yellow-400 ml-1">•</span>}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="p-1 hover:bg-md-surface-variant rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={activeTab.language}
          value={activeTab.content}
          onChange={(value) => updateActiveContent(value ?? '')}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleEditorDidMount}
          options={{ 
            minimap: { enabled: false },
            padding: { top: 0, bottom: 0 },
            scrollBeyondLastLine: false,
            automaticLayout: true
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;