/**
 * Command Validation Service
 * Validates commands for security and safety before execution
 */

import {
  CommandValidationResult,
  CommandSafety,
  TerminalSettings,
  DEFAULT_TERMINAL_SETTINGS,
} from '../../components/terminal/types';

export class CommandValidationService {
  private settings: TerminalSettings;

  constructor(settings?: TerminalSettings) {
    this.settings = settings || DEFAULT_TERMINAL_SETTINGS;
  }

  /**
   * Update validation settings
   */
  updateSettings(settings: Partial<TerminalSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Validate a command before execution
   */
  validateCommand(
    command: string,
    workingDir: string
  ): CommandValidationResult {
    // Empty command
    if (!command || command.trim() === '') {
      return {
        isValid: false,
        safety: 'safe',
        requiresApproval: false,
        reason: 'Command is empty',
      };
    }

    const trimmedCommand = command.trim();
    const firstToken = this.getFirstToken(trimmedCommand);

    // Check workspace restrictions
    if (!this.isAllowedWorkspace(workingDir)) {
      return {
        isValid: false,
        safety: 'dangerous',
        requiresApproval: true,
        reason: `Working directory "${workingDir}" is not in allowed workspaces`,
        suggestions: this.settings.allowedWorkspaces,
      };
    }

    // Check for dangerous commands
    if (this.isDangerousCommand(trimmedCommand, firstToken)) {
      return {
        isValid: true,
        safety: 'dangerous',
        requiresApproval: true,
        reason: `Command "${firstToken}" is potentially dangerous and requires approval`,
      };
    }

    // Check for unsafe patterns
    const unsafePattern = this.checkUnsafePatterns(trimmedCommand);
    if (unsafePattern) {
      return {
        isValid: true,
        safety: 'unsafe',
        requiresApproval: !this.settings.yoloMode,
        reason: unsafePattern,
      };
    }

    // Check if it's a safe command
    if (this.isSafeCommand(firstToken)) {
      return {
        isValid: true,
        safety: 'safe',
        requiresApproval: false,
      };
    }

    // Unknown command - treat as unsafe
    return {
      isValid: true,
      safety: 'unsafe',
      requiresApproval: !this.settings.yoloMode,
      reason: `Command "${firstToken}" is not in the safe commands list`,
      suggestions: ['Add to safe commands list if you trust this command'],
    };
  }

  /**
   * Parse commands from agent response text
   */
  parseCommandsFromText(text: string): Array<{
    command: string;
    reasoning?: string;
    workingDir?: string;
  }> {
    const commands: Array<{
      command: string;
      reasoning?: string;
      workingDir?: string;
    }> = [];

    // Pattern 1: [TERMINAL_COMMAND] blocks
    const terminalBlocks = text.match(
      /\[TERMINAL_COMMAND\]([\s\S]+?)\[\/TERMINAL_COMMAND\]/gi
    );
    if (terminalBlocks) {
      terminalBlocks.forEach((block) => {
        const reasoningMatch = block.match(/reasoning:\s*(.+?)(?:\n|$)/i);
        const commandMatch = block.match(/command:\s*(.+?)(?:\n|$)/i);
        const workingDirMatch = block.match(/workingDir:\s*(.+?)(?:\n|$)/i);

        if (commandMatch) {
          commands.push({
            command: commandMatch[1].trim(),
            reasoning: reasoningMatch ? reasoningMatch[1].trim() : undefined,
            workingDir: workingDirMatch
              ? workingDirMatch[1].trim()
              : '/workspace',
          });
        }
      });
    }

    // Pattern 2: Code blocks with bash/shell
    const codeBlocks = text.match(/```(?:bash|sh|shell|terminal)\n([\s\S]+?)```/gi);
    if (codeBlocks) {
      codeBlocks.forEach((block) => {
        const commands_text = block
          .replace(/```(?:bash|sh|shell|terminal)\n/i, '')
          .replace(/```/g, '')
          .trim();

        // Split by newlines for multiple commands
        const lines = commands_text.split('\n').filter((line) => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('#'); // Ignore comments
        });

        lines.forEach((cmd) => {
          if (cmd.trim()) {
            commands.push({
              command: cmd.trim(),
              workingDir: '/workspace',
            });
          }
        });
      });
    }

    // Pattern 3: Inline backtick commands
    const backtickMatches = [...text.matchAll(/`([^`]+)`/g)];
    backtickMatches.forEach((match) => {
      const cmd = match[1].trim();
      // Only treat as command if it looks like a shell command
      if (this.looksLikeCommand(cmd)) {
        commands.push({
          command: cmd,
          workingDir: '/workspace',
        });
      }
    });

    // Pattern 4: Natural language patterns
    const nlPatterns = [
      /Let me run:?\s*(.+?)(?:\n|$)/gi,
      /I'll execute:?\s*(.+?)(?:\n|$)/gi,
      /I'll run:?\s*(.+?)(?:\n|$)/gi,
      /Running:?\s*(.+?)(?:\n|$)/gi,
      /Execute:?\s*(.+?)(?:\n|$)/gi,
    ];

    nlPatterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((match) => {
        const cmd = match[1].trim();
        if (this.looksLikeCommand(cmd)) {
          commands.push({
            command: cmd,
            workingDir: '/workspace',
          });
        }
      });
    });

    // Remove duplicates
    const uniqueCommands = commands.filter(
      (cmd, index, self) =>
        index === self.findIndex((c) => c.command === cmd.command)
    );

    return uniqueCommands;
  }

  /**
   * Check if a string looks like a shell command
   */
  private looksLikeCommand(text: string): boolean {
    const trimmed = text.trim();

    // Too long or too short
    if (trimmed.length < 2 || trimmed.length > 500) return false;

    // Contains newlines (likely not a single command)
    if (trimmed.includes('\n')) return false;

    // Starts with a command-like token
    const firstToken = this.getFirstToken(trimmed);
    const commonCommands = [
      ...this.settings.safeCommands,
      ...this.settings.dangerousCommands,
      'cd',
      'clear',
      'exit',
      'export',
      'source',
      'alias',
    ];

    return commonCommands.some((cmd) => firstToken.startsWith(cmd));
  }

  /**
   * Extract first token from command
   */
  private getFirstToken(command: string): string {
    return command.trim().split(/\s+/)[0] || '';
  }

  /**
   * Check if command is in safe list
   */
  private isSafeCommand(token: string): boolean {
    return this.settings.safeCommands.some((safe) => token.startsWith(safe));
  }

  /**
   * Check if command is dangerous
   */
  private isDangerousCommand(command: string, token: string): boolean {
    // Check exact matches
    if (this.settings.dangerousCommands.includes(token)) {
      return true;
    }

    // Check for dangerous patterns in full command
    const dangerousPatterns = [
      /rm\s+-rf\s+\//i, // rm -rf /
      /rm\s+-rf\s+~\//i, // rm -rf ~/
      /sudo\s+rm/i, // sudo rm
      /dd\s+if=/i, // dd commands
      /mkfs/i, // filesystem formatting
      /:\(\)\{\s*:\|:&\s*\};:/i, // Fork bomb
      /chmod\s+777/i, // Wide open permissions
      /curl.*\|\s*bash/i, // Curl piped to bash
      /wget.*\|\s*sh/i, // Wget piped to shell
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }

  /**
   * Check workspace restrictions
   */
  private isAllowedWorkspace(workingDir: string): boolean {
    const normalized = workingDir.replace(/\\/g, '/');
    return this.settings.allowedWorkspaces.some((allowed) =>
      normalized.startsWith(allowed)
    );
  }

  /**
   * Check for unsafe patterns
   */
  private checkUnsafePatterns(command: string): string | null {
    // Redirection to important files
    if (/>>\s*\/etc\//i.test(command) || />\s*\/etc\//i.test(command)) {
      return 'Redirecting output to system files is not allowed';
    }

    // Environment variable manipulation
    if (/export\s+PATH=/i.test(command)) {
      return 'Modifying PATH environment variable requires approval';
    }

    // Command chaining with &&, ||, ;
    const hasChaining = /&&|\|\||;/.test(command);
    if (hasChaining) {
      const parts = command.split(/&&|\|\||;/);
      if (parts.length > 3) {
        return 'Complex command chains require approval';
      }
    }

    // Network operations
    if (/curl|wget|nc|netcat/i.test(command)) {
      return 'Network operations require approval';
    }

    return null;
  }

  /**
   * Get safety level description
   */
  getSafetyDescription(safety: CommandSafety): string {
    switch (safety) {
      case 'safe':
        return 'This command is considered safe and can run automatically';
      case 'unsafe':
        return 'This command may have side effects and requires review';
      case 'dangerous':
        return 'This command could cause system damage and must be approved';
    }
  }
}

// Singleton instance
export const commandValidationService = new CommandValidationService();
