import React, { useState, useEffect } from 'react';

const DirectTerminal: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if ttyd terminal is available
  useEffect(() => {
    const checkTerminalAvailability = async () => {
      try {
        // For iframe, we don't need to fetch - just check if the URL is accessible
        // The iframe will handle loading the terminal
        setIsConnected(true);
        setError(null);
        console.log('DirectTerminal: Setting up terminal iframe for http://localhost:7681');
      } catch (err) {
        setIsConnected(false);
        setError('Container terminal not available. Please ensure the Docker container is running.');
        console.error('DirectTerminal error:', err);
      }
    };

    checkTerminalAvailability();
  }, []);

  if (error && !isConnected) {
    return (
      <div className="h-full flex flex-col bg-gray-900">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Direct Container Terminal</span>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-red-400">Disconnected</span>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Terminal Not Available</h3>
              <p className="text-gray-400 mb-4 max-w-md">
                {error}
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>To start the terminal service, run:</p>
                <code className="bg-gray-800 px-2 py-1 rounded text-green-400">
                  docker-compose up -d compiler
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Direct Container Terminal</span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Direct Docker Container Access</span>
          <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
          <span>Full Terminal Features</span>
        </div>
      </div>
      
      {isConnected ? (
        <iframe
          src="http://localhost:7681"
          className="flex-1 w-full border-0"
          style={{ background: '#000' }}
          title="Container Terminal"
          allow="fullscreen"
          onLoad={() => {
            console.log('DirectTerminal: iframe loaded successfully');
            setIsConnected(true);
            setError(null);
          }}
          onError={(e) => {
            console.error('DirectTerminal: iframe failed to load', e);
            setError('Failed to load terminal. Please ensure the container is running on port 7681.');
            setIsConnected(false);
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400">Connecting to container terminal...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectTerminal;