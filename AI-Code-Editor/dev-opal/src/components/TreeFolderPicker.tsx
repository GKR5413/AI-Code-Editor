import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  X, 
  Check, 
  ArrowLeft,
  Home,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TreeNode {
  name: string;
  path: string;
  fullPath: string;
  type: 'folder';
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface TreeFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderPath: string) => void;
  initialPath?: string;
}

export const TreeFolderPicker: React.FC<TreeFolderPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath
}) => {
  const [rootPath, setRootPath] = useState(initialPath || '~');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadChildren = async (path: string): Promise<TreeNode[]> => {
    try {
      console.log(`🔍 Loading children for: ${path}`);
      const response = await fetch(`http://localhost:3004/api/browse?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded ${data.directories.length} folders for ${path}`);
        return data.directories
          .filter((item: any) => item.name !== '..')
          .map((item: any) => ({
            name: item.name,
            path: item.path,
            fullPath: item.fullPath,
            type: 'folder' as const,
            children: [],
            isExpanded: false,
            isLoading: false
          }));
      }
      return [];
    } catch (error) {
      console.error('❌ Error loading children:', error);
      return [];
    }
  };

  const loadInitialTree = async () => {
    setLoading(true);
    const children = await loadChildren(rootPath);
    setTree(children);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialTree();
    }
  }, [isOpen, rootPath]);

  const toggleExpand = async (targetPath: string) => {
    console.log(`🎯 Toggle expand for: ${targetPath}`);
    
    const updateTree = async (nodes: TreeNode[]): Promise<TreeNode[]> => {
      const newNodes = [];
      
      for (const node of nodes) {
        if (node.path === targetPath) {
          if (!node.isExpanded && (!node.children || node.children.length === 0)) {
            // Load children first
            console.log(`📂 Loading children for: ${node.name}`);
            const children = await loadChildren(node.path);
            newNodes.push({
              ...node,
              children,
              isExpanded: true,
              isLoading: false
            });
          } else {
            // Just toggle expansion
            newNodes.push({
              ...node,
              isExpanded: !node.isExpanded
            });
          }
        } else {
          // Update children recursively
          const updatedChildren = node.children ? await updateTree(node.children) : [];
          newNodes.push({
            ...node,
            children: updatedChildren
          });
        }
      }
      
      return newNodes;
    };

    const newTree = await updateTree(tree);
    setTree(newTree);
  };

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const indent = level * 20;
    
    return (
      <div key={node.path}>
        <div 
          className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#2a2d2e] cursor-pointer ${
            selectedFolder === node.path 
              ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
              : ''
          }`}
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => {
            console.log(`📁 Selected folder: ${node.name}`);
            setSelectedFolder(node.path);
          }}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.path);
            }}
            className="p-1 hover:bg-gray-200 dark:hover:bg-[#37373d] rounded"
          >
            {node.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>

          {/* Folder Icon */}
          {node.isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          ) : (
            <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          )}

          {/* Folder Name */}
          <span className={`text-sm ${
            selectedFolder === node.path
              ? 'text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-900 dark:text-gray-100'
          }`}>
            {node.name}
          </span>

          {node.isLoading && (
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></div>
          )}
        </div>

        {/* Children */}
        {node.isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const goHome = () => {
    setRootPath('~');
  };

  const goUp = () => {
    const parentPath = rootPath.split('/').slice(0, -1).join('/') || '/';
    setRootPath(parentPath);
  };

  const handleSelect = () => {
    if (selectedFolder) {
      console.log(`✅ Final selection: ${selectedFolder}`);
      onSelect(selectedFolder);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#1e1e1e] border dark:border-[#3c3c3c] rounded-lg shadow-2xl w-[700px] h-[600px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-[#252526] border-b border-gray-200 dark:border-[#3c3c3c]">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Folder</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Click ▶ to expand folders • Click folder name to select
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-[#37373d] rounded-md transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#2d2d30] border-b border-gray-200 dark:border-[#3c3c3c]">
          <div className="flex items-center gap-1">
            <button
              onClick={goHome}
              className="p-2 hover:bg-gray-100 dark:hover:bg-[#37373d] rounded-md transition-colors"
              title="Home Directory"
            >
              <Home className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={goUp}
              className="p-2 hover:bg-gray-100 dark:hover:bg-[#37373d] rounded-md transition-colors"
              title="Parent Directory"
            >
              <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
          
          {/* Root Path Display */}
          <div className="flex-1 min-w-0">
            <div className="px-3 py-2 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#3c3c3c] rounded-md">
              <div className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate" title={rootPath}>
                Root: {rootPath}
              </div>
            </div>
          </div>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#1e1e1e]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
              <div className="text-sm">Loading folders...</div>
            </div>
          ) : (
            <div className="py-2">
              {tree.map(node => renderTreeNode(node))}
              {tree.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                  <Folder className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
                  <div className="text-sm font-medium">No folders found</div>
                  <div className="text-xs mt-1">This directory appears to be empty</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-[#252526] border-t border-gray-200 dark:border-[#3c3c3c]">
          {/* Selected Path Display */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
              Selected:
            </span>
            <div className="flex-1 min-w-0">
              <div className="px-2 py-1 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#3c3c3c] rounded text-xs font-mono text-gray-900 dark:text-gray-100 truncate">
                {selectedFolder || 'No folder selected'}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="px-6 py-2 border-gray-300 dark:border-[#3c3c3c] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#37373d]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSelect}
              disabled={!selectedFolder}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium shadow-sm"
            >
              <Check className="w-4 h-4 mr-2" />
              Select Folder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};