import React, { useState, useRef } from 'react';
import SimpleTerminal from './SimpleTerminal';
import AIChat from './AIChat';

interface IDEFile {
  name: string;
  path: string;
  type: 'file' | 'directory';
  content?: string;
}

export const IDELayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'files' | 'editor' | 'terminal' | 'chat'>('files');
  const [files, setFiles] = useState<IDEFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<IDEFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [isLoading, setIsLoading] = useState(false);

  // Load files from current directory
  const loadFiles = async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3002/workspace/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', path: path })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFiles(data.files);
          setCurrentPath(path);
        }
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load file content
  const loadFileContent = async (file: IDEFile) => {
    try {
      const response = await fetch('http://localhost:3002/workspace/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', path: file.path })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFileContent(data.content);
          setSelectedFile(file);
        }
      }
    } catch (error) {
      console.error('Error loading file content:', error);
    }
  };

  // Save file content
  const saveFile = async () => {
    if (!selectedFile) return;

    try {
      const response = await fetch('http://localhost:3002/workspace/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'write', 
          path: selectedFile.path, 
          content: fileContent 
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('File saved successfully');
        }
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  // Handle file click
  const handleFileClick = (file: IDEFile) => {
    if (file.type === 'directory') {
      loadFiles(file.path);
    } else {
      loadFileContent(file);
      setActiveTab('editor');
    }
  };

  // Handle directory navigation
  const handleDirectoryUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parentPath);
  };

  // Load initial files
  React.useEffect(() => {
    loadFiles('/workspace');
  }, []);

  return (
    <div className="ide-layout" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
      color: '#ffffff',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
    }}>
      {/* IDE Header */}
      <div style={{
        height: '40px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '16px'
      }}>
        <button
          onClick={() => setActiveTab('files')}
          style={{
            background: activeTab === 'files' ? '#007acc' : 'transparent',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab('editor')}
          style={{
            background: activeTab === 'editor' ? '#007acc' : 'transparent',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          style={{
            background: activeTab === 'terminal' ? '#007acc' : 'transparent',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Terminal
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            background: activeTab === 'chat' ? '#007acc' : 'transparent',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          AI Chat
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File Explorer Sidebar */}
        {activeTab === 'files' && (
          <div style={{
            width: '300px',
            backgroundColor: '#252526',
            borderRight: '1px solid #404040',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* File Explorer Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #404040',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <button
                onClick={handleDirectoryUp}
                style={{
                  background: 'transparent',
                  color: '#ffffff',
                  border: '1px solid #404040',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ↑ Up
              </button>
              <span style={{ fontSize: '12px', color: '#cccccc' }}>
                {currentPath}
              </span>
            </div>

            {/* File List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {isLoading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#cccccc' }}>
                  Loading...
                </div>
              ) : (
                files.map((file, index) => (
                  <div
                    key={index}
                    onClick={() => handleFileClick(file)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      color: file.type === 'directory' ? '#4ec9b0' : '#ffffff'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#2a2d2e';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>
                      {file.type === 'directory' ? '📁' : '📄'}
                    </span>
                    {file.name}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'editor' && selectedFile && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Editor Header */}
              <div style={{
                height: '40px',
                backgroundColor: '#2d2d2d',
                borderBottom: '1px solid #404040',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px'
              }}>
                <span style={{ fontSize: '14px', color: '#ffffff' }}>
                  {selectedFile.name}
                </span>
                <button
                  onClick={saveFile}
                  style={{
                    background: '#007acc',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Save
                </button>
              </div>

              {/* Code Editor */}
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#1e1e1e',
                  color: '#ffffff',
                  border: 'none',
                  outline: 'none',
                  padding: '16px',
                  fontSize: '14px',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  resize: 'none'
                }}
                placeholder="Start coding here..."
              />
            </div>
          )}

          {activeTab === 'terminal' && (
            <div style={{ width: '100%', height: '100%' }}>
              <SimpleTerminal />
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ width: '100%', height: '100%' }}>
              <AIChat />
            </div>
          )}

          {activeTab === 'files' && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#cccccc',
              fontSize: '16px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <h2>File Explorer</h2>
                <p>Click on files to edit them</p>
                <p>Click on folders to navigate</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IDELayout;
