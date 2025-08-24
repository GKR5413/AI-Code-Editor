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
  const [expandedSections, setExpandedSections] = useState({
    compilation: true,
    execution: true,
    input: false
  });

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

  // Auto-detect language from active file
  useEffect(() => {
    if (activeTab && activeTab.path) {
      const detectedLanguage = compilerService.getLanguageFromExtension(activeTab.path);
      if (detectedLanguage && supportedLanguages.some(lang => lang.name === detectedLanguage)) {
        setSelectedLanguage(detectedLanguage);
      }
    }
  }, [activeTab, supportedLanguages]);

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
  }, [activeTab, selectedLanguage, input]);

  const handleStop = () => {
    // In a real implementation, you would need to track running processes
    // and provide a way to terminate them
    setIsRunning(false);
    setIsCompiling(false);
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
            {isRunning ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run
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
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter input for your program..."
              className="min-h-20"
            />
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
    </div>
  );
};

export default CompilerPanel;