/**
 * Terminal Workspace Service
 * Provides file access to the shared Docker workspace where terminal commands execute
 */

import { IDEFileNode } from '@/contexts/IDEContext';

interface WorkspaceFile {
  name: string;
  type: 'file' | 'directory';
  size: number;
  path: string;
  modified: string;
}

interface WorkspaceResponse {
  success: boolean;
  files?: WorkspaceFile[];
  content?: string;
  error?: string;
}

class TerminalWorkspaceService {
  private baseUrl = 'http://localhost:3002'; // Using compiler service as proxy to workspace
  private connected = true;
  private pollingInterval: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  /**
   * Check if the service is connected and available
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Set session ID (for compatibility with removed service interface)
   */
  setSessionId(sessionId: string): void {
    // Store session ID if needed for future use
    console.log('Terminal workspace session:', sessionId);
  }

  /**
   * Get files from workspace directory
   */
  async getFiles(relativePath: string = ''): Promise<IDEFileNode[]> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: relativePath || '/',
          action: 'list'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      
      if (!data.success || !data.files) {
        throw new Error(data.error || 'Failed to get files');
      }

      // Convert to IDEFileNode format
      return data.files.map(file => ({
        id: file.path, // Use path as unique ID
        name: file.name,
        type: file.type === 'directory' ? 'folder' : 'file', // Convert 'directory' to 'folder'
        path: file.path,
        size: file.size,
        children: file.type === 'directory' ? [] : undefined,
        loading: false,
        lastModified: new Date(file.modified),
      }));
    } catch (error) {
      console.error('Error getting workspace files:', error);
      this.connected = false;
      return [];
    }
  }

  /**
   * Get file content from workspace
   */
  async getFileContent(filePath: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          action: 'read'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to read file');
      }

      return data.content || '';
    } catch (error) {
      console.error('Error reading workspace file:', error);
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Write file to workspace
   */
  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: filePath,
          content: content,
          action: 'write'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error writing workspace file:', error);
      return false;
    }
  }

  /**
   * Create directory in workspace
   */
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: dirPath,
          action: 'mkdir'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error creating workspace directory:', error);
      return false;
    }
  }

  /**
   * Delete file or directory from workspace
   */
  async delete(itemPath: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: itemPath,
          action: 'delete'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkspaceResponse = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting workspace item:', error);
      return false;
    }
  }

  /**
   * Test connection to workspace service
   */
  async testConnection(): Promise<boolean> {
    try {
      const files = await this.getFiles();
      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  /**
   * Add a listener for file tree updates
   */
  addChangeListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove a listener for file tree updates
   */
  removeChangeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Start polling for file changes
   */
  startPolling(intervalMs: number = 2000): void {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(() => {
      this.notifyListeners();
    }, intervalMs);
  }

  /**
   * Stop polling for file changes
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Notify all listeners of file changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in terminal workspace change listener:', error);
      }
    });
  }

  /**
   * Manually trigger a change notification
   */
  notifyChange(): void {
    this.notifyListeners();
  }
}

export const terminalWorkspaceService = new TerminalWorkspaceService();