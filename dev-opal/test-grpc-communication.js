#!/usr/bin/env node

/**
 * Test script to demonstrate gRPC communication between Gemini Agent and Terminal
 * This script shows how the agent can control the terminal through gRPC
 */

const GrpcTerminalClient = require('./agent-service/grpc-terminal-client');

async function testGrpcCommunication() {
  console.log('🚀 Testing gRPC Communication between Gemini Agent and Terminal\n');
  
  // Initialize gRPC client
  const terminalClient = new GrpcTerminalClient('localhost:50051');
  
  try {
    // Test 1: Create a terminal session
    console.log('📝 Test 1: Creating terminal session...');
    const sessionId = `test-session-${Date.now()}`;
    
    const createResult = await terminalClient.createSession(sessionId, {
      shell: 'bash',
      workingDirectory: '/workspace',
      environment: {
        AI_SESSION: 'true',
        TEST_MODE: 'true'
      }
    });
    
    console.log('✅ Session created:', createResult);
    
    // Test 2: Execute a simple command
    console.log('\n📝 Test 2: Executing command...');
    const executeResult = await terminalClient.executeCommand(sessionId, 'echo "Hello from gRPC!" && pwd');
    console.log('✅ Command executed:', executeResult);
    
    // Test 3: Get terminal output
    console.log('\n📝 Test 3: Getting terminal output...');
    const outputResult = await terminalClient.getOutput(sessionId, 10);
    console.log('✅ Terminal output:', outputResult);
    
    // Test 4: Execute multiple commands
    console.log('\n📝 Test 4: Executing multiple commands...');
    const commands = [
      'echo "=== System Info ==="',
      'uname -a',
      'echo "=== Current Directory ==="',
      'pwd',
      'echo "=== Files in workspace ==="',
      'ls -la'
    ];
    
    const multiResult = await terminalClient.executeCommands(sessionId, commands, {
      delayBetweenCommands: 200
    });
    
    console.log('✅ Multiple commands executed:', multiResult);
    
    // Test 5: List active sessions
    console.log('\n📝 Test 5: Listing active sessions...');
    const sessionsResult = await terminalClient.listSessions();
    console.log('✅ Active sessions:', sessionsResult);
    
    // Test 6: Stream output (real-time)
    console.log('\n📝 Test 6: Streaming terminal output...');
    console.log('Starting output stream (will run for 5 seconds)...');
    
    const streamPromise = terminalClient.streamOutput(sessionId, true, (chunk) => {
      process.stdout.write(`📡 Stream: ${chunk.data}`);
    });
    
    // Send some commands while streaming
    setTimeout(async () => {
      await terminalClient.executeCommand(sessionId, 'echo "Streaming test command"');
    }, 1000);
    
    setTimeout(async () => {
      await terminalClient.executeCommand(sessionId, 'echo "Another streaming command"');
    }, 2000);
    
    // Wait for stream to complete
    setTimeout(async () => {
      console.log('\n✅ Streaming test completed');
    }, 5000);
    
    // Test 7: Clean up - kill the session
    console.log('\n📝 Test 7: Cleaning up session...');
    const killResult = await terminalClient.killSession(sessionId);
    console.log('✅ Session killed:', killResult);
    
    console.log('\n🎉 All gRPC communication tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during gRPC communication test:', error);
  } finally {
    // Close the gRPC client
    terminalClient.close();
    console.log('\n🔌 gRPC client connection closed');
  }
}

// Test Gemini Agent API endpoints
async function testGeminiAgentAPI() {
  console.log('\n🤖 Testing Gemini Agent API with Terminal Integration\n');
  
  try {
    // Test 1: Basic agent request
    console.log('📝 Test 1: Basic Gemini agent request...');
    const response = await fetch('http://localhost:6000/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'Hello! Can you help me with a simple task?' }
        ]
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Agent response:', result.response.substring(0, 100) + '...');
    } else {
      console.log('❌ Agent request failed:', response.status);
    }
    
    // Test 2: Agent with terminal commands
    console.log('\n📝 Test 2: Gemini agent with terminal command execution...');
    const response2 = await fetch('http://localhost:6000/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash-exp',
        messages: [
          { role: 'user', content: 'Please check the current directory and list files' }
        ],
        terminalCommands: [
          'pwd',
          'ls -la'
        ]
      })
    });
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ Agent response with terminal execution:', {
        response: result2.response.substring(0, 100) + '...',
        terminal: result2.terminal
      });
    } else {
      console.log('❌ Agent request with terminal failed:', response2.status);
    }
    
    // Test 3: Code generation and execution
    console.log('\n📝 Test 3: Code generation with terminal execution...');
    const response3 = await fetch('http://localhost:6000/api/gemini/code-execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'Create a simple Python script that prints "Hello from Gemini!" and shows the current time',
        language: 'python',
        executeInTerminal: true
      })
    });
    
    if (response3.ok) {
      const result3 = await response3.json();
      console.log('✅ Code generation and execution:', {
        code: result3.code.substring(0, 100) + '...',
        executed: result3.executed,
        executionResult: result3.executionResult
      });
    } else {
      console.log('❌ Code generation failed:', response3.status);
    }
    
    console.log('\n🎉 All Gemini Agent API tests completed!');
    
  } catch (error) {
    console.error('❌ Error during Gemini Agent API test:', error);
  }
}

// Main test function
async function runAllTests() {
  console.log('🧪 Starting gRPC Communication and Gemini Agent Integration Tests\n');
  console.log('=' .repeat(80));
  
  // Wait a bit for services to be ready
  console.log('⏳ Waiting 3 seconds for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Test gRPC communication
    await testGrpcCommunication();
    
    console.log('\n' + '=' .repeat(80));
    
    // Test Gemini Agent API
    await testGeminiAgentAPI();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  console.log('\n🏁 Test suite completed!');
  process.exit(0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testGrpcCommunication, testGeminiAgentAPI };
