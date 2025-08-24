export class TerminalServerManager {
  private static instance: TerminalServerManager;
  private serverStarted: boolean = false;
  private serverProcess: any = null;
  private serverPort: number = 3001;
  private serverUrl: string = 'http://localhost:3001';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private startupPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): TerminalServerManager {
    if (!TerminalServerManager.instance) {
      TerminalServerManager.instance = new TerminalServerManager();
    }
    return TerminalServerManager.instance;
  }

  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        timeout: 2000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async startServer(): Promise<void> {
    // If already starting, wait for that to complete
    if (this.startupPromise) {
      return this.startupPromise;
    }

    // If server is already running, don't start again
    if (this.serverStarted || await this.isServerRunning()) {
      this.serverStarted = true;
      this.startHeartbeat();
      return;
    }

    this.startupPromise = this.doStartServer();
    return this.startupPromise;
  }

  private async doStartServer(): Promise<void> {
    try {
      console.log('🚀 Starting terminal server...');

      // Try to start the server via npm script
      const startCommand = this.getStartCommand();
      
      // Start server in background
      this.serverProcess = await this.executeCommand(startCommand);
      
      // Wait for server to be ready (up to 10 seconds)
      const maxWaitTime = 10000;
      const checkInterval = 500;
      let elapsed = 0;

      while (elapsed < maxWaitTime) {
        if (await this.isServerRunning()) {
          console.log('✅ Terminal server started successfully');
          this.serverStarted = true;
          this.startHeartbeat();
          return;
        }
        await this.sleep(checkInterval);
        elapsed += checkInterval;
      }

      throw new Error('Terminal server failed to start within timeout');
    } catch (error) {
      console.error('❌ Failed to start terminal server:', error);
      throw error;
    } finally {
      this.startupPromise = null;
    }
  }

  private getStartCommand(): string[] {
    // Try to detect the environment and use appropriate command
    if (typeof window !== 'undefined' && (window as any).require) {
      // Electron environment
      return ['npm', 'run', 'terminal'];
    } else if (typeof process !== 'undefined' && process.env) {
      // Node.js environment
      return ['npm', 'run', 'terminal'];
    } else {
      // Browser environment - we'll need to use a different approach
      throw new Error('Cannot start server from browser environment');
    }
  }

  private async executeCommand(command: string[]): Promise<any> {
    // This would need to be implemented differently based on the environment
    // For now, we'll assume the server is started externally
    console.log(`Would execute: ${command.join(' ')}`);
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      const isRunning = await this.isServerRunning();
      if (!isRunning && this.serverStarted) {
        console.log('⚠️ Terminal server appears to be down, attempting restart...');
        this.serverStarted = false;
        this.startServer().catch(console.error);
      }
    }, 5000); // Check every 5 seconds
  }

  async stopServer(): Promise<void> {
    console.log('🛑 Stopping terminal server...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.serverProcess) {
      try {
        // Try to gracefully stop the server
        if (typeof this.serverProcess.kill === 'function') {
          this.serverProcess.kill('SIGTERM');
        }
      } catch (error) {
        console.error('Error stopping server process:', error);
      }
      this.serverProcess = null;
    }

    // Try to send shutdown signal via HTTP
    try {
      await fetch(`${this.serverUrl}/shutdown`, {
        method: 'POST',
        timeout: 2000
      });
    } catch (error) {
      // Ignore errors - server might already be down
    }

    this.serverStarted = false;
    console.log('✅ Terminal server stopped');
  }

  // Hook into page lifecycle events
  setupPageLifecycleHandlers(): void {
    if (typeof window !== 'undefined') {
      // Start server when page loads
      window.addEventListener('load', () => {
        this.startServer().catch(console.error);
      });

      // Stop server when page unloads
      window.addEventListener('beforeunload', () => {
        this.stopServer().catch(console.error);
      });

      // Handle visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.serverStarted) {
          this.startServer().catch(console.error);
        }
      });
    }
  }

  getServerStatus(): { running: boolean; port: number; url: string } {
    return {
      running: this.serverStarted,
      port: this.serverPort,
      url: this.serverUrl
    };
  }
}

// Export singleton instance
export const terminalServerManager = TerminalServerManager.getInstance();