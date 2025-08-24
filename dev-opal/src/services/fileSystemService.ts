export interface FileSystemItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  fullPath: string;
  size: number;
  modified: string;
  hidden: boolean;
}

export interface DirectoryResponse {
  path: string;
  fullPath: string;
  relativePath: string;
  files: FileSystemItem[];
}

export interface FileContentResponse {
  path: string;
  fullPath: string;
  relativePath: string;
  content: string;
  size: number;
  modified: string;
}

class FileSystemService {
  private baseUrl = 'http://localhost:3005'; // File System API for shared volumes

  async getDirectoryContents(path: string = '.'): Promise<DirectoryResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/files?path=${encodeURIComponent(path)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch directory: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      throw error;
    }
  }

  async getFileContent(path: string): Promise<FileContentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/file-content?path=${encodeURIComponent(path)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw error;
    }
  }

  // Convert FileSystemItem to the format expected by FileExplorer
  convertToFileNode(item: FileSystemItem, expanded: Set<string>): any {
    return {
      id: item.path || item.name,
      name: item.name,
      type: item.type,
      path: item.path,
      fullPath: item.fullPath,
      size: item.size,
      modified: item.modified,
      hidden: item.hidden,
      expanded: item.type === 'folder' ? expanded.has(item.path || item.name) : undefined,
      children: item.type === 'folder' ? [] : undefined
    };
  }

  async createFileOrFolder(path: string, type: 'file' | 'folder'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response.json();
  }

  async renameFileOrFolder(oldPath: string, newPath: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response.json();
  }

  async deleteFileOrFolder(path: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response.json();
  }

  async moveFileOrFolder(source: string, destination: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    return response.json();
  }
}

export const fileSystemService = new FileSystemService();