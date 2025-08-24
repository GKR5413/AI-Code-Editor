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
import { TreeFolderPicker } from './TreeFolderPicker';
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
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [currentWorkingDir, setCurrentWorkingDir] = useState('DEV-OPAL');
  const [viewMode, setViewMode] = useState<'local' | 'terminal' | 'universal' | 'none'>('none');
  const [terminalFiles, setTerminalFiles] = useState<IDEFileNode[]>([]);
  
  const { 
    files, 
    openFile,
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    refreshFileTree,
    loadNodeChildren,
    saveAll
  } = useIDE();

  const [fileTree, setFileTree] = useState<IDEFileNode[]>(files);
  
  useEffect(() => {
    setFileTree(files);
    setLoading(false);
  }, [files]);

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

  const loadTerminalFiles = async () => {
    if (!terminalWorkspaceService.isConnected()) return;
    
    try {
      setLoading(true);
      const files = await terminalWorkspaceService.getFiles();
      setTerminalFiles(files);
    } catch (error) {
      console.error('Failed to load terminal files:', error);
    } finally {
      setLoading(false);
    }
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
          children = await terminalWorkspaceService.getFiles(nodeToToggle.path);
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
    console.log('handleSelect called with node:', node);
    setSelectedId(node.id);
    if (node.type === 'file') {
      console.log('Node is a file, calling openFile');
      if (viewMode === 'terminal') {
        // For terminal workspace files, we need to fetch content differently
        try {
          const content = await terminalWorkspaceService.getFileContent(node.path);
          // Create a virtual file node with content for the editor
          const virtualNode = {
            ...node,
            content
          };
          await openFile(virtualNode);
        } catch (error) {
          console.error('Failed to open terminal workspace file:', error);
        }
      } else {
        await openFile(node);
      }
    } else {
      console.log('Node is not a file, type:', node.type);
    }
  }, [openFile, viewMode]);

  const handleNewFile = useCallback(async (parentNode: IDEFileNode) => {
    const newName = await fileSystemService.promptForNewFileName(parentNode.path);
    if (newName) {
      await createFile(parentNode, newName);
      refreshFileTree();
    }
  }, [createFile, refreshFileTree]);

  const handleNewFolder = useCallback(async (parentNode: IDEFileNode) => {
    const newName = await fileSystemService.promptForNewFolderName(parentNode.path);
    if (newName) {
      await createFolder(parentNode, newName);
      refreshFileTree();
    }
  }, [createFolder, refreshFileTree]);

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
    await refreshFileTree();
  }, [refreshFileTree]);

  const handleCopyPath = useCallback(async (node: IDEFileNode) => {
    await fileSystemService.copyPath(node.path);
  }, []);

  const handleCopyRelativePath = useCallback(async (node: IDEFileNode) => {
    await fileSystemService.copyRelativePath(node.path);
  }, []);

  const handleRevealInExplorer = useCallback(async (node: IDEFileNode) => {
    await fileSystemService.revealInExplorer(node.path);
  }, []);

  const handleOpenGitChanges = useCallback(async (node: IDEFileNode) => {
    await fileSystemService.openGitChanges(node.path);
  }, []);

  const handleDiscardChanges = useCallback(async (node: IDEFileNode) => {
    await fileSystemService.discardChanges(node.path);
  }, []);

  const handleCopy = useCallback(async (source: IDEFileNode, target: IDEFileNode) => {
    await fileSystemService.copyNode(source, target);
  }, []);

  const handleCut = useCallback(async (source: IDEFileNode, target: IDEFileNode) => {
    await fileSystemService.cutNode(source, target);
  }, []);

  const handlePaste = useCallback(async (target: IDEFileNode) => {
    await fileSystemService.pasteNode(target);
  }, []);

  const handleNewFileFromContext = useCallback((action: string, node: IDEFileNode) => {
    if (action === 'newFile') {
      handleNewFile(node);
    } else if (action === 'newFolder') {
      handleNewFolder(node);
    }
  }, [handleNewFile, handleNewFolder]);

  const handleContextAction = useCallback((action: string, node: IDEFileNode) => {
    if (action === 'rename') {
      setSelectedId(node.id); // Start renaming
    } else if (action === 'delete') {
      handleDelete(node);
    } else if (action === 'copyPath') {
      handleCopyPath(node);
    } else if (action === 'copyRelativePath') {
      handleCopyRelativePath(node);
    } else if (action === 'revealInExplorer') {
      handleRevealInExplorer(node);
    } else if (action === 'openGitChanges') {
      handleOpenGitChanges(node);
    } else if (action === 'discardChanges') {
      handleDiscardChanges(node);
    } else if (action === 'copy') {
      handleCopy(node, node); // Copy self
    } else if (action === 'cut') {
      handleCut(node, node); // Cut self
    } else if (action === 'paste') {
      handlePaste(node);
    }
  }, [handleDelete, handleCopyPath, handleCopyRelativePath, handleRevealInExplorer, handleOpenGitChanges, handleDiscardChanges, handleCopy, handleCut, handlePaste]);

  const handleRenameConfirm = useCallback((newName: string) => {
    if (selectedId) {
      const node = fileTree.find(f => f.id === selectedId);
      if (node) {
        handleRename(node, newName);
      }
    }
  }, [selectedId, fileTree, handleRename]);

  const handleRenameCancel = useCallback(() => {
    if (selectedId) {
      const node = fileTree.find(f => f.id === selectedId);
      if (node) {
        setSelectedId(node.id); // Revert to original name
      }
    }
  }, [selectedId, fileTree]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameConfirm(searchQuery); // Use searchQuery as newName for now
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  }, [handleRenameConfirm, handleRenameCancel, searchQuery]);

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

  const changeWorkingDirectory = () => {
    setShowFolderPicker(true);
  };

  const handleFolderSelect = async (folderPath: string) => {
    // ... (logic to call backend and refresh tree)
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <div className="section-title">
          <span className="title-text">EXPLORER</span>
        </div>
        <div className="header-actions">
          <button 
            className={`action-btn ${viewMode === 'universal' ? 'bg-green-600 text-white' : ''}`} 
            onClick={() => switchViewMode('universal')} 
            title="Local System Files"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button 
            className={`action-btn ${viewMode === 'terminal' ? 'bg-blue-600 text-white' : ''} ${!terminalWorkspaceService.isConnected() ? 'opacity-50' : ''}`} 
            onClick={() => switchViewMode('terminal')} 
            title="Terminal Workspace"
            disabled={!terminalWorkspaceService.isConnected()}
          >
            <Terminal className="w-4 h-4" />
          </button>
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
            onToggle={() => {}}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
            selectedId={selectedId}
                expandedNodes={expanded}
          />
        ))}
          </div>
        )}
      </div>
      <TreeFolderPicker
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelect}
        initialPath="/Users/spider_myan/Documents"
      />
    </div>
  );
};

export default FileExplorer;