/**
 * Terminal Execution Service
 * Orchestrates command execution with validation, queuing, and state management
 */

import {
  TerminalCommand,
  TerminalInstance,
  TerminalOutput,
  TerminalSettings,
  AgentTerminalRequest,
} from '../../components/terminal/types';
import {
  CommandValidationService,
  commandValidationService,
} from './CommandValidationService';
import {
  TerminalStreamService,
  terminalStreamService,
} from './TerminalStreamService';
import { v4 as uuidv4 } from 'uuid';

export interface TerminalExecutionCallbacks {
  onTerminalCreated?: (terminal: TerminalInstance) => void;
  onCommandQueued?: (command: TerminalCommand) => void;
  onCommandExecuting?: (terminalId: string, command: TerminalCommand) => void;
  onCommandCompleted?: (terminalId: string, exitCode: number) => void;
  onCommandFailed?: (terminalId: string, error: string) => void;
  onOutput?: (terminalId: string, output: TerminalOutput) => void;
  onApprovalRequired?: (
    terminalId: string,
    command: TerminalCommand
  ) => Promise<boolean>;
}

export class TerminalExecutionService {
  private validationService: CommandValidationService;
  private streamService: TerminalStreamService;
  private callbacks: TerminalExecutionCallbacks;
  private commandQueue: Map<string, TerminalCommand[]> = new Map();
  private activeExecutions: Map<string, TerminalStreamService> = new Map();

  constructor(
    callbacks: TerminalExecutionCallbacks = {},
    validationService?: CommandValidationService,
    streamService?: TerminalStreamService
  ) {
    this.callbacks = callbacks;
    this.validationService =
      validationService || commandValidationService;
    this.streamService = streamService || terminalStreamService;
  }

  /**
   * Process agent terminal request
   */
  async processAgentRequest(
    request: AgentTerminalRequest,
    settings: TerminalSettings
  ): Promise<TerminalInstance[]> {
    const terminals: TerminalInstance[] = [];

    for (const cmdRequest of request.commands) {
      // Validate command
      const validation = this.validationService.validateCommand(
        cmdRequest.command,
        cmdRequest.workingDir || '/workspace'
      );

      if (!validation.isValid) {
        console.warn(
          `❌ Command validation failed: ${cmdRequest.command}`,
          validation.reason
        );
        continue;
      }

      // Create terminal command
      const command: TerminalCommand = {
        id: uuidv4(),
        command: cmdRequest.command,
        workingDir: cmdRequest.workingDir || '/workspace',
        reasoning: request.reasoning,
        expectation: cmdRequest.expectation,
        safety: validation.safety,
        requiresApproval:
          validation.requiresApproval || request.requiresApproval,
        createdAt: new Date(),
      };

      // Create terminal instance
      const terminal: TerminalInstance = {
        id: uuidv4(),
        sessionId: uuidv4(),
        title: this.generateTerminalTitle(command.command),
        command,
        state: command.requiresApproval ? 'pending_approval' : 'idle',
        output: [],
        startTime: new Date(),
        position: this.calculateTerminalPosition(terminals.length),
        size: { width: 600, height: 400 },
        isMinimized: false,
        isMaximized: false,
        zIndex: 1000 + terminals.length,
        agentId: request.agentId,
      };

      terminals.push(terminal);
      this.callbacks.onTerminalCreated?.(terminal);

      // Add to queue or execute immediately
      if (request.sequential) {
        this.addToQueue(terminal.id, command);
      } else {
        if (!command.requiresApproval || settings.yoloMode) {
          await this.executeCommand(terminal, command, settings);
        }
      }
    }

    // Start sequential execution if needed
    if (request.sequential && terminals.length > 0) {
      this.processQueue(terminals[0].id, settings);
    }

    return terminals;
  }

  /**
   * Execute a terminal command
   */
  async executeCommand(
    terminal: TerminalInstance,
    command: TerminalCommand,
    settings: TerminalSettings
  ): Promise<void> {
    // Check if approval is required
    if (command.requiresApproval && !settings.yoloMode) {
      const approved =
        await this.callbacks.onApprovalRequired?.(terminal.id, command);
      if (!approved) {
        terminal.state = 'killed';
        this.addSystemOutput(terminal, 'Command execution cancelled by user');
        return;
      }
    }

    terminal.state = 'running';
    command.executedAt = new Date();
    this.callbacks.onCommandExecuting?.(terminal.id, command);

    // Create stream service for this terminal
    const streamService = new TerminalStreamService();
    this.activeExecutions.set(terminal.id, streamService);

    try {
      // Connect to WebSocket
      await streamService.connectWebSocket({
        url: `ws://localhost:3003/terminal/${terminal.sessionId}`,
        sessionId: terminal.sessionId,
        onData: (output) => {
          terminal.output.push(output);
          this.callbacks.onOutput?.(terminal.id, output);
        },
        onError: (error) => {
          console.error(`Terminal ${terminal.id} error:`, error);
          terminal.state = 'failed';
          this.callbacks.onCommandFailed?.(terminal.id, error.message);
        },
        onClose: () => {
          console.log(`Terminal ${terminal.id} closed`);
        },
        onConnected: async () => {
          // Execute the command
          await streamService.executeCommand(
            command.command,
            command.workingDir
          );
        },
      });

      // Wait for command to complete (with timeout)
      await this.waitForCompletion(terminal, settings.commandTimeout);
    } catch (error) {
      terminal.state = 'failed';
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.addSystemOutput(terminal, `Error: ${errorMessage}`);
      this.callbacks.onCommandFailed?.(terminal.id, errorMessage);
    } finally {
      streamService.disconnect();
      this.activeExecutions.delete(terminal.id);
    }
  }

  /**
   * Kill a running command
   */
  async killCommand(terminalId: string): Promise<void> {
    const streamService = this.activeExecutions.get(terminalId);
    if (streamService) {
      streamService.killCommand();
      this.activeExecutions.delete(terminalId);
    }
  }

  /**
   * Add command to queue
   */
  private addToQueue(terminalId: string, command: TerminalCommand): void {
    if (!this.commandQueue.has(terminalId)) {
      this.commandQueue.set(terminalId, []);
    }
    this.commandQueue.get(terminalId)!.push(command);
    this.callbacks.onCommandQueued?.(command);
  }

  /**
   * Process command queue for a terminal
   */
  private async processQueue(
    terminalId: string,
    settings: TerminalSettings
  ): Promise<void> {
    const queue = this.commandQueue.get(terminalId);
    if (!queue || queue.length === 0) return;

    const command = queue.shift()!;

    // Create temporary terminal instance for execution
    // In real implementation, you'd get the actual terminal instance
    const terminal: TerminalInstance = {
      id: terminalId,
      sessionId: uuidv4(),
      title: this.generateTerminalTitle(command.command),
      command,
      state: 'idle',
      output: [],
      startTime: new Date(),
      position: { x: 100, y: 100 },
      size: { width: 600, height: 400 },
      isMinimized: false,
      isMaximized: false,
      zIndex: 1000,
    };

    await this.executeCommand(terminal, command, settings);

    // Process next in queue
    if (queue.length > 0) {
      await this.processQueue(terminalId, settings);
    }
  }

  /**
   * Wait for command completion
   */
  private async waitForCompletion(
    terminal: TerminalInstance,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          terminal.state = 'failed';
          reject(new Error('Command execution timeout'));
          return;
        }

        // Check for completion in output
        const lastOutput = terminal.output[terminal.output.length - 1];
        if (lastOutput?.type === 'system' && lastOutput.data.includes('exited')) {
          clearInterval(checkInterval);
          terminal.state = 'completed';
          terminal.endTime = new Date();
          resolve();
        }
      }, 100);

      // Timeout fallback
      setTimeout(() => {
        clearInterval(checkInterval);
        if (terminal.state === 'running') {
          terminal.state = 'completed';
          terminal.endTime = new Date();
          resolve();
        }
      }, timeout);
    });
  }

  /**
   * Add system message to terminal output
   */
  private addSystemOutput(terminal: TerminalInstance, message: string): void {
    const output: TerminalOutput = {
      type: 'system',
      data: `\r\n${message}\r\n`,
      timestamp: new Date(),
    };
    terminal.output.push(output);
    this.callbacks.onOutput?.(terminal.id, output);
  }

  /**
   * Generate terminal title from command
   */
  private generateTerminalTitle(command: string): string {
    const maxLength = 30;
    if (command.length <= maxLength) {
      return command;
    }
    return command.substring(0, maxLength - 3) + '...';
  }

  /**
   * Calculate position for new terminal (cascade effect)
   */
  private calculateTerminalPosition(index: number): { x: number; y: number } {
    const offset = 30;
    const baseX = 100;
    const baseY = 100;

    return {
      x: baseX + offset * (index % 5),
      y: baseY + offset * (index % 5),
    };
  }

  /**
   * Parse commands from agent response text
   */
  parseAgentResponse(text: string): TerminalCommand[] {
    const parsedCommands = this.validationService.parseCommandsFromText(text);

    return parsedCommands.map((cmd) => {
      const validation = this.validationService.validateCommand(
        cmd.command,
        cmd.workingDir || '/workspace'
      );

      return {
        id: uuidv4(),
        command: cmd.command,
        workingDir: cmd.workingDir || '/workspace',
        reasoning: cmd.reasoning,
        safety: validation.safety,
        requiresApproval: validation.requiresApproval,
        createdAt: new Date(),
      };
    });
  }

  /**
   * Update validation settings
   */
  updateSettings(settings: Partial<TerminalSettings>): void {
    this.validationService.updateSettings(settings);
  }
}

// Create singleton instance
export const terminalExecutionService = new TerminalExecutionService();
