import { IDEFileNode } from '@/contexts/IDEContext';
import { terminalConfig } from '@/config/terminal';

export class TerminalWorkspaceService {
  private baseUrl = terminalConfig.API_BASE_URL;
  private sessionId: string | null = null;

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.sessionId || localStorage.getItem('terminalSessionId');
  }

  async getFiles(path: string = ''): Promise<IDEFileNode[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/files?path=${encodeURIComponent(path)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      // Convert API response to IDEFileNode format
      return data.files.map((file: any) => ({
        id: file.id || file.path,
        name: file.name,
        type: file.type,
        path: file.path,
        children: file.type === 'folder' ? [] : undefined
      }));
    } catch (error) {
      console.error('Error fetching terminal workspace files:', error);
      throw error;
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/content?path=${encodeURIComponent(filePath)}`);
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
    // For now, always return true since we can access the Docker volume directly
    return true;
  }
}

export const terminalWorkspaceService = new TerminalWorkspaceService();