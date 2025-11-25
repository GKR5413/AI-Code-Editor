/**
 * Terminal Stream Service
 * Handles gRPC/WebSocket streaming for terminal command execution and output
 */

import { TerminalOutput } from '../../components/terminal/types';

export interface StreamConfig {
  url: string;
  sessionId: string;
  onData: (output: TerminalOutput) => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onConnected?: () => void;
}

export interface ExecutionResult {
  success: boolean;
  exitCode?: number;
  error?: string;
  output: TerminalOutput[];
}

export class TerminalStreamService {
  private ws: WebSocket | null = null;
  private grpcClient: any | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private config: StreamConfig | null = null;

  /**
   * Connect to terminal service via WebSocket
   */
  async connectWebSocket(config: StreamConfig): Promise<void> {
    this.config = config;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.url);

        this.ws.onopen = () => {
          console.log('✅ Terminal WebSocket connected');
          this.reconnectAttempts = 0;
          config.onConnected?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'output') {
              const output: TerminalOutput = {
                type: data.stream || 'stdout',
                data: data.data,
                timestamp: new Date(data.timestamp || Date.now()),
                ansiFormatted: true,
              };
              config.onData(output);
            } else if (data.type === 'exit') {
              const output: TerminalOutput = {
                type: 'system',
                data: `\r\nProcess exited with code ${data.exitCode}\r\n`,
                timestamp: new Date(),
              };
              config.onData(output);
            } else if (data.type === 'error') {
              config.onError(new Error(data.message || 'Unknown error'));
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Terminal WebSocket error:', error);
          config.onError(new Error('WebSocket connection error'));
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Terminal WebSocket closed');
          config.onClose();
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute command via WebSocket
   */
  async executeCommand(
    command: string,
    workingDir: string = '/workspace',
    env?: Record<string, string>
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'execute',
      command,
      workingDir,
      env: env || {},
      sessionId: this.config?.sessionId,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send input to terminal (for interactive commands)
   */
  sendInput(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'input',
      data,
      sessionId: this.config?.sessionId,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Kill running command
   */
  killCommand(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'kill',
      sessionId: this.config?.sessionId,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.config) {
      try {
        await this.connectWebSocket(this.config);
      } catch (error) {
        console.error('Reconnect failed:', error);
        this.attemptReconnect();
      }
    }
  }

  /**
   * Execute command via HTTP API (alternative to WebSocket)
   */
  async executeCommandHTTP(
    command: string,
    workingDir: string = '/workspace',
    timeout: number = 30000
  ): Promise<ExecutionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch('http://localhost:3002/api/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          workingDir,
          timeout,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Command execution failed',
          output: [],
        };
      }

      const result = await response.json();

      const output: TerminalOutput[] = [];

      if (result.stdout) {
        output.push({
          type: 'stdout',
          data: result.stdout,
          timestamp: new Date(),
          ansiFormatted: true,
        });
      }

      if (result.stderr) {
        output.push({
          type: 'stderr',
          data: result.stderr,
          timestamp: new Date(),
          ansiFormatted: true,
        });
      }

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        output,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Command execution timeout',
          output: [{
            type: 'system',
            data: `\r\nError: Command timed out after ${timeout}ms\r\n`,
            timestamp: new Date(),
          }],
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        output: [],
      };
    }
  }

  /**
   * Check if connection is active
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.config = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Create a new terminal session
   */
  async createSession(workingDir: string = '/workspace'): Promise<string> {
    const response = await fetch('http://localhost:3002/api/terminal/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workingDir,
        shell: 'bash',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create terminal session');
    }

    const result = await response.json();
    return result.sessionId;
  }

  /**
   * List active sessions
   */
  async listSessions(): Promise<Array<{ sessionId: string; created: Date }>> {
    const response = await fetch('http://localhost:3002/api/terminal/sessions');

    if (!response.ok) {
      throw new Error('Failed to list terminal sessions');
    }

    const result = await response.json();
    return result.sessions.map((s: any) => ({
      sessionId: s.sessionId,
      created: new Date(s.created),
    }));
  }

  /**
   * Kill a terminal session
   */
  async killSession(sessionId: string): Promise<void> {
    const response = await fetch(
      `http://localhost:3002/api/terminal/sessions/${sessionId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to kill terminal session');
    }
  }
}

// Singleton instance for global use
export const terminalStreamService = new TerminalStreamService();
