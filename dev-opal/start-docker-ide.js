#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🐳 Starting AI-IDE with Docker...');
console.log('This will build Docker images and start all services');

// Function to run a command and return a promise
const runCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
};

// Main startup function
const startDockerIDE = async () => {
  try {
    console.log('🔨 Building Docker images...');
    
    // Build the terminal container image first
    console.log('📦 Building terminal container image...');
    await runCommand('docker-compose', ['build', 'terminal-container-builder']);
    
    // Build the main terminal service
    console.log('📦 Building terminal service...');
    await runCommand('docker-compose', ['build', 'docker-terminal']);
    
    // Build the compiler service
    console.log('📦 Building compiler service...');
    await runCommand('docker-compose', ['build', 'compiler']);
    
    console.log('✅ All images built successfully!');
    console.log('🚀 Starting services...');
    
    // Start all services
    await runCommand('docker-compose', ['up', '--build']);
    
  } catch (error) {
    console.error('❌ Failed to start Docker IDE:', error.message);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Docker IDE...');
  runCommand('docker-compose', ['down']).then(() => {
    process.exit(0);
  }).catch(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM, shutting down...');
  runCommand('docker-compose', ['down']).then(() => {
    process.exit(0);
  }).catch(() => {
    process.exit(0);
  });
});

// Start the IDE
startDockerIDE();
