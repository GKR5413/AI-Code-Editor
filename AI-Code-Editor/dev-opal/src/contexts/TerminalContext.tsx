/**
 * Terminal Context
 * Global state management for agentic terminal system
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  TerminalInstance,
  TerminalCommand,
  TerminalSettings,
  TerminalManagerState,
  DEFAULT_TERMINAL_SETTINGS,
  AgentTerminalRequest,
  TerminalOutput,
} from '../components/terminal/types';
import {
  TerminalExecutionService,
  terminalExecutionService,
} from '../services/terminal/TerminalExecutionService';

// Action types
type TerminalAction =
  | { type: 'ADD_TERMINAL'; terminal: TerminalInstance }
  | { type: 'REMOVE_TERMINAL'; terminalId: string }
  | { type: 'UPDATE_TERMINAL'; terminalId: string; updates: Partial<TerminalInstance> }
  | { type: 'SET_ACTIVE_TERMINAL'; terminalId: string | null }
  | { type: 'ADD_OUTPUT'; terminalId: string; output: TerminalOutput }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<TerminalSettings> }
  | { type: 'QUEUE_COMMAND'; command: TerminalCommand }
  | { type: 'REMOVE_COMMAND_FROM_QUEUE'; commandId: string }
  | { type: 'MINIMIZE_TERMINAL'; terminalId: string }
  | { type: 'MAXIMIZE_TERMINAL'; terminalId: string }
  | { type: 'RESTORE_TERMINAL'; terminalId: string }
  | { type: 'BRING_TO_FRONT'; terminalId: string }
  | { type: 'CLOSE_ALL_TERMINALS' };

// Reducer
function terminalReducer(
  state: TerminalManagerState,
  action: TerminalAction
): TerminalManagerState {
  switch (action.type) {
    case 'ADD_TERMINAL':
      return {
        ...state,
        terminals: [...state.terminals, action.terminal],
        activeTerminalId: action.terminal.id,
      };

    case 'REMOVE_TERMINAL':
      return {
        ...state,
        terminals: state.terminals.filter((t) => t.id !== action.terminalId),
        activeTerminalId:
          state.activeTerminalId === action.terminalId
            ? state.terminals[0]?.id || null
            : state.activeTerminalId,
      };

    case 'UPDATE_TERMINAL': {
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId ? { ...t, ...action.updates } : t
        ),
      };
    }

    case 'SET_ACTIVE_TERMINAL':
      return {
        ...state,
        activeTerminalId: action.terminalId,
      };

    case 'ADD_OUTPUT': {
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId
            ? { ...t, output: [...t.output, action.output] }
            : t
        ),
      };
    }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    case 'QUEUE_COMMAND':
      return {
        ...state,
        commandQueue: [...state.commandQueue, action.command],
      };

    case 'REMOVE_COMMAND_FROM_QUEUE':
      return {
        ...state,
        commandQueue: state.commandQueue.filter((c) => c.id !== action.commandId),
      };

    case 'MINIMIZE_TERMINAL':
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId
            ? { ...t, isMinimized: true, isMaximized: false }
            : t
        ),
      };

    case 'MAXIMIZE_TERMINAL':
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId
            ? { ...t, isMaximized: true, isMinimized: false }
            : t
        ),
      };

    case 'RESTORE_TERMINAL':
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId
            ? { ...t, isMaximized: false, isMinimized: false }
            : t
        ),
      };

    case 'BRING_TO_FRONT': {
      const maxZ = Math.max(...state.terminals.map((t) => t.zIndex), 1000);
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.id === action.terminalId ? { ...t, zIndex: maxZ + 1 } : t
        ),
        activeTerminalId: action.terminalId,
      };
    }

    case 'CLOSE_ALL_TERMINALS':
      return {
        ...state,
        terminals: [],
        activeTerminalId: null,
        commandQueue: [],
      };

    default:
      return state;
  }
}

// Context interface
interface TerminalContextType {
  state: TerminalManagerState;
  dispatch: React.Dispatch<TerminalAction>;

  // Actions
  addTerminal: (terminal: TerminalInstance) => void;
  removeTerminal: (terminalId: string) => void;
  updateTerminal: (terminalId: string, updates: Partial<TerminalInstance>) => void;
  setActiveTerminal: (terminalId: string | null) => void;
  minimizeTerminal: (terminalId: string) => void;
  maximizeTerminal: (terminalId: string) => void;
  restoreTerminal: (terminalId: string) => void;
  bringToFront: (terminalId: string) => void;
  closeAllTerminals: () => void;

  // Command execution
  executeAgentRequest: (request: AgentTerminalRequest) => Promise<void>;
  killCommand: (terminalId: string) => Promise<void>;
  updateSettings: (settings: Partial<TerminalSettings>) => void;

  // Utilities
  getTerminal: (terminalId: string) => TerminalInstance | undefined;
  getActiveTerminal: () => TerminalInstance | undefined;
}

// Create context
const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

// Initial state
const initialState: TerminalManagerState = {
  terminals: [],
  activeTerminalId: null,
  settings: DEFAULT_TERMINAL_SETTINGS,
  commandQueue: [],
};

// Provider component
export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialState);

  // Initialize execution service with callbacks
  useEffect(() => {
    const executionService = new TerminalExecutionService({
      onTerminalCreated: (terminal) => {
        dispatch({ type: 'ADD_TERMINAL', terminal });
      },
      onCommandQueued: (command) => {
        dispatch({ type: 'QUEUE_COMMAND', command });
      },
      onCommandExecuting: (terminalId, command) => {
        dispatch({
          type: 'UPDATE_TERMINAL',
          terminalId,
          updates: { state: 'running', command },
        });
      },
      onCommandCompleted: (terminalId, exitCode) => {
        dispatch({
          type: 'UPDATE_TERMINAL',
          terminalId,
          updates: { state: 'completed', exitCode, endTime: new Date() },
        });
      },
      onCommandFailed: (terminalId, error) => {
        dispatch({
          type: 'UPDATE_TERMINAL',
          terminalId,
          updates: { state: 'failed' },
        });
      },
      onOutput: (terminalId, output) => {
        dispatch({ type: 'ADD_OUTPUT', terminalId, output });
      },
      onApprovalRequired: async (terminalId, command) => {
        // Show approval dialog
        return new Promise((resolve) => {
          // TODO: Implement approval UI
          const confirmed = window.confirm(
            `Approve command execution?\n\nCommand: ${command.command}\nWorking Directory: ${command.workingDir}\nSafety: ${command.safety}\n\nReasoning: ${command.reasoning || 'N/A'}`
          );
          resolve(confirmed);
        });
      },
    });

    // Store for cleanup
    (window as any).__terminalExecutionService = executionService;

    return () => {
      // Cleanup
      delete (window as any).__terminalExecutionService;
    };
  }, []);

  // Actions
  const addTerminal = useCallback((terminal: TerminalInstance) => {
    dispatch({ type: 'ADD_TERMINAL', terminal });
  }, []);

  const removeTerminal = useCallback((terminalId: string) => {
    dispatch({ type: 'REMOVE_TERMINAL', terminalId });
  }, []);

  const updateTerminal = useCallback(
    (terminalId: string, updates: Partial<TerminalInstance>) => {
      dispatch({ type: 'UPDATE_TERMINAL', terminalId, updates });
    },
    []
  );

  const setActiveTerminal = useCallback((terminalId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TERMINAL', terminalId });
  }, []);

  const minimizeTerminal = useCallback((terminalId: string) => {
    dispatch({ type: 'MINIMIZE_TERMINAL', terminalId });
  }, []);

  const maximizeTerminal = useCallback((terminalId: string) => {
    dispatch({ type: 'MAXIMIZE_TERMINAL', terminalId });
  }, []);

  const restoreTerminal = useCallback((terminalId: string) => {
    dispatch({ type: 'RESTORE_TERMINAL', terminalId });
  }, []);

  const bringToFront = useCallback((terminalId: string) => {
    dispatch({ type: 'BRING_TO_FRONT', terminalId });
  }, []);

  const closeAllTerminals = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_TERMINALS' });
  }, []);

  const executeAgentRequest = useCallback(
    async (request: AgentTerminalRequest) => {
      const service = (window as any).__terminalExecutionService as TerminalExecutionService;
      if (service) {
        await service.processAgentRequest(request, state.settings);
      }
    },
    [state.settings]
  );

  const killCommand = useCallback(async (terminalId: string) => {
    const service = (window as any).__terminalExecutionService as TerminalExecutionService;
    if (service) {
      await service.killCommand(terminalId);
      dispatch({
        type: 'UPDATE_TERMINAL',
        terminalId,
        updates: { state: 'killed' },
      });
    }
  }, []);

  const updateSettings = useCallback((settings: Partial<TerminalSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings });
    const service = (window as any).__terminalExecutionService as TerminalExecutionService;
    if (service) {
      service.updateSettings(settings);
    }
  }, []);

  const getTerminal = useCallback(
    (terminalId: string) => {
      return state.terminals.find((t) => t.id === terminalId);
    },
    [state.terminals]
  );

  const getActiveTerminal = useCallback(() => {
    if (!state.activeTerminalId) return undefined;
    return state.terminals.find((t) => t.id === state.activeTerminalId);
  }, [state.terminals, state.activeTerminalId]);

  const value: TerminalContextType = {
    state,
    dispatch,
    addTerminal,
    removeTerminal,
    updateTerminal,
    setActiveTerminal,
    minimizeTerminal,
    maximizeTerminal,
    restoreTerminal,
    bringToFront,
    closeAllTerminals,
    executeAgentRequest,
    killCommand,
    updateSettings,
    getTerminal,
    getActiveTerminal,
  };

  return (
    <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
  );
}

// Hook to use terminal context
export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
