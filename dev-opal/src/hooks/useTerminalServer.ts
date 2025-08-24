import { useState, useEffect, useCallback } from 'react';
import { terminalConfig } from '@/config/terminal';

interface ServerStatus {
  running: boolean;
  connecting: boolean;
  error: string | null;
}

export const useTerminalServer = (checkInterval = 5000) => {
  const [status, setStatus] = useState<ServerStatus>({
    running: false,
    connecting: true,
    error: null,
  });

  const checkServerHealth = useCallback(async () => {
    setStatus(prev => ({ ...prev, connecting: true }));
    try {
      const response = await fetch(terminalConfig.HEALTH_ENDPOINT);
      if (response.ok) {
        setStatus({ running: true, connecting: false, error: null });
      } else {
        setStatus({ running: false, connecting: false, error: 'Server not responding' });
      }
    } catch (error) {
      setStatus({ running: false, connecting: false, error: 'Failed to connect' });
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, checkInterval);
    return () => clearInterval(interval);
  }, [checkServerHealth, checkInterval]);

  return { status, checkServerHealth };
};