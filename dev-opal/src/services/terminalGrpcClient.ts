import { grpc } from '@improbable-eng/grpc-web';
import { TerminalService } from '../../proto/terminal_grpc_web_pb';
import { 
  CommandRequest, 
  CommandResponse, 
  SessionRequest, 
  SessionResponse, 
  StreamRequest, 
  OutputChunk 
} from '../../proto/terminal_pb';

/**
 * gRPC Terminal Client
 * Handles communication with the terminal container via gRPC-Web
 */
export class TerminalGrpcClient {
  private readonly host: string;

  constructor() {
    // Use the frontend gateway for gRPC-Web proxy
    this.host = 'http://localhost:8080';
  }

  /**
   * Create a new terminal session
   */
  async createSession(
    sessionId: string, 
    workingDirectory = '/workspace',
    shell = 'bash',
    cols = 80,
    rows = 30
  ): Promise<SessionResponse> {
    const request = new SessionRequest();
    request.setSessionId(sessionId);
    request.setWorkingDirectory(workingDirectory);
    request.setShell(shell);
    request.setCols(cols);
    request.setRows(rows);

    return new Promise((resolve, reject) => {
      grpc.unary(TerminalService.CreateSession, {
        request,
        host: this.host,
        onEnd: (response) => {
          const { status, statusMessage, headers, message, trailers } = response;
          if (status === grpc.Code.OK) {
            resolve(message as SessionResponse);
          } else {
            reject(new Error(`gRPC error: ${status} - ${statusMessage}`));
          }
        }
      });
    });
  }

  /**
   * Execute a command in the terminal
   */
  async executeCommand(
    sessionId: string, 
    command: string, 
    workingDirectory = '/workspace'
  ): Promise<CommandResponse> {
    const request = new CommandRequest();
    request.setSessionId(sessionId);
    request.setCommand(command);
    request.setWorkingDirectory(workingDirectory);

    return new Promise((resolve, reject) => {
      grpc.unary(TerminalService.ExecuteCommand, {
        request,
        host: this.host,
        onEnd: (response) => {
          const { status, statusMessage, message } = response;
          if (status === grpc.Code.OK) {
            resolve(message as CommandResponse);
          } else {
            reject(new Error(`gRPC error: ${status} - ${statusMessage}`));
          }
        }
      });
    });
  }

  /**
   * Stream terminal output in real-time
   */
  streamOutput(
    sessionId: string,
    onData: (chunk: OutputChunk) => void,
    onError?: (error: any) => void,
    onEnd?: () => void
  ) {
    const request = new StreamRequest();
    request.setSessionId(sessionId);
    request.setFollow(true);

    return grpc.invoke(TerminalService.StreamOutput, {
      request,
      host: this.host,
      onMessage: (message: OutputChunk) => {
        onData(message);
      },
      onEnd: (code, message, trailers) => {
        if (code === grpc.Code.OK) {
          onEnd?.();
        } else {
          onError?.(new Error(`Stream error: ${code} - ${message}`));
        }
      }
    });
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const terminalClient = new TerminalGrpcClient();