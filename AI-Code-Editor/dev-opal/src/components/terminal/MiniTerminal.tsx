/**
 * MiniTerminal Component
 * Draggable, resizable mini-terminal window for agentic command execution
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { motion, PanInfo } from 'framer-motion';
import {
  X,
  Minus,
  Square,
  Play,
  Square as StopSquare,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { TerminalInstance, DARK_TERMINAL_THEME } from './types';
import { useTerminal } from '../../contexts/TerminalContext';

interface MiniTerminalProps {
  terminal: TerminalInstance;
}

export const MiniTerminal: React.FC<MiniTerminalProps> = ({ terminal }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localPosition, setLocalPosition] = useState(terminal.position);
  const [localSize, setLocalSize] = useState(terminal.size);

  const {
    updateTerminal,
    removeTerminal,
    minimizeTerminal,
    maximizeTerminal,
    restoreTerminal,
    bringToFront,
    killCommand,
  } = useTerminal();

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      convertEol: true,
      fontFamily: `'Fira Code', 'Courier New', monospace`,
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: DARK_TERMINAL_THEME,
      scrollback: 1000,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Fit terminal to container
    setTimeout(() => fitAddon.fit(), 10);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Write initial content
    term.write('\x1b[1;36m✨ Agentic Terminal\x1b[0m\r\n');
    if (terminal.command) {
      term.write(`\x1b[1;33m❯\x1b[0m ${terminal.command.command}\r\n`);
      if (terminal.command.reasoning) {
        term.write(`\x1b[2m💭 ${terminal.command.reasoning}\x1b[0m\r\n`);
      }
      term.write('\r\n');
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (!isResizing) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      term.dispose();
      resizeObserver.disconnect();
    };
  }, [terminal.command, isResizing]);

  // Write output to terminal
  useEffect(() => {
    if (!xtermRef.current) return;

    const term = xtermRef.current;
    const lastOutput = terminal.output[terminal.output.length - 1];

    if (lastOutput) {
      term.write(lastOutput.data);
    }
  }, [terminal.output]);

  // Handle drag
  const handleDragEnd = useCallback(
    (_event: any, info: PanInfo) => {
      const newPosition = {
        x: localPosition.x + info.offset.x,
        y: localPosition.y + info.offset.y,
      };

      // Keep within viewport
      const maxX = window.innerWidth - localSize.width;
      const maxY = window.innerHeight - localSize.height;

      newPosition.x = Math.max(0, Math.min(newPosition.x, maxX));
      newPosition.y = Math.max(0, Math.min(newPosition.y, maxY));

      setLocalPosition(newPosition);
      updateTerminal(terminal.id, { position: newPosition });
      setIsDragging(false);
    },
    [terminal.id, localPosition, localSize, updateTerminal]
  );

  // Handle resize
  const handleResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = localSize.width;
      const startHeight = localSize.height;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newWidth = Math.max(400, startWidth + deltaX);
        const newHeight = Math.max(300, startHeight + deltaY);

        setLocalSize({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        updateTerminal(terminal.id, { size: localSize });
        fitAddonRef.current?.fit();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [terminal.id, localSize, updateTerminal]
  );

  // Get status icon and color
  const getStatusInfo = () => {
    switch (terminal.state) {
      case 'idle':
        return { icon: AlertCircle, color: 'text-gray-400', label: 'Idle' };
      case 'pending_approval':
        return { icon: AlertCircle, color: 'text-yellow-400', label: 'Pending Approval' };
      case 'running':
        return { icon: Loader2, color: 'text-blue-400', label: 'Running', spin: true };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', label: 'Completed' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', label: 'Failed' };
      case 'killed':
        return { icon: StopSquare, color: 'text-orange-400', label: 'Killed' };
      default:
        return { icon: AlertCircle, color: 'text-gray-400', label: 'Unknown' };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Don't render if minimized
  if (terminal.isMinimized) {
    return null;
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        setIsDragging(true);
        bringToFront(terminal.id);
      }}
      onDragEnd={handleDragEnd}
      dragConstraints={{
        left: 0,
        top: 0,
        right: window.innerWidth - localSize.width,
        bottom: window.innerHeight - localSize.height,
      }}
      style={{
        position: 'fixed',
        left: localPosition.x,
        top: localPosition.y,
        width: terminal.isMaximized ? '100vw' : localSize.width,
        height: terminal.isMaximized ? '100vh' : localSize.height,
        zIndex: terminal.zIndex,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
      onClick={() => bringToFront(terminal.id)}
    >
      {/* Title Bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-move ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={() => bringToFront(terminal.id)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StatusIcon
            className={`w-4 h-4 ${statusInfo.color} ${statusInfo.spin ? 'animate-spin' : ''}`}
          />
          <span className="text-xs font-medium text-gray-300 truncate">
            {terminal.title}
          </span>
          <span className="text-xs text-gray-500">({statusInfo.label})</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Kill button (only when running) */}
          {terminal.state === 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                killCommand(terminal.id);
              }}
              className="p-1.5 hover:bg-red-600 rounded transition-colors"
              title="Kill command"
            >
              <StopSquare className="w-3.5 h-3.5 text-gray-300" />
            </button>
          )}

          {/* Minimize */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              minimizeTerminal(terminal.id);
            }}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 text-gray-300" />
          </button>

          {/* Maximize/Restore */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              terminal.isMaximized
                ? restoreTerminal(terminal.id)
                : maximizeTerminal(terminal.id);
            }}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title={terminal.isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square className="w-3.5 h-3.5 text-gray-300" />
          </button>

          {/* Close */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTerminal(terminal.id);
            }}
            className="p-1.5 hover:bg-red-600 rounded transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={terminalRef} className="absolute inset-0 p-2" />
      </div>

      {/* Resize Handle */}
      {!terminal.isMaximized && (
        <div
          onMouseDown={handleResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{
            background:
              'linear-gradient(135deg, transparent 50%, rgba(156, 163, 175, 0.5) 50%)',
          }}
        />
      )}

      {/* Execution Time Footer */}
      {(terminal.state === 'completed' || terminal.state === 'failed') && terminal.endTime && (
        <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex justify-between items-center">
          <span>
            Duration:{' '}
            {Math.round(
              (terminal.endTime.getTime() - terminal.startTime.getTime()) / 1000
            )}
            s
          </span>
          {terminal.exitCode !== undefined && (
            <span>Exit code: {terminal.exitCode}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
