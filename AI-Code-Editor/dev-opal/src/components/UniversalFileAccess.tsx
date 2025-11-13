import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Tablet,
  Laptop,
  HardDrive,
  Folder,
  FolderOpen,
  File,
  Download,
  Upload,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Home,
  Users,
  Settings,
  Archive,
  Image,
  FileText,
  Music,
  Video,
  Database,
  Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIDE } from '@/contexts/IDEContext';

interface OSInfo {
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
  version: string;
  userAgent: string;
  isMobile: boolean;
  isTablet: boolean;
}

interface UniversalFileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  modified?: string;
  children?: UniversalFileNode[];
  handle?: any; // FileSystemHandle for native access
  isExpanded?: boolean;
  isLoaded?: boolean;
}

const UniversalFileAccess: React.FC = () => {
  const [osInfo, setOsInfo] = useState<OSInfo | null>(null);
  const [fileTree, setFileTree] = useState<UniversalFileNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const { openFile } = useIDE();

  // Detect operating system and device type
  const detectOS = useCallback((): OSInfo => {
    const userAgent = navigator.userAgent;
    let platform: OSInfo['platform'] = 'unknown';
    let version = 'Unknown';
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*Tablet)|Tablet/i.test(userAgent);

    // Detect platform
    if (/Windows NT/i.test(userAgent)) {
      platform = 'windows';
      const match = userAgent.match(/Windows NT ([\d.]+)/);
      if (match) {
        const ntVersion = parseFloat(match[1]);
        if (ntVersion >= 10.0) version = '10/11';
        else if (ntVersion >= 6.3) version = '8.1';
        else if (ntVersion >= 6.2) version = '8';
        else if (ntVersion >= 6.1) version = '7';
        else version = 'Vista or older';
      }
    } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
      platform = 'macos';
      const match = userAgent.match(/Mac OS X ([\d_]+)/);
      if (match) version = match[1].replace(/_/g, '.');
    } else if (/Linux/i.test(userAgent) && !/Android/i.test(userAgent)) {
      platform = 'linux';
      version = 'Linux Distribution';
    } else if (/Android/i.test(userAgent)) {
      platform = 'android';
      const match = userAgent.match(/Android ([\d.]+)/);
      if (match) version = match[1];
    } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
      platform = 'ios';
      const match = userAgent.match(/OS ([\d_]+)/);
      if (match) version = match[1].replace(/_/g, '.');
    }

    return {
      platform,
      version,
      userAgent,
      isMobile,
      isTablet
    };
  }, []);

  // Initialize OS detection
  useEffect(() => {
    const os = detectOS();
    setOsInfo(os);
    initializeFileSystem(os);
  }, [detectOS]);

  // Initialize file system based on OS
  const initializeFileSystem = async (os: OSInfo) => {
    setLoading(true);
    try {
      // Start with a simple "Open Folder" option
      const rootNodes = await createInitialNodes();
      setFileTree(rootNodes);
    } catch (error) {
      console.error('Failed to initialize file system:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create initial nodes
  const createInitialNodes = async (): Promise<UniversalFileNode[]> => {
    const nodes: UniversalFileNode[] = [];

    console.log('showDirectoryPicker supported:', 'showDirectoryPicker' in window);
    console.log('User agent:', navigator.userAgent);
    console.log('Window object has showDirectoryPicker:', typeof (window as any).showDirectoryPicker);

    // Force native support check - try the API directly
    let hasNativeSupport = false;
    try {
      hasNativeSupport = 'showDirectoryPicker' in window && typeof (window as any).showDirectoryPicker === 'function';
    } catch (e) {
      hasNativeSupport = false;
    }

    console.log('Final hasNativeSupport decision:', hasNativeSupport);

    // For now, always use native if available - let's test this
    if (hasNativeSupport) {
      nodes.push({
        id: 'open_folder',
        name: 'Open Folder (Native)',
        type: 'folder',
        path: 'open_folder',
        isExpanded: false,
        isLoaded: false
      });
    } else {
      // Fallback for browsers without native support
      nodes.push({
        id: 'open_folder_fallback',
        name: 'Open Folder',
        type: 'folder',
        path: 'open_folder_fallback',
        isExpanded: false,
        isLoaded: false
      });
    }

    return nodes;
  };


  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    
    // Check if this is a directory upload (files have webkitRelativePath)
    const isDirectoryUpload = fileArray.some(file => (file as any).webkitRelativePath);
    
    if (isDirectoryUpload) {
      // Create folder structure from uploaded directory
      await createFolderStructure(fileArray);
    } else {
      // Handle individual files
      fileArray.forEach(async (file) => {
        try {
          const content = await readFileContent(file);
          const fileNode = {
            id: file.name,
            name: file.name,
            type: 'file' as const,
            path: file.name,
            size: file.size,
            modified: new Date(file.lastModified).toISOString(),
            content
          };
          await openFile(fileNode);
        } catch (error) {
          console.error('Error reading file:', error);
        }
      });
    }
  }, [openFile]);

  // Create folder structure from uploaded files
  const createFolderStructure = async (files: File[]) => {
    if (files.length === 0) return;

    // Get the root folder name from the first file's path
    const firstFile = files[0] as any;
    const rootPath = firstFile.webkitRelativePath;
    const rootFolderName = rootPath.split('/')[0];

    // Create a map to store folder structures
    const folderMap = new Map<string, UniversalFileNode>();

    // Create root folder
    const rootFolder: UniversalFileNode = {
      id: rootFolderName,
      name: rootFolderName,
      type: 'folder',
      path: rootFolderName,
      children: [],
      isExpanded: true,
      isLoaded: true
    };

    folderMap.set(rootFolderName, rootFolder);

    // Process each file and create folder structure
    for (const file of files) {
      const relativePath = (file as any).webkitRelativePath || file.name;
      const pathParts = relativePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      // Create intermediate folders
      let currentPath = '';
      let currentParent = rootFolder;
      
      for (let i = 1; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        currentPath = currentPath ? `${currentPath}/${folderName}` : `${rootFolderName}/${folderName}`;
        
        let folderNode = folderMap.get(currentPath);
        if (!folderNode) {
          folderNode = {
            id: currentPath,
            name: folderName,
            type: 'folder',
            path: currentPath,
            children: [],
            isExpanded: false,
            isLoaded: true
          };
          folderMap.set(currentPath, folderNode);
          currentParent.children!.push(folderNode);
        }
        currentParent = folderNode;
      }

      // Add the file
      const filePath = currentPath ? `${currentPath}/${fileName}` : `${rootFolderName}/${fileName}`;
      const fileNode: UniversalFileNode = {
        id: filePath,
        name: fileName,
        type: 'file',
        path: filePath,
        size: file.size,
        modified: new Date(file.lastModified).toISOString(),
        handle: file // Store the file object for reading content later
      };
      
      currentParent.children!.push(fileNode);
    }

    // Sort all folders (folders first, then files, alphabetically)
    const sortChildren = (node: UniversalFileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(rootFolder);

    // Update the file tree
    setFileTree([rootFolder]);
    setExpandedNodes(new Set([rootFolderName]));
  };

  // Read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  // Handle node click
  const handleNodeClick = useCallback(async (node: UniversalFileNode) => {
    if (node.type === 'file') {
      // Handle file selection - open it in the IDE
      await handleFileOpen(node);
    } else if (node.type === 'folder') {
      if (node.path === 'open_folder') {
        // Request native directory access
        await openLocalFolder();
      } else if (node.path === 'open_folder_fallback') {
        // Fallback directory upload for Safari/Firefox
        await openFolderFallback();
      } else {
        // Toggle expansion for regular folders
        await toggleFolder(node);
      }
    }
  }, []);

  // Fallback folder opening for Safari/Firefox
  const openFolderFallback = async () => {
    // Try to use the File System Access API first (newer browsers)
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        await loadFolderContents(dirHandle);
        return;
      } catch (error) {
        // User cancelled or API failed, fall back to webkitdirectory
      }
    }
    
    // For Safari: Unfortunately Safari shows "Choose Files to Upload" 
    // but this is just to read files locally - nothing gets uploaded
    directoryInputRef.current?.click();
  };

  // Open local folder
  const openLocalFolder = async () => {
    console.log('openLocalFolder called');
    try {
      if ('showDirectoryPicker' in window && typeof (window as any).showDirectoryPicker === 'function') {
        console.log('Using native showDirectoryPicker');
        // @ts-ignore - File System Access API
        const dirHandle = await window.showDirectoryPicker();
        console.log('Directory handle received:', dirHandle);
        await loadFolderContents(dirHandle);
      } else {
        console.log('Native showDirectoryPicker not available, falling back to webkitdirectory');
        directoryInputRef.current?.click();
      }
    } catch (error) {
      console.log('Error or cancellation:', error);
      // Fallback to webkitdirectory if native picker fails
      directoryInputRef.current?.click();
    }
  };

  // Load folder contents
  const loadFolderContents = async (dirHandle: any, parentPath = '') => {
    try {
      const nodes: UniversalFileNode[] = [];
      
      for await (const [name, handle] of dirHandle.entries()) {
        const fullPath = parentPath ? `${parentPath}/${name}` : name;
        
        const node: UniversalFileNode = {
          id: `${dirHandle.name}-${fullPath}`,
          name,
          type: handle.kind === 'directory' ? 'folder' : 'file',
          path: fullPath,
          handle,
          isExpanded: false,
          isLoaded: false,
          children: handle.kind === 'directory' ? [] : undefined
        };

        if (handle.kind === 'file') {
          try {
            const file = await handle.getFile();
            node.size = file.size;
            node.modified = new Date(file.lastModified).toISOString();
          } catch (e) {
            console.warn('Could not read file details:', e);
          }
        }

        nodes.push(node);
      }

      // Sort: folders first, then files, alphabetically
      const sortedNodes = nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // Create root folder node
      const rootNode: UniversalFileNode = {
        id: dirHandle.name,
        name: dirHandle.name,
        type: 'folder',
        path: dirHandle.name,
        handle: dirHandle,
        children: sortedNodes,
        isExpanded: true,
        isLoaded: true
      };

      // Replace the "Browse Local Folder" with the actual folder
      setFileTree([rootNode]);
      setExpandedNodes(new Set([dirHandle.name]));
      
    } catch (error) {
      console.error('Error loading folder contents:', error);
    }
  };

  // Toggle folder expansion
  const toggleFolder = async (node: UniversalFileNode) => {
    const newExpanded = new Set(expandedNodes);
    
    if (newExpanded.has(node.id)) {
      // Collapse folder
      newExpanded.delete(node.id);
    } else {
      // Expand folder
      newExpanded.add(node.id);
      
      // Load children if not loaded yet
      if (!node.isLoaded && node.handle) {
        await loadFolderChildren(node);
      }
    }
    
    setExpandedNodes(newExpanded);
  };

  // Load children for a folder
  const loadFolderChildren = async (parentNode: UniversalFileNode) => {
    if (!parentNode.handle) return;

    try {
      const children: UniversalFileNode[] = [];
      
      for await (const [name, handle] of parentNode.handle.entries()) {
        const childPath = `${parentNode.path}/${name}`;
        
        const childNode: UniversalFileNode = {
          id: `${parentNode.id}-${name}`,
          name,
          type: handle.kind === 'directory' ? 'folder' : 'file',
          path: childPath,
          handle,
          isExpanded: false,
          isLoaded: false,
          children: handle.kind === 'directory' ? [] : undefined
        };

        if (handle.kind === 'file') {
          try {
            const file = await handle.getFile();
            childNode.size = file.size;
            childNode.modified = new Date(file.lastModified).toISOString();
          } catch (e) {
            console.warn('Could not read file details:', e);
          }
        }

        children.push(childNode);
      }

      // Sort children
      const sortedChildren = children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // Update the file tree
      setFileTree(prev => updateNodeInTree(prev, parentNode.id, {
        ...parentNode,
        children: sortedChildren,
        isLoaded: true
      }));

    } catch (error) {
      console.error('Error loading folder children:', error);
    }
  };

  // Update a node in the tree
  const updateNodeInTree = (nodes: UniversalFileNode[], nodeId: string, updatedNode: UniversalFileNode): UniversalFileNode[] => {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return updatedNode;
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeInTree(node.children, nodeId, updatedNode)
        };
      }
      return node;
    });
  };

  // Handle file opening
  const handleFileOpen = async (node: UniversalFileNode) => {
    try {
      let content = '';
      
      if (node.handle) {
        if (node.handle instanceof File) {
          // For fallback mode (Safari/Firefox) - handle is a File object
          content = await node.handle.text();
        } else {
          // For native File System Access API - handle is a FileSystemFileHandle
          const file = await node.handle.getFile();
          content = await file.text();
        }
      } else {
        content = '// Please select a folder to access real files';
      }

      const fileNode = {
        id: node.id,
        name: node.name,
        type: 'file' as const,
        path: node.path,
        size: node.size,
        modified: node.modified,
        content
      };
      
      await openFile(fileNode);
    } catch (error) {
      console.error('Error opening file:', error);
      // Fallback content
      const fileNode = {
        id: node.id,
        name: node.name,
        type: 'file' as const,
        path: node.path,
        content: '// Error reading file content'
      };
      await openFile(fileNode);
    }
  };


  // Get file icon by extension
  const getFileIconByExtension = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap: Record<string, React.ReactNode> = {
      'js': <Code2 className="w-4 h-4 text-yellow-500" />,
      'jsx': <Code2 className="w-4 h-4 text-blue-400" />,
      'ts': <Code2 className="w-4 h-4 text-blue-600" />,
      'tsx': <Code2 className="w-4 h-4 text-blue-500" />,
      'html': <FileText className="w-4 h-4 text-orange-500" />,
      'css': <FileText className="w-4 h-4 text-blue-500" />,
      'json': <Database className="w-4 h-4 text-yellow-600" />,
      'png': <Image className="w-4 h-4 text-purple-500" />,
      'jpg': <Image className="w-4 h-4 text-purple-500" />,
      'jpeg': <Image className="w-4 h-4 text-purple-500" />,
      'gif': <Image className="w-4 h-4 text-purple-400" />,
      'svg': <Image className="w-4 h-4 text-green-500" />,
      'md': <FileText className="w-4 h-4 text-blue-600" />,
      'txt': <FileText className="w-4 h-4 text-gray-500" />,
      'pdf': <FileText className="w-4 h-4 text-red-500" />
    };
    
    return iconMap[extension || ''] || <File className="w-4 h-4 text-gray-500" />;
  };


  // Get device icon
  const getDeviceIcon = () => {
    if (!osInfo) return <Folder className="w-5 h-5 text-blue-500" />;
    
    if (osInfo.isMobile) {
      return osInfo.isTablet ? 
        <Tablet className="w-5 h-5 text-blue-500" /> : 
        <Smartphone className="w-5 h-5 text-green-500" />;
    }
    
    return <Laptop className="w-5 h-5 text-purple-500" />;
  };

  // Render file tree node
  const renderFileNode = (node: UniversalFileNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const indent = level * 20;
    const hasChildren = node.type === 'folder' && node.children !== undefined;

    return (
      <div key={node.id} className="file-node">
        <div 
          className="file-node-content flex items-center gap-2 cursor-pointer"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          
          {/* File/Folder Icon */}
          <div className="w-4 h-4 flex items-center justify-center">
            {node.type === 'folder' ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 text-blue-400" />
              )
            ) : (
              getFileIconByExtension(node.name)
            )}
          </div>
          
          {/* File/Folder Name */}
          <span className="text-sm flex-1 truncate">{node.name}</span>
          
          {/* File Size */}
          {node.size && node.size > 0 && (
            <span className="text-xs text-gray-500 ml-auto">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        
        {/* Children */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="children">
            {node.children.map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="universal-file-access h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        {getDeviceIcon()}
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Local Files</h2>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => initializeFileSystem(osInfo!)}
          disabled={!osInfo}
          title="Refresh file access options"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>


      {/* File Tree */}
      <div 
        className={`flex-1 overflow-auto ${dragOver ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : (
          <div className="p-2">
            {fileTree.map(node => renderFileNode(node))}
          </div>
        )}

        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900 bg-opacity-80 pointer-events-none">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto text-blue-500 mb-2" />
              <p className="text-lg font-medium text-blue-700 dark:text-blue-300">
                Drop files here to open
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Selected Files Info */}
      {selectedFiles.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedFiles.length} file(s) selected
          </p>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      />
      <input
        ref={directoryInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in types
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        title="Select a folder to open"
        aria-label="Select folder"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      />
    </div>
  );
};

export default UniversalFileAccess;