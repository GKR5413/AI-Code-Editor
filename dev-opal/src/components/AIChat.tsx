import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  Copy,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  model?: string;
}

// Updated model definitions
const models = [
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Quota Exceeded)' },
  { value: 'llama3-8b-8192', label: 'Llama 3' },
];

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState(models[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scrolling effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // Direct connection to agent service
      const response = await fetch('/api/agent-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...messages.map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
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
      const currentModel = models.find(m => m.value === selectedModel);

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response,
        timestamp: new Date(),
        model: currentModel?.label,
      };

      setMessages((prev) => [...prev, aiResponse]);

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
  }, [inputValue, isLoading, selectedModel]);

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