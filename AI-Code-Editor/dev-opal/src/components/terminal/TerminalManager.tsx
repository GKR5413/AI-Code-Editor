/**
 * Terminal Manager Component
 * Main component that manages all terminal instances and provides keyboard shortcuts
 */

import React, { useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MiniTerminal } from './MiniTerminal';
import { TerminalTaskbar } from './TerminalTaskbar';
import { TerminalSettings as TerminalSettingsComponent } from './TerminalSettings';
import { useTerminal } from '../../contexts/TerminalContext';

export const TerminalManager: React.FC = () => {
  const { state, closeAllTerminals, minimizeTerminal, getActiveTerminal } = useTerminal();
  const [showSettings, setShowSettings] = React.useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+` or Cmd+` - Toggle active terminal minimize
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '`' || e.key === '~') {
          e.preventDefault();
          const activeTerminal = getActiveTerminal();
          if (activeTerminal) {
            if (activeTerminal.isMinimized) {
              // Restore first minimized terminal
              const minimized = state.terminals.find((t) => t.isMinimized);
              if (minimized) {
                minimizeTerminal(minimized.id);
              }
            } else {
              minimizeTerminal(activeTerminal.id);
            }
          }
        }

        // Ctrl+Shift+T - Show settings
        if (e.shiftKey && e.key === 'T') {
          e.preventDefault();
          setShowSettings((prev) => !prev);
        }

        // Ctrl+Shift+W - Close all terminals
        if (e.shiftKey && e.key === 'W') {
          e.preventDefault();
          if (window.confirm('Close all terminals?')) {
            closeAllTerminals();
          }
        }
      }

      // ESC - Close settings or minimize active terminal
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else {
          const activeTerminal = getActiveTerminal();
          if (activeTerminal && !activeTerminal.isMinimized) {
            minimizeTerminal(activeTerminal.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.terminals,
    closeAllTerminals,
    minimizeTerminal,
    getActiveTerminal,
    showSettings,
  ]);

  // Filter visible (non-minimized) terminals
  const visibleTerminals = state.terminals.filter((t) => !t.isMinimized);

  return (
    <>
      {/* Terminal Windows */}
      <AnimatePresence mode="sync">
        {visibleTerminals.map((terminal) => (
          <MiniTerminal key={terminal.id} terminal={terminal} />
        ))}
      </AnimatePresence>

      {/* Taskbar for Minimized Terminals */}
      <AnimatePresence>
        <TerminalTaskbar />
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <TerminalSettingsComponent onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Help (hidden, for documentation) */}
      <div className="hidden">
        <div>Ctrl+` / Cmd+` - Toggle terminal minimize</div>
        <div>Ctrl+Shift+T / Cmd+Shift+T - Settings</div>
        <div>Ctrl+Shift+W / Cmd+Shift+W - Close all</div>
        <div>ESC - Minimize active terminal or close settings</div>
      </div>
    </>
  );
};
