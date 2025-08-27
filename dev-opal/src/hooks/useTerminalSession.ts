import { useState, useCallback, useRef } from 'react';
import { terminalClient, TerminalGrpcClient } from '../services/terminalGrpcClient';

export interface TerminalSession {
  sessionId: string;
  workingDirectory: string;
  isConnected: boolean;
  isActive: boolean;
}

/**
 * Custom hook for managing terminal sessions
 * Provides extensibility for multiple terminals, session persistence, etc.
 */
export const useTerminalSession = (initialWorkingDir = '/workspace') => {
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const streamRefs = useRef<Map<string, any>>(new Map());

  /**
   * Create a new terminal session
   */
  const createSession = useCallback(async (
    workingDirectory = initialWorkingDir,
    shell = 'bash'
  ) => {
    const sessionId = TerminalGrpcClient.generateSessionId();
    
    try {
      const response = await terminalClient.createSession(
        sessionId,
        workingDirectory,
        shell
      );

      if (response.getSuccess()) {
        const newSession: TerminalSession = {
          sessionId,
          workingDirectory,
          isConnected: true,
          isActive: true
        };

        setSessions(prev => new Map(prev).set(sessionId, newSession));
        setCurrentSessionId(sessionId);

        return { success: true, session: newSession };
      } else {
        return { success: false, error: response.getMessage() };
      }
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [initialWorkingDir]);

  /**
   * Execute command in a session
   */
  const executeCommand = useCallback(async (
    sessionId: string,
    command: string
  ) => {
    const session = sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error('Session not connected');
    }

    try {
      return await terminalClient.executeCommand(
        sessionId,
        command,
        session.workingDirectory
      );
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  }, [sessions]);

  /**
   * Start streaming output for a session
   */
  const startOutputStreaming = useCallback((
    sessionId: string,
    onData: (data: string) => void,
    onError?: (error: any) => void
  ) => {
    // Stop any existing stream for this session
    const existingStream = streamRefs.current.get(sessionId);
    if (existingStream) {
      existingStream.close?.();
    }

    const stream = terminalClient.streamOutput(
      sessionId,
      (chunk) => {
        onData(chunk.getData());
      },
      (error) => {
        console.error('Stream error:', error);
        onError?.(error);
        
        // Mark session as disconnected
        setSessions(prev => {
          const updated = new Map(prev);
          const session = updated.get(sessionId);
          if (session) {
            updated.set(sessionId, { ...session, isConnected: false });
          }
          return updated;
        });
      },
      () => {
        console.log('Stream ended for session:', sessionId);
        streamRefs.current.delete(sessionId);
      }
    );

    streamRefs.current.set(sessionId, stream);
    return stream;
  }, []);

  /**
   * Get current session
   */
  const getCurrentSession = useCallback(() => {
    if (!currentSessionId) return null;
    return sessions.get(currentSessionId) || null;
  }, [currentSessionId, sessions]);

  /**
   * Switch to a different session
   */
  const switchSession = useCallback((sessionId: string) => {
    if (sessions.has(sessionId)) {
      setCurrentSessionId(sessionId);
      return true;
    }
    return false;
  }, [sessions]);

  /**
   * Close a session
   */
  const closeSession = useCallback((sessionId: string) => {
    // Close any active streams
    const stream = streamRefs.current.get(sessionId);
    if (stream) {
      stream.close?.();
      streamRefs.current.delete(sessionId);
    }

    // Remove from sessions
    setSessions(prev => {
      const updated = new Map(prev);
      updated.delete(sessionId);
      return updated;
    });

    // If this was the current session, clear it
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  /**
   * Get all sessions
   */
  const getAllSessions = useCallback(() => {
    return Array.from(sessions.values());
  }, [sessions]);

  return {
    sessions: getAllSessions(),
    currentSession: getCurrentSession(),
    createSession,
    executeCommand,
    startOutputStreaming,
    switchSession,
    closeSession,
    currentSessionId
  };
};