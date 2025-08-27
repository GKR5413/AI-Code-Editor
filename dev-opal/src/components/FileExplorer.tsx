import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash,
  FolderPlus,
  FilePlus,
  Copy,
  Scissors,
  Clipboard,
  ExternalLink,
  GitBranch,
  RotateCcw,
  Circle,
  X,
  Loader,
  Code2,
  Database,
  Image,
  Settings,
  FileText,
  Lock,
  Zap,
  Palette,
  Globe,
  Package,
  Terminal,
  Key,
  Archive,
  FileImage,
  Braces,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIDE, IDEFileNode } from '@/contexts/IDEContext';
import { fileSystemService } from '@/services/fileSystemService';
import { terminalWorkspaceService } from '@/services/terminalWorkspaceService';
import UniversalFileAccess from './UniversalFileAccess';
import path from 'path-browserify';

// NOTE: The local FileNode interface is removed. Using IDEFileNode from context.

interface ContextMenuProps {
  x: number;
  y: number;
  node: IDEFileNode;
  onClose: () => void;
  onAction: (action: string, node: IDEFileNode) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, node, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getContextMenuItems = (node: IDEFileNode) => {
    return [
      // File Operations
      { icon: FilePlus, label: 'New File', action: 'newFile', shortcut: 'Ctrl+N' },
      { icon: FolderPlus, label: 'New Folder', action: 'newFolder' },
      { separator: true },
      
      // Edit Operations
      { icon: Pencil, label: 'Rename', action: 'rename', shortcut: 'F2' },
      { icon: Copy, label: 'Copy', action: 'copy', shortcut: 'Ctrl+C' },
      { icon: Scissors, label: 'Cut', action: 'cut', shortcut: 'Ctrl+X' },
      { icon: Clipboard, label: 'Paste', action: 'paste', shortcut: 'Ctrl+V' },
      { separator: true },
      
      // Advanced Operations
      { icon: Copy, label: 'Copy Path', action: 'copyPath' },
      { icon: Copy, label: 'Copy Relative Path', action: 'copyRelativePath' },
      { icon: ExternalLink, label: 'Reveal in File Explorer', action: 'revealInExplorer' },
      { separator: true },
      
      // Source Control (if applicable)
      ...(node.gitStatus ? [
        { icon: GitBranch, label: 'Open Changes', action: 'openGitChanges' },
        { icon: RotateCcw, label: 'Discard Changes', action: 'discardChanges' },
        { separator: true },
      ] : []),
      
      // Danger Zone
      { icon: Trash, label: 'Delete', action: 'delete', shortcut: 'Delete' },
    ];
  };

  const menuItems = getContextMenuItems(node);

  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {menuItems.map((item, index) => (
        <div key={index}>
          {item.separator ? (
            <div className="menu-separator" />
          ) : (
            <div 
              className="menu-item"
              onClick={() => {
                onAction(item.action, node);
                onClose();
              }}
            >
              <div className="menu-icon">
                {item.icon && <item.icon className="w-4 h-4" />}
              </div>
              <span className="menu-label">{item.label}</span>
              {item.shortcut && (
                <span className="menu-shortcut">{item.shortcut}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

interface FileTreeNodeProps {
  node: IDEFileNode;
  level: number;
  onSelect: (node: IDEFileNode) => void;
  onRename: (node: IDEFileNode, newName: string) => void;
  onDelete: (node: IDEFileNode) => void;
  onMove: (source: IDEFileNode, target: IDEFileNode) => void;
  onToggle: (node: IDEFileNode) => void;
  onNewFile: (parentNode: IDEFileNode) => void;
  onNewFolder: (parentNode: IDEFileNode) => void;
  selectedId?: string;
  expandedNodes: Set<string>;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  node, 
  level, 
  onSelect, 
  onRename, 
  onDelete, 
  onMove, 
  onToggle,
  onNewFile,
  onNewFolder,
  selectedId,
  expandedNodes
}) => {
  const isExpanded = expandedNodes.has(node.id);
  console.log(`🔄 RENDER ${node.name}: expanded=${isExpanded}, nodeId=${node.id}, inExpandedSet=${expandedNodes.has(node.id)}`);
  const [isRenaming, setIsRenaming] = useState(false);
  const [dragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [newName, setNewName] = useState(node.name);

  const indent = level * 12; // 12px per level like VS Code
  const isSelected = selectedId === node.id;

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    
    // If clicking on a folder, also toggle its expansion
    if (node.type === 'folder') {
      toggleExpand(e);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`🖱️ CHEVRON CLICK: ${node.name} (${node.type})`);
    console.log(`📂 Current expansion state: ${isExpanded}`);
    console.log(`🆔 Node ID: ${node.id}, Node path: ${node.path}`);
    console.log(`👥 Current children count: ${node.children?.length || 0}`);
    onToggle(node);
  };

  const showContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleContextAction = (action: string, targetNode: IDEFileNode) => {
    switch (action) {
      case 'rename':
        setIsRenaming(true);
        break;
      case 'delete':
        onDelete(targetNode);
        break;
      case 'newFile':
        onNewFile(targetNode);
        break;
      case 'newFolder':
        onNewFolder(targetNode);
        break;
      default:
        break;
    }
  };

  const confirmRename = (value: string) => {
    if (value && value !== node.name) {
      onRename(node, value);
    }
    setIsRenaming(false);
    setNewName(node.name);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirmRename(newName);
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(node.name);
    }
  };

  const getFileIcon = (node: IDEFileNode) => {
    if (node.type === 'folder') {
      // Special folder icons with VS Code-like styling
      const folderIconMap: Record<string, JSX.Element> = {
        'src': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-blue-500" /> :
          <Folder className="w-4 h-4 text-blue-500" />,
        'components': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-green-500" /> :
          <Folder className="w-4 h-4 text-green-500" />,
        'pages': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-purple-500" /> :
          <Folder className="w-4 h-4 text-purple-500" />,
        'hooks': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-pink-500" /> :
          <Folder className="w-4 h-4 text-pink-500" />,
        'utils': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-orange-500" /> :
          <Folder className="w-4 h-4 text-orange-500" />,
        'lib': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-indigo-500" /> :
          <Folder className="w-4 h-4 text-indigo-500" />,
        'assets': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-purple-600" /> :
          <Folder className="w-4 h-4 text-purple-600" />,
        'public': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-green-600" /> :
          <Folder className="w-4 h-4 text-green-600" />,
        'node_modules': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-green-800" /> :
          <Package className="w-4 h-4 text-green-800" />,
        '.git': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-orange-600" /> :
          <GitBranch className="w-4 h-4 text-orange-600" />,
        'contexts': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-blue-500" /> :
          <Folder className="w-4 h-4 text-blue-500" />,
        'services': isExpanded ? 
          <FolderOpen className="w-4 h-4 text-cyan-500" /> :
          <Folder className="w-4 h-4 text-cyan-500" />,
      };
      
      return folderIconMap[node.name] || (isExpanded ? 
        <FolderOpen className="w-4 h-4 text-blue-400" /> :
        <Folder className="w-4 h-4 text-blue-400" />);
    }
    
    const extension = node.name.split('.').pop()?.toLowerCase();
    const fileName = node.name.toLowerCase();
    
    // Special file names with technology-specific icons
    const specialFiles: Record<string, JSX.Element> = {
      'package.json': <Package className="w-4 h-4 text-green-600" />,
      'package-lock.json': <Lock className="w-4 h-4 text-gray-500" />,
      'tsconfig.json': <Settings className="w-4 h-4 text-blue-600" />,
      'tsconfig.app.json': <Settings className="w-4 h-4 text-blue-500" />,
      'tsconfig.node.json': <Settings className="w-4 h-4 text-green-600" />,
      'vite.config.ts': <Zap className="w-4 h-4 text-purple-500" />,
      'tailwind.config.ts': <Palette className="w-4 h-4 text-cyan-500" />,
      'postcss.config.js': <Palette className="w-4 h-4 text-red-500" />,
      'eslint.config.js': <Settings className="w-4 h-4 text-purple-600" />,
      'readme.md': <FileText className="w-4 h-4 text-blue-600" />,
      '.gitignore': <GitBranch className="w-4 h-4 text-orange-600" />,
      '.env': <Key className="w-4 h-4 text-yellow-600" />,
      '.env.local': <Key className="w-4 h-4 text-yellow-500" />,
      '.env.production': <Key className="w-4 h-4 text-red-600" />,
      'dockerfile': <Package className="w-4 h-4 text-blue-500" />,
      'docker-compose.yml': <Package className="w-4 h-4 text-blue-600" />,
      'components.json': <Settings className="w-4 h-4 text-green-500" />,
      'bun.lockb': <Lock className="w-4 h-4 text-orange-500" />,
      'index.html': <Globe className="w-4 h-4 text-orange-500" />,
      'start-ide.js': <Terminal className="w-4 h-4 text-green-600" />,
      'terminal-server.js': <Terminal className="w-4 h-4 text-blue-600" />,
    };
    
    if (specialFiles[fileName]) {
      return specialFiles[fileName];
    }
    
    // Extension-based icons with technology colors
    const iconMap: Record<string, JSX.Element> = {
      // JavaScript/TypeScript - using distinct icons
      'js': <Braces className="w-4 h-4 text-yellow-500" />,
      'jsx': <Code2 className="w-4 h-4 text-blue-400" />,
      'ts': <Code2 className="w-4 h-4 text-blue-600" />,
      'tsx': <Code2 className="w-4 h-4 text-blue-500" />,
      'mjs': <Braces className="w-4 h-4 text-yellow-400" />,
      
      // Web Technologies
      'html': <Globe className="w-4 h-4 text-orange-500" />,
      'css': <Palette className="w-4 h-4 text-blue-500" />,
      'scss': <Palette className="w-4 h-4 text-pink-500" />,
      'sass': <Palette className="w-4 h-4 text-pink-600" />,
      'less': <Palette className="w-4 h-4 text-blue-600" />,
      'json': <Braces className="w-4 h-4 text-yellow-600" />,
      'xml': <Braces className="w-4 h-4 text-orange-600" />,
      
      // Images
      'png': <FileImage className="w-4 h-4 text-purple-500" />,
      'jpg': <FileImage className="w-4 h-4 text-purple-500" />,
      'jpeg': <FileImage className="w-4 h-4 text-purple-500" />,
      'gif': <FileImage className="w-4 h-4 text-purple-400" />,
      'svg': <Image className="w-4 h-4 text-green-500" />,
      'ico': <Image className="w-4 h-4 text-blue-500" />,
      'webp': <FileImage className="w-4 h-4 text-purple-600" />,
      
      // Documents
      'md': <FileText className="w-4 h-4 text-blue-600" />,
      'txt': <FileText className="w-4 h-4 text-gray-500" />,
      'pdf': <FileText className="w-4 h-4 text-red-500" />,
      'doc': <FileText className="w-4 h-4 text-blue-600" />,
      'docx': <FileText className="w-4 h-4 text-blue-600" />,
      
      // Config files
      'env': <Key className="w-4 h-4 text-yellow-600" />,
      'yml': <Settings className="w-4 h-4 text-red-500" />,
      'yaml': <Settings className="w-4 h-4 text-red-500" />,
      'toml': <Settings className="w-4 h-4 text-orange-500" />,
      'ini': <Settings className="w-4 h-4 text-gray-600" />,
      'conf': <Settings className="w-4 h-4 text-gray-600" />,
      
      // Build & Lock files
      'lock': <Lock className="w-4 h-4 text-gray-600" />,
      'lockb': <Lock className="w-4 h-4 text-orange-500" />,
      
      // Shell & Scripts
      'sh': <Terminal className="w-4 h-4 text-green-600" />,
      'bash': <Terminal className="w-4 h-4 text-green-600" />,
      'zsh': <Terminal className="w-4 h-4 text-green-600" />,
      'fish': <Terminal className="w-4 h-4 text-green-600" />,
      'ps1': <Terminal className="w-4 h-4 text-blue-600" />,
      
      // Archives
      'zip': <Archive className="w-4 h-4 text-yellow-600" />,
      'tar': <Archive className="w-4 h-4 text-orange-600" />,
      'gz': <Archive className="w-4 h-4 text-orange-600" />,
      'rar': <Archive className="w-4 h-4 text-purple-600" />,
      '7z': <Archive className="w-4 h-4 text-gray-600" />,
      
      // Database
      'sql': <Database className="w-4 h-4 text-blue-600" />,
      'db': <Database className="w-4 h-4 text-green-600" />,
      'sqlite': <Database className="w-4 h-4 text-blue-500" />,
      
      // Others
      'gitignore': <GitBranch className="w-4 h-4 text-orange-600" />,
      'gitkeep': <GitBranch className="w-4 h-4 text-orange-500" />,
    };
    
    return iconMap[extension || ''] || <File className="w-4 h-4 text-gray-500" />;
  };

  const getGitStatusIcon = (status: string) => {
    const statusMap: Record<string, JSX.Element> = {
      'modified': <Circle className="w-2 h-2 text-orange-500 fill-current" />,
      'added': <Circle className="w-2 h-2 text-green-500 fill-current" />,
      'deleted': <Circle className="w-2 h-2 text-red-500 fill-current" />,
      'renamed': <Circle className="w-2 h-2 text-blue-500 fill-current" />,
      'untracked': <Circle className="w-2 h-2 text-gray-500 fill-current" />,
    };
    
    return statusMap[status];
  };

  return (
    <div className="tree-node">
      <div 
        className={`node-content ${isSelected ? 'selected' : ''} ${dragOver ? 'drag-over' : ''} ${node.loading ? 'loading' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={handleNodeClick}
        onContextMenu={showContextMenu}
      >
        
        {/* File/Folder Icon */}
        <div className="node-icon">
          {getFileIcon(node)}
        </div>
        
        {/* File/Folder Name */}
        {isRenaming ? (
          <input
            className="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => confirmRename(newName)}
            onKeyDown={handleRenameKeyDown}
            autoFocus
          />
        ) : (
          <span className="node-name">{node.name}</span>
        )}
        
        {/* Git Status Indicator */}
        {node.gitStatus && (
          <div className={`git-status ${node.gitStatus}`}>
            {getGitStatusIcon(node.gitStatus)}
          </div>
        )}
      </div>
      
      {/* Children Nodes */}
      {node.type === 'folder' && isExpanded && node.children && (
        <div className="node-children">
          {node.children.map(child => (
            <FileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onMove={onMove}
              onToggle={onToggle}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
            />
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
};

const FileExplorer: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['.']));
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'local' | 'terminal' | 'universal' | 'none'>('none');
  const [terminalFiles, setTerminalFiles] = useState<IDEFileNode[]>([]);
  const [lastManualRefresh, setLastManualRefresh] = useState<number>(Date.now());
  
  const { 
    files, 
    openFile,
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    refreshFileTree,
    loadNodeChildren,
  } = useIDE();

  const [fileTree, setFileTree] = useState<IDEFileNode[]>(files);
  
  useEffect(() => {
    setFileTree(files);
    setLoading(false);
  }, [files]);

  // Initialize terminal workspace connection
  useEffect(() => {
    const initializeTerminalWorkspace = async () => {
      console.log('🔧 Initializing Terminal Workspace connection...');
      try {
        const isConnected = await terminalWorkspaceService.testConnection();
        console.log(isConnected ? '✅ Terminal Workspace connected' : '❌ Terminal Workspace connection failed');
      } catch (error) {
        console.error('❌ Terminal Workspace initialization error:', error);
      }
    };

    initializeTerminalWorkspace();
  }, []); // Run once on component mount

  // Listen for terminal workspace connection requests
  useEffect(() => {
    const handleConnectToTerminalWorkspace = async (event: CustomEvent) => {
      const { sessionId } = event.detail;
      terminalWorkspaceService.setSessionId(sessionId);
      setViewMode('terminal');
      await loadTerminalFiles();
    };

    window.addEventListener('connectToTerminalWorkspace', handleConnectToTerminalWorkspace as EventListener);
    
    return () => {
      window.removeEventListener('connectToTerminalWorkspace', handleConnectToTerminalWorkspace as EventListener);
    };
  }, []);

  // Listen for terminal command executions to auto-refresh workspace files
  useEffect(() => {
    const handleTerminalCommand = async () => {
      // Only auto-refresh if we're currently viewing the terminal workspace
      if (viewMode === 'terminal' && terminalWorkspaceService.isConnected()) {
        // Only auto-refresh if it's been more than 5 seconds since last manual refresh
        const timeSinceManualRefresh = Date.now() - lastManualRefresh;
        if (timeSinceManualRefresh > 5000) {
          console.log('🔄 Auto-refresh after terminal command (manual refresh was', Math.round(timeSinceManualRefresh/1000), 'seconds ago)');
          setTimeout(() => {
            loadTerminalFiles();
          }, 2000); // Increased from 500ms to 2 seconds
        } else {
          console.log('🔄 Skipping auto-refresh (manual refresh was', Math.round(timeSinceManualRefresh/1000), 'seconds ago)');
        }
      }
    };

    window.addEventListener('terminalCommandExecuted', handleTerminalCommand as EventListener);
    
    return () => {
      window.removeEventListener('terminalCommandExecuted', handleTerminalCommand as EventListener);
    };
  }, [viewMode, lastManualRefresh]);

  // Set up terminal workspace change listener
  useEffect(() => {
    if (viewMode === 'terminal' && terminalWorkspaceService.isConnected()) {
      const refreshHandler = () => {
        // Only auto-refresh if it's been more than 10 seconds since last manual refresh
        const timeSinceManualRefresh = Date.now() - lastManualRefresh;
        if (timeSinceManualRefresh > 10000) {
          console.log('🔄 Auto-refresh from polling (manual refresh was', Math.round(timeSinceManualRefresh/1000), 'seconds ago)');
          loadTerminalFiles();
        } else {
          console.log('🔄 Skipping polling refresh (manual refresh was', Math.round(timeSinceManualRefresh/1000), 'seconds ago)');
        }
      };
      
      terminalWorkspaceService.addChangeListener(refreshHandler);
      terminalWorkspaceService.startPolling(30000); // Poll every 30 seconds instead of 10
      
      return () => {
        terminalWorkspaceService.removeChangeListener(refreshHandler);
        terminalWorkspaceService.stopPolling();
      };
    }
  }, [viewMode, lastManualRefresh]);

  // Keyboard shortcuts for view mode switching
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + T for Terminal workspace
      if (event.ctrlKey || event.metaKey) {
        if (event.shiftKey && event.key === 'T') {
          event.preventDefault();
          if (terminalWorkspaceService.isConnected()) {
            switchViewMode(viewMode === 'terminal' ? 'universal' : 'terminal');
          }
        }
        // Ctrl/Cmd + Shift + L for Local files
        else if (event.shiftKey && event.key === 'L') {
          event.preventDefault();
          switchViewMode(viewMode === 'universal' ? 'none' : 'universal');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const loadTerminalFiles = async () => {
    if (!terminalWorkspaceService.isConnected()) return;
    
    try {
      setLoading(true);
      console.log('🔄 Loading terminal files from root...');
      const files = await terminalWorkspaceService.getFiles();
      console.log('✅ Terminal files loaded:', files);
      
      // Preserve expanded state and children when refreshing
      setTerminalFiles(currentFiles => {
        if (currentFiles.length === 0) {
          return files; // First load, no state to preserve
        }
        
        // Check if files have actually changed to avoid unnecessary updates
        if (!hasFileTreeChanged(currentFiles, files)) {
          console.log('🔄 No changes detected, preserving existing state');
          return currentFiles;
        }
        
        console.log('🔄 Changes detected, merging with existing state');
        // Merge new files with existing expanded state
        return mergeFileTrees(currentFiles, files);
      });
    } catch (error) {
      console.error('❌ Failed to load terminal files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to merge file trees while preserving expanded state
  const mergeFileTrees = (existingTree: IDEFileNode[], newTree: IDEFileNode[]): IDEFileNode[] => {
    const existingMap = new Map<string, IDEFileNode>();
    
    // Create a map of existing nodes by path
    const buildMap = (nodes: IDEFileNode[]) => {
      nodes.forEach(node => {
        existingMap.set(node.path, node);
        if (node.children) {
          buildMap(node.children);
        }
      });
    };
    buildMap(existingTree);
    
    // Merge new tree with existing state
    const mergeNodes = (nodes: IDEFileNode[]): IDEFileNode[] => {
      return nodes.map(newNode => {
        const existingNode = existingMap.get(newNode.path);
        
        if (existingNode) {
          // Preserve existing state (expanded, children, etc.)
          return {
            ...newNode,
            children: existingNode.children || (newNode.type === 'folder' ? [] : undefined),
            loading: existingNode.loading || false
          };
        }
        
        // New node, initialize with default state
        return {
          ...newNode,
          children: newNode.type === 'folder' ? [] : undefined,
          loading: false
        };
      });
    };
    
    return mergeNodes(newTree);
  };

  // Check if file trees have actually changed to avoid unnecessary refreshes
  const hasFileTreeChanged = (oldTree: IDEFileNode[], newTree: IDEFileNode[]): boolean => {
    if (oldTree.length !== newTree.length) return true;
    
    // Simple path-based comparison since we don't have reliable timestamps
    const oldPaths = new Set(oldTree.map(node => node.path));
    const newPaths = new Set(newTree.map(node => node.path));
    
    if (oldPaths.size !== newPaths.size) return true;
    
    for (const path of oldPaths) {
      if (!newPaths.has(path)) return true;
    }
    
    return false;
  };


  const switchViewMode = async (mode: 'local' | 'terminal' | 'universal' | 'none') => {
    setViewMode(mode);
    if (mode === 'terminal') {
      await loadTerminalFiles();
    }
  };

  const toggleFolder = useCallback(async (nodeToToggle: IDEFileNode) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(nodeToToggle.id)) {
      newExpanded.delete(nodeToToggle.id);
    } else {
      newExpanded.add(nodeToToggle.id);
    }
    setExpanded(newExpanded);

    if (!nodeToToggle.children || nodeToToggle.children.length === 0) {
      let children: IDEFileNode[] = [];
      
      if (viewMode === 'terminal') {
        // Load children from terminal workspace
        try {
          console.log('🔄 Loading children for terminal folder:', nodeToToggle.path);
          // Remove leading slash for API call
          const relativePath = nodeToToggle.path.startsWith('/') ? nodeToToggle.path.slice(1) : nodeToToggle.path;
          console.log('📁 API call with relative path:', relativePath);
          children = await terminalWorkspaceService.getFiles(relativePath);
          console.log('✅ Loaded children:', children);
        } catch (error) {
          console.error('Failed to load terminal folder children:', error);
          children = [];
        }
      } else {
        // Load children from local IDE context
        children = await loadNodeChildren(nodeToToggle);
      }
      
      const updateTree = (nodes: IDEFileNode[]): IDEFileNode[] => {
        return nodes.map(node => {
          if (node.id === nodeToToggle.id) {
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateTree(node.children) };
          }
          return node;
        });
      };
      
      if (viewMode === 'terminal') {
        setTerminalFiles(currentTree => updateTree(currentTree));
      } else {
        setFileTree(currentTree => updateTree(currentTree));
      }
    }
  }, [expanded, loadNodeChildren, viewMode]);
    
  const handleSelect = useCallback(async (node: IDEFileNode) => {
    console.log('🖱️ handleSelect called with node:', node);
    setSelectedId(node.id);
    if (node.type === 'file') {
      console.log('📄 Node is a file, calling openFile');
      if (viewMode === 'terminal') {
        // For terminal workspace files, we need to fetch content differently
        try {
          console.log('🔍 Fetching content for terminal file:', node.path);
          // Remove leading slash for API call
          const relativePath = node.path.startsWith('/') ? node.path.slice(1) : node.path;
          console.log('📁 API call with relative path:', relativePath);
          const content = await terminalWorkspaceService.getFileContent(relativePath);
          console.log('✅ File content loaded, length:', content.length);
          // Create a virtual file node with content for the editor
          const virtualNode = {
            ...node,
            content
          };
          await openFile(virtualNode);
        } catch (error) {
          console.error('❌ Failed to open terminal workspace file:', error);
        }
      } else {
        await openFile(node);
      }
    } else {
      console.log('📁 Node is not a file, type:', node.type);
    }
  }, [openFile, viewMode]);

  const handleNewFile = useCallback(async (parentNode: IDEFileNode) => {
    await createFile(parentNode);
  }, [createFile]);

  const handleNewFolder = useCallback(async (parentNode: IDEFileNode) => {
    await createFolder(parentNode);
  }, [createFolder]);

  const handleRename = useCallback(async (node: IDEFileNode, newName: string) => {
    await renameNode(node, newName);
    refreshFileTree();
  }, [renameNode, refreshFileTree]);

  const handleDelete = useCallback(async (node: IDEFileNode) => {
    if (await fileSystemService.confirmDelete(node.path)) {
      await deleteNode(node);
      refreshFileTree();
    }
  }, [deleteNode, refreshFileTree]);

  const handleMove = useCallback(async (source: IDEFileNode, target: IDEFileNode) => {
    await fileSystemService.moveNode(source, target);
    refreshFileTree();
  }, [refreshFileTree]);

  const handleRefresh = useCallback(async () => {
    if (viewMode === 'terminal') {
      console.log('🔄 Manual refresh requested');
      setLastManualRefresh(Date.now());
      await loadTerminalFiles();
    } else {
      await refreshFileTree();
    }
  }, [viewMode, loadTerminalFiles, refreshFileTree]);



  const filteredFileTree = useCallback(() => {
    // Return empty array if no view mode is selected
    if (viewMode === 'none') {
      return [];
    }
    
    let currentTree = viewMode === 'terminal' ? terminalFiles : fileTree;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      currentTree = currentTree.filter(node => {
        const nameMatch = node.name.toLowerCase().includes(query);
        const pathMatch = node.path.toLowerCase().includes(query);
        return nameMatch || pathMatch;
      });
    }
    return currentTree;
  }, [fileTree, terminalFiles, searchQuery, viewMode]);


  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <div className="section-title">
          <span className="title-text">EXPLORER</span>
          {viewMode === 'terminal' && (
            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md">
              Terminal Workspace
            </span>
          )}
          {viewMode === 'universal' && (
            <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md">
              Local Files
            </span>
          )}
        </div>
        <div className="header-actions">
          <button 
            className={`action-btn hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${viewMode === 'universal' ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`} 
            onClick={() => switchViewMode('universal')} 
            title="Browse Local System Files (Ctrl+Shift+L)"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button 
            className={`action-btn hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${viewMode === 'terminal' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 dark:text-gray-300'} ${!terminalWorkspaceService.isConnected() ? 'opacity-50 cursor-not-allowed' : ''}`} 
            onClick={() => switchViewMode('terminal')} 
            title={terminalWorkspaceService.isConnected() ? "Browse Terminal Workspace Files (Ctrl+Shift+T)" : "Terminal workspace not connected"}
            disabled={!terminalWorkspaceService.isConnected()}
          >
            <Terminal className="w-4 h-4" />
          </button>
          {viewMode !== 'none' && (
            <button 
              className="action-btn text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
              onClick={handleRefresh} 
              title="Refresh file tree"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {viewMode !== 'none' && (
            <button 
              className="action-btn text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
              onClick={() => switchViewMode('none')} 
              title="Close file browser"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="search-bar">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          />
      </div>
      <div className="tree-container">
        {viewMode === 'none' ? (
          <div className="empty-state p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">Select a file source above to browse files</p>
          </div>
        ) : viewMode === 'universal' ? (
          <UniversalFileAccess />
        ) : loading ? (
          <div className="loading-state">
            <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            Loading file tree...
        </div>
        ) : filteredFileTree().length === 0 && viewMode === 'terminal' && !terminalWorkspaceService.isConnected() ? (
          <div className="empty-state p-4 text-center text-gray-500 dark:text-gray-400">
            <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium mb-1">Terminal workspace not connected</p>
            <p className="text-xs">Start a terminal session to browse workspace files</p>
          </div>
        ) : filteredFileTree().length === 0 && viewMode === 'terminal' ? (
          <div className="empty-state p-4 text-center text-gray-500 dark:text-gray-400">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium mb-1">Terminal workspace is empty</p>
            <p className="text-xs">Files created in the terminal will appear here</p>
          </div>
        ) : (
          <div className="tree-view">
            {filteredFileTree().map(node => (
              <FileTreeNode
            key={node.id}
            node={node}
                level={0} // Root level
                onSelect={handleSelect}
                onRename={handleRename}
                onDelete={handleDelete}
                onMove={handleMove}
            onToggle={toggleFolder}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
            selectedId={selectedId}
                expandedNodes={expanded}
          />
        ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;