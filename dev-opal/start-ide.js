#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting AI-IDE...');
console.log('This will start both the development server and terminal server');

// Start both processes concurrently
const devServer = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

const terminalServer = spawn('npm', ['run', 'terminal'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down AI-IDE...');
  devServer.kill('SIGINT');
  terminalServer.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM, shutting down...');
  devServer.kill('SIGTERM');
  terminalServer.kill('SIGTERM');
  process.exit(0);
});

// Handle dev server exit
devServer.on('exit', (code, signal) => {
  console.log(`Dev server exited with code ${code}, signal ${signal}`);
  terminalServer.kill('SIGTERM');
  process.exit(code || 0);
});

// Handle terminal server exit
terminalServer.on('exit', (code, signal) => {
  console.log(`Terminal server exited with code ${code}, signal ${signal}`);
  devServer.kill('SIGTERM');
  process.exit(code || 0);
});

console.log('✅ AI-IDE is starting up...');
console.log('Press Ctrl+C to stop both servers');