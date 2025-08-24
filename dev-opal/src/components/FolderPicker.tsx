import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  X, 
  Check, 
  ArrowLeft,
  Home,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FolderItem {
  name: string;
  path: string;
  fullPath: string;
  type: 'folder';
}

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderPath: string) => void;
  initialPath?: string;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '~');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  const loadFolders = async (path: string) => {
    console.log(`🔍 Loading folders for path: ${path}`);
    setLoading(true);
    try {
      const url = `http://localhost:3004/api/browse?path=${encodeURIComponent(path)}`;
      console.log(`📡 Fetching: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Loaded ${data.directories.length} folders:`, data.directories.map(d => d.name));
        setCurrentPath(data.currentPath);
        setFolders(data.directories);
        setSelectedFolder(data.currentPath);
      } else {
        console.error('❌ Failed to load folders - Response not OK:', response.status, response.statusText);
        alert('Failed to load folders');
      }
    } catch (error) {
      console.error('❌ Error loading folders:', error);
      alert('Error loading folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFolders(currentPath);
    }
  }, [isOpen, currentPath]);

  const handleFolderClick = (folder: FolderItem) => {
    console.log(`🖱️ Single click on folder: ${folder.name} -> ${folder.path}`);
    
    // Clear any existing timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }
    
    // For parent directory (..), navigate immediately
    if (folder.name === '..') {
      console.log('⬆️ Going up to parent directory');
      loadFolders(folder.path);
      return;
    }
    
    // For regular folders, just select them (no timeout needed)
    console.log(`✅ Selecting folder: ${folder.name}`);
    setSelectedFolder(folder.path);
  };

  const handleFolderDoubleClick = (folder: FolderItem) => {
    console.log(`🖱️🖱️ Double click on folder: ${folder.name} -> ${folder.path}`);
    
    // Clear the single-click timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
    }
    
    // Navigate into the folder
    console.log(`🚪 Navigating into folder: ${folder.name}`);
    loadFolders(folder.path);
  };

  const handleNavigateInto = (folder: FolderItem) => {
    console.log(`🎯 Navigate button clicked for: ${folder.name} -> ${folder.path}`);
    loadFolders(folder.path);
  };

  const handleSelect = () => {
    onSelect(selectedFolder);
    onClose();
  };

  const goHome = () => {
    loadFolders('~');
  };

  const goUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFolders(parentPath);
  };

  const handleKeyDown = (event: React.KeyboardEvent, folder: FolderItem) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleFolderDoubleClick(folder);
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
              Single-click to select • Click "Enter →" or double-click to navigate into folder
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
            <button
              onClick={() => {
                console.log('🧪 TEST: Trying to navigate to AI-IDE');
                loadFolders('/Users/spider_myan/Documents/AI-IDE');
              }}
              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
              title="Test Navigate to AI-IDE"
            >
              TEST
            </button>
          </div>
          
          {/* Path Breadcrumb */}
          <div className="flex-1 min-w-0">
            <div className="px-3 py-2 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#3c3c3c] rounded-md">
              <div className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate" title={currentPath}>
                {currentPath}
              </div>
            </div>
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#1e1e1e]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
              <div className="text-sm">Loading folders...</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#3c3c3c]">
              {folders.map((folder, index) => (
                <div
                  key={index}
                  className={`group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2a2d2e] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
                    selectedFolder === folder.path 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
                      : ''
                  }`}
                  onClick={() => handleFolderClick(folder)}
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                  onKeyDown={(e) => handleKeyDown(e, folder)}
                  tabIndex={0}
                  role="button"
                  aria-label={folder.name === '..' ? 'Go to parent directory' : `Select or navigate into ${folder.name}`}
                >
                  {/* Folder Icon */}
                  <div className="flex-shrink-0">
                    {folder.name === '..' ? (
                      <div className="p-1 rounded bg-gray-100 dark:bg-[#37373d]">
                        <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                    ) : (
                      <Folder className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    )}
                  </div>
                  
                  {/* Folder Name */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      selectedFolder === folder.path
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {folder.name}
                    </div>
                    {folder.name !== '..' && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                        {folder.path}
                      </div>
                    )}
                  </div>
                  
                  {/* Navigation Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {folder.name !== '..' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateInto(folder);
                        }}
                        className="opacity-60 group-hover:opacity-100 transition-opacity px-2 py-1 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400"
                        title="Navigate into this folder"
                      >
                        Enter →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {folders.length === 0 && !loading && (
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