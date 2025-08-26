import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Copy, 
  RefreshCw, 
  Settings, 
  ChevronDown,
  Sparkles,
  MessageSquare,
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

const models = [
  // Keep exact IDs for backend; custom labels for UI
  { value: 'gemini-1.5-flash', label: 'gemini 2.5', description: 'Fast Gemini model' },
  { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro', description: 'Advanced Gemini 1.5 model' },
  { value: 'llama3-8b-8192', label: 'llama3-8b-8192', description: 'Groq LLaMA 3 (8B, 8k)' },
];

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  }, []);

  // Scroll on new messages or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Initial scroll on mount
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

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
      // Route via Vite proxy to avoid CORS (configured as /agent -> http://localhost:6000)
      const response = await fetch('/agent/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: inputValue, model: selectedModel }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.response, // Use response from the service
        timestamp: new Date(),
        model: selectedModel.toUpperCase(),
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
    // Could show toast notification here
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <div className="ai-chat-panel flex flex-col h-full">
      {/* Header */}
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
          <Button variant="ghost" size="sm" className="chat-settings w-8 h-8 p-0" title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="w-8 h-8 p-0" onClick={clearConversation} title="Clear">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-md-on-surface-variant py-8">
            <Bot size={32} className="mx-auto mb-3 opacity-50" />
            <p className="font-bold mb-1">AI Assistant</p>
            <p className="text-xs">Ask me anything to get started!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message ${message.type === 'user' ? 'user-message' : 'ai-message'}`}>
              <div className="message-avatar">
                {message.type === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div className="message-content">
                <div className="message-bubble">
                  <div className="md-body-small whitespace-pre-wrap break-words">{message.content}</div>
                </div>
                <div className="message-actions">
                  {message.type === 'ai' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="copy-code w-6 h-6 p-0"
                      onClick={() => copyMessage(message.content)}
                      title="Copy"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Anchor to keep scroll at bottom */}
        <div ref={messagesEndRef} />

        {isLoading && (
          <div className="message ai-message">
            <div className="message-avatar">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div className="message-content">
              <div className="message-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" style={{ animationDelay: '0.2s' }} />
                  <div className="typing-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-container">
        <div className="input-wrapper">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything about your code..."
            className="chat-input"
            rows={1}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="send-button w-8 h-8 p-0 rounded-md md-filled"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="input-help text-xs text-md-on-surface-variant mt-2">Shift + Enter for new line</div>
      </div>
    </div>
  );
};

export default AIChat;