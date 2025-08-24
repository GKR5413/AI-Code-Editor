import React from 'react';
import { 
  Save, 
  Search, 
  GitBranch, 
  Settings, 
  Sun, 
  Moon,
  Code2,
  Command,
  ChevronDown,
  FolderOpen,
  SaveAll,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { useIDE } from '@/contexts/IDEContext';

export const TopBar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { 
    activeTab, 
    saveAll, 
    pickAndOpenFile, 
    saveActiveToDisk, 
    createFile,
    triggerEditorAction
  } = useIDE();

  return (
    <header className="h-12 ide-panel border-b border-ide-panel-border flex items-center">
      {/* Left Section - Logo & Menu */}
      <div className="flex items-center gap-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-md-primary to-md-accent rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <h1 className="md-title-medium text-md-primary font-semibold">VelocIDE</h1>
        </div>
        
        <nav className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
                File
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuItem onClick={() => createFile()}>New File</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={pickAndOpenFile}>Open File…</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveActiveToDisk} disabled={!activeTab}>Save</DropdownMenuItem>
              <DropdownMenuItem onClick={saveAll}>Save All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
                Edit
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64">
              <DropdownMenuItem onClick={() => triggerEditorAction('editor.action.undo')}>Undo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerEditorAction('editor.action.redo')}>Redo</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => triggerEditorAction('editor.action.clipboardCutAction')}>Cut</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerEditorAction('editor.action.clipboardCopyAction')}>Copy</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerEditorAction('editor.action.clipboardPasteAction')}>Paste</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
            View
          </Button>
          <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
            Terminal
          </Button>
          <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
            Help
          </Button>
        </nav>
      </div>

      {/* Center Section - Breadcrumbs & Search */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-md-on-surface-variant">
          {activeTab ? (
            <>
              {activeTab.path.split('/').map((seg, idx, arr) => (
                <span key={idx} className={idx === arr.length - 1 ? 'text-md-on-surface font-medium' : ''}>
                  {idx > 0 && <span className="mx-1">/</span>}
                  {seg}
                </span>
              ))}
            </>
          ) : (
            <span className="text-md-on-surface-variant">No file selected</span>
          )}
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2 px-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-md-on-surface-variant hover:text-md-on-surface"
          title="Search everywhere (Ctrl+Shift+P)"
        >
          <Command size={16} />
        </Button>
        
        <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface" onClick={pickAndOpenFile} title="Open File">
          <FolderOpen size={16} />
        </Button>
        
        <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface" onClick={saveActiveToDisk} title="Save">
          <Search size={16} />
        </Button>
        
        <div className="w-px h-6 bg-ide-panel-border mx-1" />
        
        <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
          <GitBranch size={16} />
          <span className="ml-1 text-sm">main</span>
          <ChevronDown size={12} className="ml-1" />
        </Button>
        
        <Button variant="outline" size="sm" className="text-md-primary border-md-primary hover:bg-md-primary-container" onClick={saveAll} title="Save All">
          <SaveAll size={14} className="mr-1" />
          Save all
        </Button>
        
        <div className="w-px h-6 bg-ide-panel-border mx-1" />
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-md-on-surface-variant hover:text-md-on-surface"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </Button>
        
        <Button variant="ghost" size="sm" className="text-md-on-surface-variant hover:text-md-on-surface">
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
};

export default TopBar;