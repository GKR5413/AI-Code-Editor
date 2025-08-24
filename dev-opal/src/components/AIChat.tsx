import React, { useState } from 'react';
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

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'ai',
    content: `Hello! I'm your AI coding assistant. I can help you with:

• Code explanation and documentation
• Bug finding and fixing
• Code optimization suggestions  
• Converting natural language to code
• Code reviews and best practices

What would you like to work on today?`,
    timestamp: new Date('2024-01-20T10:00:00'),
    model: 'GPT-4'
  },
  {
    id: '2',
    type: 'user',
    content: 'Can you help me optimize this React component for better performance?',
    timestamp: new Date('2024-01-20T10:01:00')
  },
  {
    id: '3',
    type: 'ai',
    content: `I'd be happy to help optimize your React component! To provide the best suggestions, could you:

1. **Share the component code** - paste it in the editor or here
2. **Describe performance issues** - slow rendering, memory leaks, etc.
3. **Mention the component's purpose** - helps me suggest specific optimizations

Common React optimizations I can help with:
\`\`\`typescript
// Memoization
const OptimizedComponent = React.memo(MyComponent);

// Callback optimization
const handleClick = useCallback(() => {
  // logic here
}, [dependencies]);

// State optimization
const [items, setItems] = useState(() => expensiveInitialValue());
\`\`\`

What specific performance challenges are you facing?`,
    timestamp: new Date('2024-01-20T10:02:00'),
    model: 'GPT-4'
  }
];

const models = [
  { value: 'gpt-4', label: 'GPT-4', description: 'Most capable, best for complex reasoning' },
  { value: 'claude', label: 'Claude', description: 'Great for coding and documentation' },
  { value: 'codellama', label: 'CodeLlama', description: 'Specialized for code generation' },
  { value: 'local', label: 'Local Model', description: 'Run locally via Ollama' }
];

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenUsage, setTokenUsage] = useState({ used: 1247, limit: 10000 });

  const sendMessage = async () => {
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

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'I understand you want to work on that. Let me analyze your code and provide some suggestions...',
        timestamp: new Date(),
        model: selectedModel.toUpperCase()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
      setTokenUsage(prev => ({ ...prev, used: prev.used + 150 }));
    }, 1500);
  };

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
    setTokenUsage(prev => ({ ...prev, used: 0 }));
  };

  return (
    <div className="ai-chat-panel">
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
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="text-center text-md-on-surface-variant py-8">
            <Bot size={32} className="mx-auto mb-3 opacity-50" />
            <p className="md-body-small mb-1">No conversation yet</p>
            <p className="text-xs">Start by asking a question!</p>
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