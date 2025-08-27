import React, { useState } from 'react';
import SimpleTerminal from './SimpleTerminal';

export const SimpleLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'files' | 'chat'>('terminal');

  return (
    <div className="simple-layout" style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
      color: '#ffffff',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
    }}>
      {/* Minimal Header */}
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
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'terminal' && (
          <div style={{ width: '100%', height: '100%' }}>
            <SimpleTerminal />
          </div>
        )}
        
        {activeTab === 'files' && (
          <div style={{
            padding: '20px',
            color: '#ffffff'
          }}>
            <h2>File Explorer</h2>
            <p>File management coming soon...</p>
          </div>
        )}
        
        {activeTab === 'chat' && (
          <div style={{
            padding: '20px',
            color: '#ffffff'
          }}>
            <h2>AI Chat</h2>
            <p>AI Assistant coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleLayout;
