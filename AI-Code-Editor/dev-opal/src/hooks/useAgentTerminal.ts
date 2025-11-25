/**
 * useAgentTerminal Hook
 * Detects terminal commands in agent responses and auto-spawns terminals
 */

import { useCallback, useEffect, useRef } from 'react';
import { useTerminal } from '../contexts/TerminalContext';
import { AgentTerminalRequest } from '../components/terminal/types';
import { commandValidationService } from '../services/terminal/CommandValidationService';

interface UseAgentTerminalOptions {
  agentId: string;
  autoSpawn?: boolean;
  onCommandDetected?: (commands: string[]) => void;
}

export function useAgentTerminal(options: UseAgentTerminalOptions) {
  const { agentId, autoSpawn = true, onCommandDetected } = options;
  const { executeAgentRequest, state } = useTerminal();
  const processedMessages = useRef<Set<string>>(new Set());

  /**
   * Process agent response and spawn terminals if commands detected
   */
  const processAgentResponse = useCallback(
    async (responseText: string, messageId?: string) => {
      // Skip if already processed
      if (messageId && processedMessages.current.has(messageId)) {
        return;
      }

      // Mark as processed
      if (messageId) {
        processedMessages.current.add(messageId);
      }

      // Parse commands from response
      const parsedCommands =
        commandValidationService.parseCommandsFromText(responseText);

      if (parsedCommands.length === 0) {
        return;
      }

      console.log(`🤖 Agent ${agentId} wants to run ${parsedCommands.length} command(s):`);
      parsedCommands.forEach((cmd) => {
        console.log(`  - ${cmd.command}`);
      });

      // Notify callback
      onCommandDetected?.(parsedCommands.map((cmd) => cmd.command));

      // Auto-spawn if enabled
      if (autoSpawn && state.settings.autoSpawn) {
        const request: AgentTerminalRequest = {
          type: 'terminal_request',
          agentId,
          reasoning: 'Agent requested command execution',
          commands: parsedCommands.map((cmd) => ({
            command: cmd.command,
            workingDir: cmd.workingDir || '/workspace',
            expectation: undefined,
          })),
          requiresApproval: false, // Will be determined by command validation
          sequential: false, // Run in parallel
        };

        try {
          await executeAgentRequest(request);
          console.log('✅ Terminal(s) spawned successfully');
        } catch (error) {
          console.error('❌ Failed to spawn terminal:', error);
        }
      }
    },
    [agentId, autoSpawn, state.settings.autoSpawn, executeAgentRequest, onCommandDetected]
  );

  /**
   * Manually trigger terminal execution for specific commands
   */
  const executeCommands = useCallback(
    async (
      commands: string[],
      options?: {
        reasoning?: string;
        sequential?: boolean;
        requiresApproval?: boolean;
      }
    ) => {
      if (commands.length === 0) return;

      const request: AgentTerminalRequest = {
        type: 'terminal_request',
        agentId,
        reasoning: options?.reasoning || 'Manual command execution',
        commands: commands.map((cmd) => ({
          command: cmd,
          workingDir: '/workspace',
          expectation: undefined,
        })),
        requiresApproval: options?.requiresApproval || false,
        sequential: options?.sequential || false,
      };

      await executeAgentRequest(request);
    },
    [agentId, executeAgentRequest]
  );

  /**
   * Clear processed messages cache
   */
  const clearCache = useCallback(() => {
    processedMessages.current.clear();
  }, []);

  return {
    processAgentResponse,
    executeCommands,
    clearCache,
    isAutoSpawnEnabled: state.settings.autoSpawn,
  };
}
