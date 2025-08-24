import { IDEFileNode } from '@/contexts/IDEContext';

export class TerminalWorkspaceService {
  private baseUrl = 'http://localhost:3001';
  private sessionId: string | null = null;

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.sessionId || localStorage.getItem('terminalSessionId');
  }

  async getFiles(path: string = ''): Promise<IDEFileNode[]> {
    const sessionId = this.getSessionId();
    if (!sessionId) {
      throw new Error('No active terminal session');
    }

    try {
      const response = await fetch(`${this.baseUrl}/workspace/${sessionId}/files?path=${encodeURIComponent(path)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      // Convert API response to IDEFileNode format
      return data.files.map((file: any) => ({
        id: `${sessionId}:${file.path}`,
        name: file.name,
        type: file.type,
        path: file.path,
        size: file.size,
        modified: new Date(file.modified),
        children: file.type === 'folder' ? [] : undefined
      }));
    } catch (error) {
      console.error('Error fetching terminal workspace files:', error);
      throw error;
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    const sessionId = this.getSessionId();
    if (!sessionId) {
      throw new Error('No active terminal session');
    }

    try {
      const response = await fetch(`${this.baseUrl}/workspace/${sessionId}/content?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch file content');
      }

      return data.content;
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<Array<{ sessionId: string; workspace: string; active: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/active-sessions`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch active sessions');
      }

      return data.sessions;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.getSessionId() !== null;
  }
}

export const terminalWorkspaceService = new TerminalWorkspaceService();