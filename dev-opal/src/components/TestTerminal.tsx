import React, { useState, useEffect, useRef } from 'react';

const TestTerminal: React.FC = () => {
  const [output, setOutput] = useState<string[]>(['🧪 Test Terminal Ready']);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    console.log('🔌 TestTerminal: Connecting...');
    
    ws.current = new WebSocket('ws://localhost:3004');

    ws.current.onopen = () => {
      console.log('✅ TestTerminal: Connected');
      setConnected(true);
      setOutput(prev => [...prev, '✅ Connected to terminal server']);
    };

    ws.current.onmessage = (event) => {
      console.log('📨 TestTerminal: Raw message:', event.data);
      
      try {
        const message = JSON.parse(event.data);
        console.log('📨 TestTerminal: Parsed:', message);
        
        if (message.type === 'output') {
          const cleanOutput = message.data
            .replace(/\x1b\[[0-9;]*m/g, '')
            .replace(/\r/g, '');
          setOutput(prev => [...prev, cleanOutput]);
        }
        
        if (message.type === 'connected') {
          setOutput(prev => [...prev, `🔗 Session: ${message.sessionId.slice(-8)}`]);
        }
        
      } catch (error) {
        console.error('❌ TestTerminal: Parse error:', error);
        setOutput(prev => [...prev, `❌ Parse error: ${error.message}`]);
      }
    };

    ws.current.onclose = () => {
      console.log('❌ TestTerminal: Disconnected');
      setConnected(false);
      setOutput(prev => [...prev, '❌ Disconnected']);
    };

    ws.current.onerror = (error) => {
      console.error('❌ TestTerminal: Error:', error);
      setOutput(prev => [...prev, '❌ Connection error']);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendCommand = () => {
    if (!input.trim()) return;
    
    console.log('📤 TestTerminal: Sending command:', input);
    console.log('📤 TestTerminal: WebSocket state:', ws.current?.readyState);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type: 'input', data: input + '\n' });
      console.log('📤 TestTerminal: Sending message:', message);
      
      ws.current.send(message);
      setOutput(prev => [...prev, `$ ${input}`]);
      setInput('');
    } else {
      console.error('❌ TestTerminal: WebSocket not ready');
      setOutput(prev => [...prev, '❌ Not connected']);
    }
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#1a1a1a',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '14px'
    }}>
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#333', 
        borderBottom: '1px solid #555',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span>🧪 Test Terminal</span>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: connected ? '#0f0' : '#f00'
        }} />
        <span style={{ fontSize: '12px', color: '#aaa' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div style={{ 
        flex: 1, 
        padding: '10px', 
        overflow: 'auto',
        backgroundColor: '#000'
      }}>
        {output.map((line, index) => (
          <div key={index} style={{ marginBottom: '2px', whiteSpace: 'pre-wrap' }}>
            {line}
          </div>
        ))}
      </div>
      
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#333', 
        borderTop: '1px solid #555',
        display: 'flex',
        gap: '10px'
      }}>
        <span style={{ color: '#0f0' }}>$</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              sendCommand();
            }
          }}
          placeholder="Type command and press Enter"
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'white',
            fontFamily: 'inherit'
          }}
          autoFocus
        />
        <button 
          onClick={sendCommand}
          disabled={!connected}
          style={{
            padding: '5px 10px',
            backgroundColor: connected ? '#007acc' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: connected ? 'pointer' : 'not-allowed'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default TestTerminal;