// Simplified gRPC client using fetch to communicate with gRPC-Web proxy
// This avoids the need for protobuf-ts packages while still using gRPC protocols

// Basic type definitions to match the proto file structure
export interface HealthResponse {
  healthy: boolean;
  message: string;
  services: Record<string, string>;
}

export interface SendMessageRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  options?: {
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  };
}

export interface SendMessageResponse {
  success: boolean;
  response: string;
  model: string;
  timestamp: number;
  error: string;
  token_usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

export interface ListFilesRequest {
  path: string;
  recursive: boolean;
}

export interface ListFilesResponse {
  success: boolean;
  files: Array<{
    name: string;
    type: string;
    size: number;
    path: string;
    modified: string;
  }>;
  error?: string;
}

export interface ReadFileRequest {
  path: string;
  encoding: string;
}

export interface ReadFileResponse {
  success: boolean;
  content: string;
  error?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  encoding: string;
}

export interface WriteFileResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface DeleteFileRequest {
  path: string;
}

export interface DeleteFileResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface CreateDirectoryRequest {
  path: string;
}

export interface CreateDirectoryResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface CompileRequest {
  language: string;
  code: string;
  filename?: string;
  options?: Record<string, any>;
}

export interface CompileResponse {
  success: boolean;
  output: string;
  error: string;
  execution_time: number;
  compile_time: number;
}

export interface RunRequest {
  language: string;
  code: string;
  filename?: string;
  options?: Record<string, any>;
}

export interface RunResponse {
  success: boolean;
  output: string;
  error: string;
  execution_time: number;
}

export interface LanguagesResponse {
  success: boolean;
  languages: Array<{
    name: string;
    extension: string;
    has_compile_step: boolean;
    version: string;
  }>;
}

export interface CodeGenerationRequest {
  prompt: string;
  language: string;
  model?: string;
  options?: Record<string, any>;
}

export interface CodeGenerationResponse {
  success: boolean;
  code: string;
  language: string;
  explanation: string;
  suggestions: string[];
  error: string;
  timestamp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: any;
  error?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  success: boolean;
  user: any;
  error?: string;
}

export interface SystemStatusResponse {
  healthy: boolean;
  services: Record<string, any>;
  metrics: any;
  timestamp: number;
}

// Terminal operation types
export interface CreateSessionRequest {
  session_id: string;
  shell?: string;
  working_directory?: string;
  environment?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface CreateSessionResponse {
  success: boolean;
  session_id: string;
  message: string;
}

export interface ExecuteCommandRequest {
  session_id: string;
  command: string;
  working_directory?: string;
  environment?: Record<string, string>;
}

export interface ExecuteCommandResponse {
  success: boolean;
  output: string;
  error: string;
  exit_code: number;
  session_id: string;
}

export interface GetOutputRequest {
  session_id: string;
  max_lines?: number;
}

export interface GetOutputResponse {
  lines: string[];
  has_more: boolean;
  session_id: string;
}

export interface StreamRequest {
  session_id: string;
  follow?: boolean;
}

export interface OutputChunk {
  data: string;
  session_id: string;
  timestamp: number;
  is_error: boolean;
}

export interface ListSessionsResponse {
  sessions: Array<{
    session_id: string;
    shell: string;
    working_directory: string;
    cols: number;
    rows: number;
    is_active: boolean;
    created_at: number;
  }>;
}

export interface KillSessionRequest {
  session_id: string;
}

export interface KillSessionResponse {
  success: boolean;
  message: string;
}

class GrpcClientService {
  private baseUrl: string;

  constructor() {
    // Use the gRPC-Web proxy endpoint
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8080'
      : window.location.origin;
  }

  // Helper method to make HTTP calls to our existing services
  // This bridges between our gRPC interface and existing HTTP services
  private async makeGrpcCall<TRequest, TResponse>(
    service: string,
    method: string,
    request: TRequest
  ): Promise<TResponse> {
    try {
      // Map gRPC methods to existing HTTP endpoints
      switch (method) {
        case 'ListFiles':
          return await this.handleListFiles(request) as TResponse;
        case 'ReadFile':
          return await this.handleReadFile(request) as TResponse;
        case 'WriteFile':
          return await this.handleWriteFile(request) as TResponse;
        case 'CreateDirectory':
          return await this.handleCreateDirectory(request) as TResponse;
        case 'DeleteFile':
          return await this.handleDeleteFile(request) as TResponse;
        case 'HealthCheck':
          return await this.handleHealthCheck() as TResponse;
        case 'CreateSession':
          return await this.handleCreateSession(request) as TResponse;
        case 'ExecuteCommand':
          return await this.handleExecuteCommand(request) as TResponse;
        case 'GetOutput':
          return await this.handleGetOutput(request) as TResponse;
        case 'ListSessions':
          return await this.handleListSessions(request) as TResponse;
        case 'KillSession':
          return await this.handleKillSession(request) as TResponse;
        default:
          console.warn(`Unimplemented gRPC method: ${method}, using mock`);
          return this.getMockResponse<TResponse>(method);
      }
    } catch (error) {
      console.error(`gRPC call ${service}/${method} failed:`, error);
      // Return error response instead of mock for better debugging
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as TResponse;
    }
  }

  // HTTP-based implementations that work with existing backend
  private async handleListFiles(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list',
        path: request.path || '/'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      files: data.files || [],
      error: data.error
    };
  }

  private async handleReadFile(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'read',
        path: request.path
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      content: data.content || '',
      error: data.error
    };
  }

  private async handleWriteFile(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'write',
        path: request.path,
        content: request.content
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      message: data.message || 'File written successfully',
      error: data.error
    };
  }

  private async handleCreateDirectory(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mkdir',
        path: request.path
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      message: data.message || 'Directory created successfully',
      error: data.error
    };
  }

  private async handleDeleteFile(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/workspace/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        path: request.path
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      message: data.message || 'File deleted successfully',
      error: data.error
    };
  }

  private async handleHealthCheck(): Promise<any> {
    try {
      const response = await fetch('http://localhost:3002/health');
      const isHealthy = response.ok;
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'All services healthy' : 'Some services unhealthy',
        services: {
          compiler: isHealthy ? 'healthy' : 'unhealthy'
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Health check failed',
        services: {}
      };
    }
  }

  // Terminal operation handlers
  private async handleCreateSession(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/terminal/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.session_id,
        shell: request.shell || 'bash',
        working_directory: request.working_directory || '/workspace',
        environment: request.environment || {},
        cols: request.cols || 100,
        rows: request.rows || 30
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      session_id: data.session_id,
      message: data.message
    };
  }

  private async handleExecuteCommand(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/terminal/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.session_id,
        command: request.command,
        working_directory: request.working_directory,
        environment: request.environment
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      output: data.output || '',
      error: data.error || '',
      exit_code: data.exit_code || 0,
      session_id: data.session_id
    };
  }

  private async handleGetOutput(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/terminal/output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.session_id,
        max_lines: request.max_lines || 50
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      lines: data.lines || [],
      has_more: data.has_more || false,
      session_id: data.session_id
    };
  }

  private async handleListSessions(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/terminal/sessions', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      sessions: data.sessions || []
    };
  }

  private async handleKillSession(request: any): Promise<any> {
    const response = await fetch('http://localhost:3002/terminal/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.session_id
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      message: data.message
    };
  }

  // Helper method to provide mock responses during development
  private getMockResponse<TResponse>(method: string): TResponse {
    switch (method) {
      case 'HealthCheck':
        return {
          healthy: true,
          message: 'gRPC service healthy (mock)',
          services: { compiler: 'healthy', agent: 'healthy' }
        } as TResponse;
      
      case 'ListFiles':
        return {
          success: true,
          files: [
            { name: 'about.html', type: 'file', size: 499, path: '/about.html', modified: new Date().toISOString() },
            { name: 'contact.html', type: 'file', size: 498, path: '/contact.html', modified: new Date().toISOString() },
            { name: 'index.html', type: 'file', size: 520, path: '/index.html', modified: new Date().toISOString() },
            { name: 'script.js', type: 'file', size: 1353, path: '/script.js', modified: new Date().toISOString() },
            { name: 'style.css', type: 'file', size: 394, path: '/style.css', modified: new Date().toISOString() },
            { name: 'test-workspace-integration.js', type: 'file', size: 194, path: '/test-workspace-integration.js', modified: new Date().toISOString() },
            { name: 'workspace-test', type: 'directory', size: 0, path: '/workspace-test', modified: new Date().toISOString() }
          ]
        } as TResponse;
      
      case 'ReadFile':
        return {
          success: true,
          content: 'File content would be here...'
        } as TResponse;
      
      case 'WriteFile':
        return {
          success: true,
          message: 'File written successfully'
        } as TResponse;
      
      case 'CreateDirectory':
        return {
          success: true,
          message: 'Directory created successfully'
        } as TResponse;
      
      case 'DeleteFile':
        return {
          success: true,
          message: 'File deleted successfully'
        } as TResponse;
      
      default:
        return {
          success: false,
          error: `Mock response not implemented for ${method}`
        } as TResponse;
    }
  }

  // Health check
  async healthCheck(): Promise<HealthResponse> {
    try {
      return await this.makeGrpcCall('frontend', 'HealthCheck', {});
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        healthy: false,
        message: 'Connection failed',
        services: {}
      };
    }
  }

  // Agent service methods
  async sendMessageToAgent(request: SendMessageRequest): Promise<SendMessageResponse> {
    return await this.makeGrpcCall('frontend', 'SendMessageToAgent', request);
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    return await this.makeGrpcCall('frontend', 'GenerateCode', request);
  }

  // Compiler service methods
  async compileCode(request: CompileRequest): Promise<CompileResponse> {
    return await this.makeGrpcCall('frontend', 'CompileCode', request);
  }

  async runCode(request: RunRequest): Promise<RunResponse> {
    return await this.makeGrpcCall('frontend', 'RunCode', request);
  }

  async getSupportedLanguages(): Promise<LanguagesResponse> {
    return await this.makeGrpcCall('frontend', 'GetSupportedLanguages', {});
  }

  // File operations
  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    return await this.makeGrpcCall('frontend', 'ListFiles', request);
  }

  async readFile(request: ReadFileRequest): Promise<ReadFileResponse> {
    return await this.makeGrpcCall('frontend', 'ReadFile', request);
  }

  async writeFile(request: WriteFileRequest): Promise<WriteFileResponse> {
    return await this.makeGrpcCall('frontend', 'WriteFile', request);
  }

  async deleteFile(request: DeleteFileRequest): Promise<DeleteFileResponse> {
    return await this.makeGrpcCall('frontend', 'DeleteFile', request);
  }

  async createDirectory(request: CreateDirectoryRequest): Promise<CreateDirectoryResponse> {
    return await this.makeGrpcCall('frontend', 'CreateDirectory', request);
  }

  // Authentication methods
  async login(request: LoginRequest): Promise<LoginResponse> {
    return await this.makeGrpcCall('frontend', 'Login', request);
  }

  async register(request: RegisterRequest): Promise<RegisterResponse> {
    return await this.makeGrpcCall('frontend', 'Register', request);
  }

  async logout(token: string): Promise<any> {
    return await this.makeGrpcCall('frontend', 'Logout', { token });
  }

  async validateToken(token: string): Promise<any> {
    return await this.makeGrpcCall('frontend', 'ValidateToken', { token });
  }

  // System status
  async getSystemStatus(): Promise<SystemStatusResponse> {
    return await this.makeGrpcCall('frontend', 'GetSystemStatus', {});
  }

  // Terminal operations
  async createTerminalSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    return await this.makeGrpcCall('terminal', 'CreateSession', request);
  }

  async executeCommand(request: ExecuteCommandRequest): Promise<ExecuteCommandResponse> {
    return await this.makeGrpcCall('terminal', 'ExecuteCommand', request);
  }

  async getTerminalOutput(request: GetOutputRequest): Promise<GetOutputResponse> {
    return await this.makeGrpcCall('terminal', 'GetOutput', request);
  }

  async listTerminalSessions(): Promise<ListSessionsResponse> {
    return await this.makeGrpcCall('terminal', 'ListSessions', {});
  }

  async killTerminalSession(request: KillSessionRequest): Promise<KillSessionResponse> {
    return await this.makeGrpcCall('terminal', 'KillSession', request);
  }

  // Terminal streaming (simplified implementation using polling for now)
  async streamTerminalOutput(
    sessionId: string,
    onData: (chunk: OutputChunk) => void,
    onEnd?: () => void
  ): Promise<() => void> {
    let isStreaming = true;
    let lastOutputLength = 0;

    const pollOutput = async () => {
      while (isStreaming) {
        try {
          const response = await this.getTerminalOutput({ session_id: sessionId, max_lines: 100 });
          if (response.lines.length > lastOutputLength) {
            const newLines = response.lines.slice(lastOutputLength);
            newLines.forEach(line => {
              onData({
                data: line + '\n',
                session_id: sessionId,
                timestamp: Date.now(),
                is_error: false
              });
            });
            lastOutputLength = response.lines.length;
          }
        } catch (error) {
          console.error('Error polling terminal output:', error);
          onData({
            data: `Error: ${error}\n`,
            session_id: sessionId,
            timestamp: Date.now(),
            is_error: true
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
      }
      onEnd?.();
    };

    pollOutput();

    // Return cleanup function
    return () => {
      isStreaming = false;
    };
  }

  // Streaming methods (simplified - would need proper implementation for production)
  streamConversationWithAgent(request: any) {
    // For now, return a simple implementation
    // In a full implementation, this would use server-sent events or websockets
    console.warn('Streaming not yet implemented in simplified gRPC client');
    return {
      async *[Symbol.asyncIterator]() {
        // Placeholder implementation
        yield { content: 'Streaming not implemented', type: 'error' };
      }
    };
  }

  streamExecution(request: any) {
    console.warn('Streaming execution not yet implemented in simplified gRPC client');
    return {
      async *[Symbol.asyncIterator]() {
        yield { output: 'Streaming not implemented', type: 'error' };
      }
    };
  }

  // Utility methods
  disconnect() {
    // Nothing to clean up in this simplified implementation
  }
}

// Create singleton instance
export const grpcClient = new GrpcClientService();

export default grpcClient;