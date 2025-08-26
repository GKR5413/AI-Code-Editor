import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Settings,
  Loader,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Terminal,
  Code,
  Clock,
  Zap,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIDE } from '@/contexts/IDEContext';
import { compilerService, CompilationResult, CompilerLanguage } from '@/services/compilerService';

interface CompilerPanelProps {
  className?: string;
}

export const CompilerPanel: React.FC<CompilerPanelProps> = ({ className }) => {
  const { activeTab } = useIDE();
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('javascript');
  const [supportedLanguages, setSupportedLanguages] = useState<CompilerLanguage[]>([]);
  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<CompilationResult | null>(null);
  const [input, setInput] = useState('');
  const [compilerConnected, setCompilerConnected] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [interactiveOutput, setInteractiveOutput] = useState<string[]>([]);
  const [interactiveInput, setInteractiveInput] = useState('');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    compilation: true,
    execution: true,
    input: false
  });
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [compilerTerminalRef, setCompilerTerminalRef] = useState<any>(null);

  // Check for globally available compiler terminal reference
  useEffect(() => {
    const checkForTerminalRef = () => {
      if ((window as any).compilerTerminalRef) {
        setCompilerTerminalRef((window as any).compilerTerminalRef);
      } else if ((window as any).compilerTerminal) {
        setCompilerTerminalRef((window as any).compilerTerminal);
      }
    };
    
    checkForTerminalRef();
    const interval = setInterval(checkForTerminalRef, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, []);
  const [needsInput, setNeedsInput] = useState<boolean | null>(null);
  const [inputAnalysis, setInputAnalysis] = useState<any>(null);

  // Check compiler service health and load languages
  useEffect(() => {
    const checkCompilerService = async () => {
      try {
        const isHealthy = await compilerService.healthCheck();
        setCompilerConnected(isHealthy);
        
        if (isHealthy) {
          const languages = await compilerService.getSupportedLanguages();
          setSupportedLanguages(languages);
        }
      } catch (error) {
        console.error('Failed to connect to compiler service:', error);
        setCompilerConnected(false);
      }
    };

    checkCompilerService();
  }, []);

  // Auto-detect language from active file and analyze input needs
  useEffect(() => {
    if (activeTab && activeTab.path) {
      const detectedLanguage = compilerService.getLanguageFromExtension(activeTab.path);
      if (detectedLanguage && supportedLanguages.some(lang => lang.name === detectedLanguage)) {
        setSelectedLanguage(detectedLanguage);
      }
    }
    
    // Analyze if code needs input
    if (activeTab && activeTab.content && selectedLanguage) {
      analyzeInputNeeds();
    }
  }, [activeTab, supportedLanguages, selectedLanguage]);

  const analyzeInputNeeds = () => {
    if (!activeTab || !activeTab.content) return;
    
    const code = activeTab.content.toLowerCase();
    let needsInputDetected = false;
    let inputMethods: string[] = [];
    
    // Simple heuristic analysis for common input patterns
    switch (selectedLanguage) {
      case 'python':
        if (code.includes('input(')) {
          needsInputDetected = true;
          inputMethods.push('input()');
        }
        if (code.includes('raw_input(')) {
          needsInputDetected = true;
          inputMethods.push('raw_input()');
        }
        break;
        
      case 'javascript':
      case 'typescript':
        if (code.includes('prompt(') || code.includes('readline') || code.includes('process.stdin')) {
          needsInputDetected = true;
          inputMethods.push('prompt/readline');
        }
        break;
        
      case 'java':
        if (code.includes('scanner') || code.includes('bufferedreader') || code.includes('system.in')) {
          needsInputDetected = true;
          inputMethods.push('Scanner/BufferedReader');
        }
        break;
        
      case 'c':
      case 'cpp':
        if (code.includes('scanf') || code.includes('cin >>') || code.includes('getchar')) {
          needsInputDetected = true;
          inputMethods.push('scanf/cin');
        }
        break;
        
      default:
        // Generic check
        if (code.includes('input') || code.includes('read') || code.includes('scanf') || code.includes('cin')) {
          needsInputDetected = true;
          inputMethods.push('input functions');
        }
    }
    
    setNeedsInput(needsInputDetected);
    setInputAnalysis({
      needsInput: needsInputDetected,
      inputMethods,
      recommendation: needsInputDetected ? 'terminal' : 'regular'
    });
  };

  const handleCompile = useCallback(async () => {
    if (!activeTab || !activeTab.content) {
      alert('No code to compile. Please open a file first.');
      return;
    }

    setIsCompiling(true);
    setCompilationResult(null);
    
    try {
      const result = await compilerService.compileCode({
        language: selectedLanguage,
        code: activeTab.content,
        filename: activeTab.name,
        options: {
          timeout: 30000,
          compileTimeout: 30000
        }
      });
      
      setCompilationResult(result);
    } catch (error) {
      setCompilationResult({
        success: false,
        stage: 'compilation',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsCompiling(false);
    }
  }, [activeTab, selectedLanguage]);

  const handleRun = useCallback(async () => {
    if (!activeTab || !activeTab.content) {
      alert('No code to run. Please open a file first.');
      return;
    }

    // Check if code needs input and recommend terminal mode
    if (needsInput && inputAnalysis?.recommendation === 'terminal') {
      const useTerminal = confirm(
        `This program requires user input (${inputAnalysis.inputMethods.join(', ')}). ` +
        'Would you like to run it in the terminal for better interaction? ' +
        'Click OK to open compiler terminal, or Cancel to run normally.'
      );
      
      if (useTerminal) {
        await handleRunInTerminal();
        return;
      }
    }

    setIsRunning(true);
    setExecutionResult(null);
    
    try {
      const result = await compilerService.runCode({
        language: selectedLanguage,
        code: activeTab.content,
        filename: activeTab.name,
        input: input,
        options: {
          timeout: 30000,
          runTimeout: 30000
        }
      });
      
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({
        success: false,
        stage: 'execution',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, selectedLanguage, input, needsInput, inputAnalysis]);

  const handleRunInTerminal = useCallback(async () => {
    if (!activeTab || !activeTab.content) {
      alert('No code to run. Please open a file first.');
      return;
    }

    console.log('🚀 Starting real terminal execution...');
    setIsRunning(true);
    setExecutionResult(null);
    
    // Open the compiler terminal first
    if ((window as any).switchToCompilerTerminal) {
      (window as any).switchToCompilerTerminal();
    }
    
    try {
      if (compilerTerminalRef && compilerTerminalRef.executeProgram) {
        // Use the real terminal execution
        await compilerTerminalRef.executeProgram(selectedLanguage, activeTab.content, activeTab.name);
        
        setExecutionResult({
          success: true,
          stage: 'execution',
          message: 'Program running in Docker terminal',
          stdout: 'Program is running in the terminal below. Interact with it directly.'
        });
      } else {
        throw new Error('Compiler terminal not available');
      }
      
    } catch (error) {
      console.error('❌ Terminal execution error:', error);
      setExecutionResult({
        success: false,
        stage: 'execution',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, selectedLanguage, compilerTerminalRef]);


  const handleRunInteractive = useCallback(async () => {
    if (!activeTab || !activeTab.content) {
      alert('No code to run. Please open a file first.');
      return;
    }

    console.log('🚀 Starting interactive execution...');
    setIsRunning(true);
    setIsInteractive(true);
    setInteractiveOutput([]);
    setExecutionResult(null);
    
    try {
      // Connect to WebSocket for interactive execution
      const sessionId = Date.now().toString();
      console.log('🔌 Connecting to WebSocket with sessionId:', sessionId);
      // Use the correct WebSocket URL based on environment
      const wsUrl = window.location.hostname === 'localhost' 
        ? `ws://localhost:4002?sessionId=${sessionId}`
        : `ws://${window.location.hostname}:4002?sessionId=${sessionId}`;
      const ws = new WebSocket(wsUrl);
      setWsConnection(ws);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setInteractiveOutput(prev => [...prev, '🔌 Connected to interactive execution server...']);
        // Start interactive execution
        ws.send(JSON.stringify({
          type: 'start',
          payload: {
            language: selectedLanguage,
            code: activeTab.content,
            filename: activeTab.name
          }
        }));
        console.log('📤 Sent start command');
      };
      
      ws.onmessage = (event) => {
        console.log('📨 Received WebSocket message:', event.data);
        const data = JSON.parse(event.data);
        handleInteractiveMessage(data);
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        setIsRunning(false);
        setIsInteractive(false);
        setWsConnection(null);
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setInteractiveOutput(prev => [...prev, `❌ WebSocket error: ${error}`]);
        setIsRunning(false);
        setIsInteractive(false);
      };
      
    } catch (error) {
      console.error('❌ Interactive execution error:', error);
      setExecutionResult({
        success: false,
        stage: 'execution',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      setIsRunning(false);
      setIsInteractive(false);
    }
  }, [activeTab, selectedLanguage]);

  const handleInteractiveMessage = (data: any) => {
    console.log('🔄 Processing message type:', data.type, data);
    switch (data.type) {
      case 'started':
        console.log('✅ Interactive execution started');
        setInteractiveOutput(prev => [...prev, '🚀 Interactive execution started...']);
        break;
      case 'stdout':
        console.log('📤 stdout:', data.data);
        setInteractiveOutput(prev => [...prev, data.data]);
        // Check if this is a prompt waiting for input
        if (data.isPrompt) {
          setWaitingForInput(true);
          // Auto-focus the input field when waiting for input
          setTimeout(() => {
            const inputField = document.querySelector('.interactive-input input') as HTMLInputElement;
            if (inputField) {
              inputField.focus();
            }
          }, 100);
        }
        break;
      case 'stderr':
        console.log('⚠️ stderr:', data.data);
        setInteractiveOutput(prev => [...prev, `❌ ${data.data}`]);
        break;
      case 'exit':
        console.log('🏁 Program exited with code:', data.code);
        setInteractiveOutput(prev => [...prev, `✅ Program finished with exit code ${data.code}`]);
        setIsRunning(false);
        setIsInteractive(false);
        if (wsConnection) {
          wsConnection.close();
          setWsConnection(null);
        }
        break;
      case 'error':
        console.error('❌ Execution error:', data.message);
        setInteractiveOutput(prev => [...prev, `❌ Error: ${data.message}`]);
        break;
      default:
        console.warn('❓ Unknown message type:', data.type);
    }
  };

  const sendInteractiveInput = () => {
    if (wsConnection && interactiveInput) {
      console.log('📤 Sending input:', interactiveInput);
      wsConnection.send(JSON.stringify({
        type: 'input',
        payload: { data: interactiveInput + '\n' }
      }));
      setInteractiveOutput(prev => [...prev, `> ${interactiveInput}`]);
      setInteractiveInput('');
      setWaitingForInput(false); // Clear the waiting state
    } else {
      console.warn('⚠️ Cannot send input - no WebSocket connection or empty input');
    }
  };

  const handleStop = () => {
    if (wsConnection) {
      wsConnection.send(JSON.stringify({ type: 'stop' }));
      wsConnection.close();
      setWsConnection(null);
    }
    setIsRunning(false);
    setIsCompiling(false);
    setIsInteractive(false);
  };

  const loadSampleCode = () => {
    const sample = compilerService.getSampleCode(selectedLanguage);
    if (activeTab) {
      // You would need to add a method to the IDE context to update content
      // activeTab.content = sample;
      alert('Sample code loaded! (Implementation needed to update editor)');
    }
  };

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusIcon = (result: CompilationResult | null, isLoading: boolean) => {
    if (isLoading) {
      return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (!result) {
      return <Clock className="w-4 h-4 text-gray-400" />;
    }
    if (result.success) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusBadge = (result: CompilationResult | null, isLoading: boolean) => {
    if (isLoading) {
      return <Badge variant="secondary">Running...</Badge>;
    }
    if (!result) {
      return <Badge variant="outline">Ready</Badge>;
    }
    if (result.success) {
      return <Badge variant="default" className="bg-green-500">Success</Badge>;
    }
    return <Badge variant="destructive">Error</Badge>;
  };

  if (!compilerConnected) {
    return (
      <div className={`compiler-panel ${className || ''}`}>
        <div className="compiler-header">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-red-500" />
            <span className="font-medium">Compiler Service</span>
            <Badge variant="destructive">Offline</Badge>
          </div>
        </div>
        <div className="p-4 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Compiler Service Not Available</h3>
          <p className="text-sm text-gray-600 mb-4">
            The compiler service is not running. Please start the Docker container:
          </p>
          <code className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm block mb-4">
            docker-compose up compiler
          </code>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`compiler-panel ${className || ''}`}>
      {/* Header */}
      <div className="compiler-header">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          <span className="font-medium">Compiler</span>
          <Badge variant="default" className="bg-green-500">Online</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang.name} value={lang.name}>
                  {lang.name.charAt(0).toUpperCase() + lang.name.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={loadSampleCode}
            variant="ghost"
            size="sm"
            className="h-8"
            title="Load Sample Code"
          >
            <Code className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {/* Add settings modal */}}
            variant="ghost"
            size="sm"
            className="h-8"
            title="Compiler Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="compiler-controls">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRun}
            disabled={isRunning || isCompiling || !activeTab}
            className="flex items-center gap-2"
            size="sm"
          >
            {isRunning && !isInteractive ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run
            {needsInput && (
              <Badge variant="secondary" className="text-xs ml-1">
                Input
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={handleRunInTerminal}
            disabled={isRunning || isCompiling || !activeTab}
            variant={needsInput ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
            title="Run in terminal (recommended for programs with input)"
          >
            <Terminal className="w-4 h-4" />
            Terminal
            {needsInput && (
              <Badge variant="secondary" className="text-xs ml-1 bg-green-100 text-green-700">
                Recommended
              </Badge>
            )}
          </Button>
          
          <Button
            onClick={handleRunInteractive}
            disabled={isRunning || isCompiling || !activeTab}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {isRunning && isInteractive ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Terminal className="w-4 h-4" />
            )}
            Interactive
          </Button>
          
          {supportedLanguages.find(l => l.name === selectedLanguage)?.hasCompileStep && (
            <Button
              onClick={handleCompile}
              disabled={isRunning || isCompiling || !activeTab}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              {isCompiling ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Code className="w-4 h-4" />
              )}
              Compile
            </Button>
          )}

          <Button
            onClick={handleStop}
            disabled={!isRunning && !isCompiling}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Square className="w-4 h-4" />
            Stop
          </Button>
        </div>
        
        {activeTab && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>{activeTab.name}</span>
            {activeTab.isDirty && <span className="text-orange-500">•</span>}
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="section">
        <div 
          className="section-header"
          onClick={() => toggleSection('input')}
        >
          <div className="flex items-center gap-2">
            {expandedSections.input ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Terminal className="w-4 h-4" />
            <span>Input</span>
          </div>
        </div>
        {expandedSections.input && (
          <div className="section-content">
            <Textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-expand input section when user starts typing
                if (e.target.value && !expandedSections.input) {
                  setExpandedSections(prev => ({ ...prev, input: true }));
                }
              }}
              placeholder="Enter input for your program (for programs that need user input like input(), scanf(), etc.)..."
              className="min-h-20"
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Use "Interactive" mode for programs that need multiple inputs or real-time interaction.
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <Tabs defaultValue="execution" className="results-tabs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="execution" className="flex items-center gap-2">
            {getStatusIcon(executionResult, isRunning)}
            Execution
            {getStatusBadge(executionResult, isRunning)}
          </TabsTrigger>
          <TabsTrigger value="compilation" className="flex items-center gap-2">
            {getStatusIcon(compilationResult, isCompiling)}
            Compilation
            {getStatusBadge(compilationResult, isCompiling)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="execution" className="result-content">
          {executionResult ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(executionResult, false)}
                    Execution Result
                  </div>
                  <div className="flex items-center gap-1">
                    {executionResult.executionTime && (
                      <Badge variant="outline" className="text-xs">
                        {Date.now() - executionResult.executionTime}ms
                      </Badge>
                    )}
                    {executionResult.exitCode !== undefined && (
                      <Badge variant={executionResult.exitCode === 0 ? "default" : "destructive"} className="text-xs">
                        Exit: {executionResult.exitCode}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {executionResult.stdout && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-600">Output:</span>
                      <Button
                        onClick={() => copyOutput(executionResult.stdout!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text stdout">{executionResult.stdout}</pre>
                  </div>
                )}
                
                {executionResult.stderr && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-yellow-600">Warnings:</span>
                      <Button
                        onClick={() => copyOutput(executionResult.stderr!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text stderr">{executionResult.stderr}</pre>
                  </div>
                )}
                
                {executionResult.error && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-600">Error:</span>
                      <Button
                        onClick={() => copyOutput(executionResult.error!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text error">{executionResult.error}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="empty-state">
              <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-center">
                {isRunning ? 'Executing...' : 'No execution results yet. Click "Run" to execute your code.'}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="compilation" className="result-content">
          {compilationResult ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(compilationResult, false)}
                    Compilation Result
                  </div>
                  {compilationResult.sessionId && (
                    <Badge variant="outline" className="text-xs">
                      ID: {compilationResult.sessionId.slice(-8)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {compilationResult.message && (
                  <div className="output-section">
                    <span className="text-sm font-medium text-blue-600">Message:</span>
                    <p className="text-sm mt-1">{compilationResult.message}</p>
                  </div>
                )}
                
                {compilationResult.stdout && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-600">Build Output:</span>
                      <Button
                        onClick={() => copyOutput(compilationResult.stdout!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text stdout">{compilationResult.stdout}</pre>
                  </div>
                )}
                
                {compilationResult.stderr && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-yellow-600">Build Warnings:</span>
                      <Button
                        onClick={() => copyOutput(compilationResult.stderr!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text stderr">{compilationResult.stderr}</pre>
                  </div>
                )}
                
                {compilationResult.error && (
                  <div className="output-section">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-600">Build Error:</span>
                      <Button
                        onClick={() => copyOutput(compilationResult.error!)}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="output-text error">{compilationResult.error}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="empty-state">
              <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-center">
                {isCompiling ? 'Compiling...' : 'No compilation results yet. Click "Compile" to build your code.'}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Interactive Execution Panel */}
      {isInteractive && (
        <div className="interactive-panel mt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="interactive-header p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm">Interactive Execution</span>
                <Badge variant={waitingForInput ? "default" : "secondary"} className="text-xs">
                  {waitingForInput ? 'Waiting for Input' : isRunning ? 'Running' : 'Ready'}
                </Badge>
                {waitingForInput && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                    Input Required
                  </Badge>
                )}
              </div>
              <Button
                onClick={handleStop}
                variant="destructive"
                size="sm"
                className="h-7 px-3"
              >
                <Square className="w-3 h-3 mr-1" />
                Stop
              </Button>
            </div>
          </div>
          
          <div className="interactive-output bg-black text-green-400 p-4 font-mono text-sm max-h-60 overflow-y-auto">
            {interactiveOutput.length > 0 ? (
              interactiveOutput.map((line, index) => (
                <div key={index}>{line}</div>
              ))
            ) : (
              <div className="text-gray-500">Waiting for program output...</div>
            )}
          </div>
          
          <div className={`interactive-input p-3 border-t border-gray-200 dark:border-gray-700 ${waitingForInput ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
            <div className="flex items-center gap-2">
              {waitingForInput && (
                <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 mr-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-sm font-medium">Input needed:</span>
                </div>
              )}
              <input
                type="text"
                value={interactiveInput}
                onChange={(e) => setInteractiveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendInteractiveInput();
                  }
                }}
                placeholder={waitingForInput ? "Program is waiting for input..." : "Enter input and press Enter..."}
                className={`flex-1 px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                  waitingForInput 
                    ? 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-200 dark:ring-yellow-800' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={!isRunning || !isInteractive}
              />
              <Button
                onClick={sendInteractiveInput}
                disabled={!isRunning || !isInteractive || !interactiveInput.trim()}
                size="sm"
                className={`px-4 ${waitingForInput ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
              >
                Send
              </Button>
            </div>
            {waitingForInput && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                💡 The program is waiting for your input. Type your response above and press Enter.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompilerPanel;