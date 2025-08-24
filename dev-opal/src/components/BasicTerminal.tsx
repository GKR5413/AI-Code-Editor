import React, { useState, useEffect, useRef } from 'react';

const BasicTerminal: React.FC = () => {
  const [output, setOutput] = useState<{type: 'command' | 'output', content: string, path?: string}[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [currentPath, setCurrentPath] = useState('/app/workspace');
  const ws = useRef<WebSocket | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when output changes
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // WebSocket connection
  useEffect(() => {    
    ws.current = new WebSocket('ws://localhost:3006');

    ws.current.onopen = () => {
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'output') {
          const cleanOutput = message.data
            .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI color codes
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, ''); // Remove remaining carriage returns
          
          // Filter out Docker welcome messages, prompts, and empty lines
          if (cleanOutput.includes('🐳 Docker Terminal Connected Successfully!') ||
              cleanOutput.includes('📁 Workspace:') ||
              cleanOutput.includes('🔒 Session:') ||
              cleanOutput.includes('developer@container:/app/workspace$') ||
              cleanOutput.match(/^[~\/].*\$ ?$/) ||
              cleanOutput.trim() === '') {
            return; // Skip these messages
          }
          
          // Add output as a single entry (don't split lines)
          if (cleanOutput.trim()) {
            setOutput(prev => [...prev, { type: 'output', content: cleanOutput.trim() }]);
          }
        } else if (message.type === 'clear') {
          // Clear terminal output
          setOutput([]);
        }

      } catch (error) {
        // Ignore parse errors silently
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
    };

    ws.current.onerror = () => {
      setConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendCommand = () => {
    if (!currentInput.trim() || !connected) return;
    
    const command = currentInput.trim();
    
    // Update current path for cd commands
    if (command.startsWith('cd ')) {
      const newPath = command.substring(3).trim();
      if (newPath === '..') {
        // Go up one directory
        const pathParts = currentPath.split('/').filter(p => p);
        if (pathParts.length > 2) { // Don't go above /app/workspace
          pathParts.pop();
          setCurrentPath('/' + pathParts.join('/'));
        }
      } else if (newPath === '~' || newPath === '') {
        setCurrentPath('/app/workspace');
      } else if (newPath.startsWith('/')) {
        if (newPath.startsWith('/app/workspace')) {
          setCurrentPath(newPath);
        }
      } else {
        // Relative path
        const newFullPath = currentPath === '/app/workspace' ? 
          `/app/workspace/${newPath}` : 
          `${currentPath}/${newPath}`;
        setCurrentPath(newFullPath);
      }
    }
    
    // Add command to output history with current path
    setOutput(prev => [...prev, { type: 'command', content: command, path: currentPath }]);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      // Send to WebSocket - Docker terminal expects each character
      for (const char of currentInput) {
        ws.current.send(JSON.stringify({ 
          type: 'input', 
          data: char
        }));
      }
      
      // Send Enter key
      ws.current.send(JSON.stringify({ 
        type: 'input', 
        data: '\r'
      }));
      
      // Clear input
      setCurrentInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  return (
    <div className="h-full flex flex-col bg-black text-white">
      {/* Simple Header */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-300">Terminal</span>
        <button
          onClick={clearTerminal}
          className="text-xs px-2 py-1 text-gray-400 hover:text-white"
        >
          clear
        </button>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-sm leading-normal">
        {output.map((entry, index) => (
          <div key={index} className="mb-1">
            {entry.type === 'command' ? (
              <div className="flex">
                <span className="text-blue-400 mr-2">root@container:{entry.path || currentPath}#</span>
                <span className="text-white">{entry.content}</span>
              </div>
            ) : (
              <div className="text-gray-200 whitespace-pre-wrap pl-0">
                {entry.content}
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center mt-2">
          <span className="text-blue-400 mr-2">root@container:{currentPath}#</span>
          <input
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm"
            placeholder=""
            autoFocus
            style={{ caretColor: 'white' }}
          />
        </div>
        <div ref={outputEndRef} />
      </div>
    </div>
  );
};

export default BasicTerminal;