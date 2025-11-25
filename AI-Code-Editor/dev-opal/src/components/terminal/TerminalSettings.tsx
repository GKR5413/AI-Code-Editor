/**
 * Terminal Settings Component
 * Settings panel for YOLO mode, command validation, and terminal behavior
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Shield, Settings as SettingsIcon, Terminal } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

interface TerminalSettingsProps {
  onClose: () => void;
}

export const TerminalSettings: React.FC<TerminalSettingsProps> = ({ onClose }) => {
  const { state, updateSettings } = useTerminal();
  const [localSettings, setLocalSettings] = useState(state.settings);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(state.settings);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-100">Terminal Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* YOLO Mode Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="text-base font-semibold text-gray-100">YOLO Mode</h3>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex-1">
                <Label className="text-sm font-medium text-gray-200">
                  Enable YOLO Mode
                </Label>
                <p className="text-xs text-gray-400 mt-1">
                  Auto-approve safe commands without confirmation
                </p>
              </div>
              <Switch
                checked={localSettings.yoloMode}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, yoloMode: checked })
                }
              />
            </div>

            {localSettings.yoloMode && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400">
                  ⚠️ Warning: YOLO mode will automatically execute safe commands without
                  asking for confirmation. Dangerous commands will still require approval.
                </p>
              </div>
            )}
          </div>

          {/* Terminal Behavior */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-green-400" />
              <h3 className="text-base font-semibold text-gray-100">
                Terminal Behavior
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-gray-200">
                    Auto-spawn Terminals
                  </Label>
                  <p className="text-xs text-gray-400 mt-1">
                    Automatically create terminals when agents request commands
                  </p>
                </div>
                <Switch
                  checked={localSettings.autoSpawn}
                  onCheckedChange={(checked) =>
                    setLocalSettings({ ...localSettings, autoSpawn: checked })
                  }
                />
              </div>

              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                <Label className="text-sm font-medium text-gray-200">
                  Max Concurrent Terminals
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={localSettings.maxConcurrentTerminals}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      maxConcurrentTerminals: parseInt(e.target.value) || 5,
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  Maximum number of terminal windows that can run simultaneously
                </p>
              </div>

              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
                <Label className="text-sm font-medium text-gray-200">
                  Command Timeout (ms)
                </Label>
                <Input
                  type="number"
                  min={5000}
                  max={600000}
                  step={5000}
                  value={localSettings.commandTimeout}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      commandTimeout: parseInt(e.target.value) || 300000,
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  Maximum time to wait for command completion (default: 300000ms = 5 min)
                </p>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-gray-100">
                Security & Validation
              </h3>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
              <Label className="text-sm font-medium text-gray-200">
                Safe Commands (Whitelist)
              </Label>
              <textarea
                value={localSettings.safeCommands.join(', ')}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    safeCommands: e.target.value
                      .split(',')
                      .map((cmd) => cmd.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 font-mono resize-none"
                placeholder="npm, git, ls, pwd..."
              />
              <p className="text-xs text-gray-400">
                Commands that can run automatically in YOLO mode (comma-separated)
              </p>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
              <Label className="text-sm font-medium text-gray-200">
                Dangerous Commands (Blacklist)
              </Label>
              <textarea
                value={localSettings.dangerousCommands.join(', ')}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    dangerousCommands: e.target.value
                      .split(',')
                      .map((cmd) => cmd.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full h-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 font-mono resize-none"
                placeholder="rm, sudo, chmod..."
              />
              <p className="text-xs text-gray-400">
                Commands that always require manual approval (comma-separated)
              </p>
            </div>

            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 space-y-3">
              <Label className="text-sm font-medium text-gray-200">
                Allowed Workspaces
              </Label>
              <textarea
                value={localSettings.allowedWorkspaces.join(', ')}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    allowedWorkspaces: e.target.value
                      .split(',')
                      .map((path) => path.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full h-20 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 font-mono resize-none"
                placeholder="/workspace, /app/workspace, /projects"
              />
              <p className="text-xs text-gray-400">
                Paths where commands can be executed (comma-separated)
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h4 className="text-sm font-medium text-gray-200 mb-3">
              Current Statistics
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {state.terminals.length}
                </div>
                <div className="text-xs text-gray-400">Active Terminals</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  {state.commandQueue.length}
                </div>
                <div className="text-xs text-gray-400">Queued Commands</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {state.terminals.filter((t) => t.state === 'completed').length}
                </div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </motion.div>
    </motion.div>
  );
};
