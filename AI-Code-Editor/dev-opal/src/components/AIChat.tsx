import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  Copy,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgentTerminal } from '@/hooks/useAgentTerminal';

interface TerminalOutput {
  command: string;
  output: string;
  exitCode?: number;
  isRunning: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  model?: string;
  terminalOutputs?: TerminalOutput[];
}

// Updated model definitions with latest Groq and Claude models (Nov 2025)
const models = [
  // Gemini models (Google AI)
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview)', provider: 'gemini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' },

  // Groq/Llama 4 models (Latest - April 2025)
  { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick (17B)', provider: 'groq' },
  { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (17B)', provider: 'groq' },

  // Groq/Llama 3.3 models (Current generation)
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', provider: 'groq' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', provider: 'groq' },

  // Claude 4 models (Latest - 2025)
  { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'claude' },
  { value: 'claude-opus-4.1', label: 'Claude Opus 4.1', provider: 'claude' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Latest)', provider: 'claude' },
  { value: 'claude-opus-4', label: 'Claude Opus 4', provider: 'claude' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'claude' },

  // Claude 3.5 models
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'claude' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'claude' },
];

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(models[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [commandsDetected, setCommandsDetected] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize agent terminal integration
  const { processAgentResponse, isAutoSpawnEnabled } = useAgentTerminal({
    agentId: `ai-chat-${selectedModel}`,
    autoSpawn: true,
    onCommandDetected: (commands) => {
      console.log('🔔 Terminal commands detected:', commands);
      setCommandsDetected(commands);
    },
  });

  // Auto-scrolling effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract commands from backticks and execute them inline
  const executeInlineCommands = useCallback(async (message: ChatMessage) => {
    const commandRegex = /`([^`]+)`/g;
    const commands: string[] = [];
    let match;

    while ((match = commandRegex.exec(message.content)) !== null) {
      commands.push(match[1]);
    }

    if (commands.length === 0) return;

    // Execute each command and update the message with terminal outputs
    const terminalOutputs: TerminalOutput[] = [];

    for (const command of commands) {
      const terminalOutput: TerminalOutput = {
        command,
        output: '',
        isRunning: true,
      };
      terminalOutputs.push(terminalOutput);

      // Update message to show running status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, terminalOutputs: [...terminalOutputs] } : msg
        )
      );

      // Execute command via enhanced terminal server
      try {
        const response = await fetch('http://localhost:3001/api/terminal/compiler-execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: `inline-${message.id}`,
            command: command,
            timeout: 15000,
          }),
        });

        const result = await response.json();
        terminalOutput.output = result.output || result.error || 'No output';
        terminalOutput.exitCode = result.exitCode;
        terminalOutput.isRunning = false;

        // Update message with command output
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? { ...msg, terminalOutputs: [...terminalOutputs] } : msg
          )
        );
      } catch (error) {
        terminalOutput.output = `Error: ${error}`;
        terminalOutput.isRunning = false;
        terminalOutput.exitCode = 1;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === message.id ? { ...msg, terminalOutputs: [...terminalOutputs] } : msg
          )
        );
      }
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('🔍 Attempting to connect to agent service...');

      // Determine provider from selected model
      const currentModel = models.find(m => m.value === selectedModel);
      const provider = currentModel?.provider || 'groq';

      // Build conversation history including terminal outputs for agentic behavior
      const conversationHistory = messages.map(msg => {
        let content = msg.content;

        // Include terminal outputs in the message content for AI to see results
        if (msg.terminalOutputs && msg.terminalOutputs.length > 0) {
          content += '\n\n[Terminal Execution Results]:';
          msg.terminalOutputs.forEach((term, idx) => {
            content += `\n\nCommand #${idx + 1}: ${term.command}`;
            if (term.output) {
              content += `\nOutput:\n${term.output}`;
            }
            if (term.exitCode !== undefined) {
              content += `\nExit Code: ${term.exitCode} ${term.exitCode === 0 ? '(Success)' : '(Failed)'}`;
            }
          });
        }

        return {
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: content
        };
      });

      // Direct connection to agent service
      const response = await fetch('/api/agent-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: provider,
          model: selectedModel,
          messages: [
            ...conversationHistory,
            { role: 'user', content: inputValue }
          ]
        }),
      });

      console.log('✅ Response received:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Response data:', data);

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        model: currentModel?.label,
      };

      setMessages((prev) => [...prev, aiResponse]);

      // Extract and execute commands inline
      await executeInlineCommands(aiResponse);

    } catch (error) {
      console.error("Failed to send message to agent:", error);
      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error trying to connect to the agent service.',
        timestamp: new Date(),
        model: 'Error'
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, selectedModel, messages, processAgentResponse]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="ai-chat-panel flex flex-col h-full">
      <div className="chat-header">
        <div className="chat-title">
          <Sparkles className="w-5 h-5" />
          <span>AI Assistant</span>
        </div>
        <div className="chat-controls">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="model-selector h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.value} value={model.value} className="py-2">
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={clearConversation} title="Clear">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="messages-container flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`message flex items-start gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}>
            {message.type === 'ai' && <Bot className="w-5 h-5 mt-1 flex-shrink-0" />}
            <div className={`message-content rounded-lg px-3 py-2 max-w-lg ${message.type === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600'}`}>
              <p className="text-sm whitespace-pre-wrap break-words font-medium">{message.content}</p>

              {/* Terminal outputs inline */}
              {message.terminalOutputs && message.terminalOutputs.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.terminalOutputs.map((terminal, idx) => (
                    <div key={idx} className="bg-black text-green-400 p-2 rounded font-mono text-xs">
                      <div className="flex items-center gap-2 mb-1 text-gray-400">
                        <Terminal className="w-3 h-3" />
                        <span>$ {terminal.command}</span>
                        {terminal.isRunning && <span className="animate-pulse">Running...</span>}
                      </div>
                      {terminal.output && (
                        <pre className="whitespace-pre-wrap text-xs overflow-x-auto">{terminal.output}</pre>
                      )}
                      {!terminal.isRunning && terminal.exitCode !== undefined && (
                        <div className={`text-xs mt-1 ${terminal.exitCode === 0 ? 'text-green-500' : 'text-red-500'}`}>
                          Exit code: {terminal.exitCode}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="message-actions text-xs mt-1 opacity-80 flex items-center gap-2">
                <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {message.model && <span className='font-semibold'>{message.model}</span>}
                {message.type === 'ai' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyMessage(message.content)} title="Copy">
                    <Copy className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {message.type === 'user' && <User className="w-5 h-5 mt-1 flex-shrink-0" />}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container p-2 border-t">
        <div className="input-wrapper relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask anything..."
            className="chat-input w-full p-2 pr-12 rounded-md resize-none border"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="send-button absolute right-2 top-1/2 -translate-y-1/2"
            size="icon"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
export default AIChat;