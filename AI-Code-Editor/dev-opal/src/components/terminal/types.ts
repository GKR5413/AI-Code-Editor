/**
 * Types and interfaces for Agentic Terminal System
 * Supports auto-spawning terminals, multi-instance management, and AI agent integration
 */

export type TerminalState =
  | 'idle'
  | 'pending_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed';

export type CommandSafety = 'safe' | 'unsafe' | 'dangerous';

export interface TerminalCommand {
  id: string;
  command: string;
  workingDir: string;
  reasoning?: string;
  expectation?: string;
  safety: CommandSafety;
  requiresApproval: boolean;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
}

export interface TerminalOutput {
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: Date;
  ansiFormatted?: boolean;
}

export interface TerminalInstance {
  id: string;
  sessionId: string;
  title: string;
  command: TerminalCommand | null;
  state: TerminalState;
  output: TerminalOutput[];
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  agentId?: string; // Which agent spawned this terminal
  parentTerminalId?: string; // For chained commands
}

export interface AgentTerminalRequest {
  type: 'terminal_request';
  agentId: string;
  reasoning: string;
  commands: Array<{
    command: string;
    workingDir: string;
    expectation?: string;
  }>;
  requiresApproval: boolean;
  sequential?: boolean; // Run commands one after another
}

export interface TerminalSettings {
  yoloMode: boolean; // Auto-approve safe commands
  autoSpawn: boolean; // Auto-spawn terminals for agent requests
  maxConcurrentTerminals: number;
  commandTimeout: number; // milliseconds
  safeCommands: string[]; // Whitelist
  dangerousCommands: string[]; // Blacklist (always require approval)
  allowedWorkspaces: string[]; // Path restrictions
}

export interface TerminalManagerState {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  settings: TerminalSettings;
  commandQueue: TerminalCommand[];
}

export interface CommandValidationResult {
  isValid: boolean;
  safety: CommandSafety;
  requiresApproval: boolean;
  reason?: string;
  suggestions?: string[];
}

// Default settings
export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  yoloMode: false,
  autoSpawn: true,
  maxConcurrentTerminals: 5,
  commandTimeout: 300000, // 5 minutes
  safeCommands: [
    'npm',
    'yarn',
    'pnpm',
    'node',
    'python',
    'python3',
    'pip',
    'git',
    'ls',
    'pwd',
    'cat',
    'echo',
    'mkdir',
    'touch',
    'cd',
    'grep',
    'find',
    'which',
    'whoami',
    'date',
    'env',
  ],
  dangerousCommands: [
    'rm',
    'rmdir',
    'del',
    'sudo',
    'su',
    'chmod',
    'chown',
    'kill',
    'killall',
    'shutdown',
    'reboot',
    'dd',
    'mkfs',
    'format',
    '>',
    '>>',
    'curl',
    'wget',
    'nc',
    'netcat',
  ],
  allowedWorkspaces: ['/workspace', '/app/workspace', '/projects'],
};

// Command pattern detection for parsing agent responses
export const COMMAND_PATTERNS = [
  /```(?:bash|sh|shell|terminal)\n([\s\S]+?)```/gi, // Code blocks
  /`([^`]+)`/g, // Backtick commands
  /Let me run:?\s*(.+?)(?:\n|$)/gi,
  /I'll execute:?\s*(.+?)(?:\n|$)/gi,
  /I'll run:?\s*(.+?)(?:\n|$)/gi,
  /Running:?\s*(.+?)(?:\n|$)/gi,
  /Execute:?\s*(.+?)(?:\n|$)/gi,
  /\[TERMINAL_COMMAND\]([\s\S]+?)\[\/TERMINAL_COMMAND\]/gi,
];

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const DARK_TERMINAL_THEME: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selection: '#5f5f5f',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e7e7e7',
};
