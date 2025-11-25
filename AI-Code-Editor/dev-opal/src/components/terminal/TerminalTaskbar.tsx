/**
 * Terminal Taskbar Component
 * Shows minimized terminals in a taskbar-style view at the bottom of the screen
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal as TerminalIcon,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Square as StopSquare,
  X,
} from 'lucide-react';
import { TerminalInstance } from './types';
import { useTerminal } from '../../contexts/TerminalContext';

export const TerminalTaskbar: React.FC = () => {
  const { state, restoreTerminal, removeTerminal, bringToFront } = useTerminal();

  // Filter minimized terminals
  const minimizedTerminals = state.terminals.filter((t) => t.isMinimized);

  if (minimizedTerminals.length === 0) {
    return null;
  }

  const getStatusIcon = (terminal: TerminalInstance) => {
    switch (terminal.state) {
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-400" />;
      case 'killed':
        return <StopSquare className="w-3 h-3 text-orange-400" />;
      case 'pending_approval':
        return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-4 py-2"
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap">
          <TerminalIcon className="w-4 h-4" />
          <span className="font-medium">Terminals ({minimizedTerminals.length})</span>
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          <AnimatePresence mode="popLayout">
            {minimizedTerminals.map((terminal) => (
              <motion.button
                key={terminal.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  restoreTerminal(terminal.id);
                  bringToFront(terminal.id);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors group"
              >
                {getStatusIcon(terminal)}
                <span className="text-xs text-gray-300 max-w-[150px] truncate">
                  {terminal.title}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminal(terminal.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                >
                  <X className="w-3 h-3 text-gray-400 hover:text-red-400" />
                </button>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {minimizedTerminals.length > 3 && (
          <div className="text-xs text-gray-500 whitespace-nowrap">
            +{minimizedTerminals.length - 3} more
          </div>
        )}
      </div>
    </motion.div>
  );
};
