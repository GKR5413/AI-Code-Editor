/**
 * Terminal Workspace Service
 * Provides file access to the shared Docker workspace where terminal commands execute
 * Now integrated with compiler container's shared storage via gRPC
 */

import { IDEFileNode } from '@/contexts/IDEContext';
import { grpcClient } from './grpcClient';
import type { ListFilesRequest, ReadFileRequest, WriteFileRequest, DeleteFileRequest, CreateDirectoryRequest } from './grpcClient';

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
   * Get files from workspace directory using gRPC
   */
  async getFiles(relativePath: string = ''): Promise<IDEFileNode[]> {
    try {
      const request: ListFilesRequest = {
        path: relativePath || '/',
        recursive: false
      };

      const response = await grpcClient.listFiles(request);
      
      if (!response.success || !response.files) {
        throw new Error(response.error || 'Failed to get files');
      }

      // Convert gRPC response to IDEFileNode format
      return response.files.map(file => ({
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
      console.error('Error getting workspace files via gRPC:', error);
      this.connected = false;
      return [];
    }
  }

  /**
   * Get file content from workspace using gRPC
   */
  async getFileContent(filePath: string): Promise<string> {
    try {
      const request: ReadFileRequest = {
        path: filePath,
        encoding: 'utf8'
      };

      const response = await grpcClient.readFile(request);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to read file');
      }

      return response.content || '';
    } catch (error) {
      console.error('Error reading workspace file via gRPC:', error);
      return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Write file to workspace using gRPC
   */
  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      const request: WriteFileRequest = {
        path: filePath,
        content: content,
        encoding: 'utf8'
      };

      const response = await grpcClient.writeFile(request);
      
      if (response.success) {
        // Notify listeners of file changes
        this.notifyChange();
      }
      
      return response.success;
    } catch (error) {
      console.error('Error writing workspace file via gRPC:', error);
      return false;
    }
  }

  /**
   * Create directory in workspace using gRPC
   */
  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      const request: CreateDirectoryRequest = {
        path: dirPath
      };

      const response = await grpcClient.createDirectory(request);
      
      if (response.success) {
        // Notify listeners of file changes
        this.notifyChange();
      }
      
      return response.success;
    } catch (error) {
      console.error('Error creating workspace directory via gRPC:', error);
      return false;
    }
  }

  /**
   * Delete file or directory from workspace using gRPC
   */
  async delete(itemPath: string): Promise<boolean> {
    try {
      const request: DeleteFileRequest = {
        path: itemPath
      };

      const response = await grpcClient.deleteFile(request);
      
      if (response.success) {
        // Notify listeners of file changes
        this.notifyChange();
      }
      
      return response.success;
    } catch (error) {
      console.error('Error deleting workspace item via gRPC:', error);
      return false;
    }
  }

  /**
   * Test connection to workspace service via gRPC
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test both gRPC health and file access
      const healthCheck = await grpcClient.healthCheck();
      const files = await this.getFiles();
      
      this.connected = healthCheck.healthy && files.length >= 0; // files array can be empty but should exist
      return this.connected;
    } catch (error) {
      console.error('Workspace connection test failed:', error);
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

  /**
   * Get workspace statistics and information
   */
  async getWorkspaceInfo(): Promise<{
    connected: boolean;
    totalFiles: number;
    totalSize: number;
    lastAccessed: Date;
  }> {
    try {
      const files = await this.getFiles('/');
      const totalFiles = this.countFilesRecursive(files);
      const totalSize = this.calculateSizeRecursive(files);
      
      return {
        connected: this.connected,
        totalFiles,
        totalSize,
        lastAccessed: new Date()
      };
    } catch (error) {
      return {
        connected: false,
        totalFiles: 0,
        totalSize: 0,
        lastAccessed: new Date()
      };
    }
  }

  /**
   * Get files recursively for workspace tree view
   */
  async getFilesRecursive(relativePath: string = ''): Promise<IDEFileNode[]> {
    try {
      const request: ListFilesRequest = {
        path: relativePath || '/',
        recursive: true
      };

      const response = await grpcClient.listFiles(request);
      
      if (!response.success || !response.files) {
        throw new Error(response.error || 'Failed to get files recursively');
      }

      // Convert gRPC response to IDEFileNode format
      return response.files.map(file => ({
        id: file.path,
        name: file.name,
        type: file.type === 'directory' ? 'folder' : 'file',
        path: file.path,
        size: file.size,
        children: file.type === 'directory' ? [] : undefined,
        loading: false,
        lastModified: new Date(file.modified),
      }));
    } catch (error) {
      console.error('Error getting workspace files recursively via gRPC:', error);
      this.connected = false;
      return [];
    }
  }

  /**
   * Check if a file or directory exists in the workspace
   */
  async exists(itemPath: string): Promise<boolean> {
    try {
      const response = await grpcClient.readFile({
        path: itemPath,
        encoding: 'utf8'
      });
      return response.success;
    } catch (error) {
      // If read fails, try to list parent directory to see if item exists
      try {
        const parentPath = itemPath.split('/').slice(0, -1).join('/') || '/';
        const files = await this.getFiles(parentPath);
        const fileName = itemPath.split('/').pop();
        return files.some(file => file.name === fileName);
      } catch {
        return false;
      }
    }
  }

  /**
   * Get file/directory metadata
   */
  async getMetadata(itemPath: string): Promise<{
    name: string;
    type: 'file' | 'folder';
    size: number;
    lastModified: Date;
    exists: boolean;
  } | null> {
    try {
      const parentPath = itemPath.split('/').slice(0, -1).join('/') || '/';
      const files = await this.getFiles(parentPath);
      const fileName = itemPath.split('/').pop();
      
      const file = files.find(f => f.name === fileName);
      if (!file) return null;

      return {
        name: file.name,
        type: file.type,
        size: file.size || 0,
        lastModified: file.lastModified || new Date(),
        exists: true
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  // Helper methods
  private countFilesRecursive(files: IDEFileNode[]): number {
    let count = 0;
    for (const file of files) {
      count++;
      if (file.children) {
        count += this.countFilesRecursive(file.children);
      }
    }
    return count;
  }

  private calculateSizeRecursive(files: IDEFileNode[]): number {
    let size = 0;
    for (const file of files) {
      size += file.size || 0;
      if (file.children) {
        size += this.calculateSizeRecursive(file.children);
      }
    }
    return size;
  }
}

export const terminalWorkspaceService = new TerminalWorkspaceService();