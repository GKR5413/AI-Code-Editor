/**
 * Agentic Terminal System - Public API
 * Export all terminal components and utilities
 */

export { MiniTerminal } from './MiniTerminal';
export { TerminalManager } from './TerminalManager';
export { TerminalTaskbar } from './TerminalTaskbar';
export { TerminalSettings } from './TerminalSettings';

export type {
  TerminalState,
  CommandSafety,
  TerminalCommand,
  TerminalOutput,
  TerminalInstance,
  AgentTerminalRequest,
  TerminalSettings as TerminalSettingsType,
  TerminalManagerState,
  CommandValidationResult,
  TerminalTheme,
} from './types';

export {
  DEFAULT_TERMINAL_SETTINGS,
  DARK_TERMINAL_THEME,
  COMMAND_PATTERNS,
} from './types';
