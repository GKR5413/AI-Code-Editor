import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test script for gRPC communication between services

async function testGrpcCommunication() {
  console.log('🧪 Testing gRPC Communication System');
  console.log('=====================================\n');

  // Load protobuf definitions
  const compilerProtoPath = path.join(__dirname, 'proto/compiler.proto');
  const agentProtoPath = path.join(__dirname, 'proto/agent.proto');
  const frontendProtoPath = path.join(__dirname, 'proto/frontend.proto');

  const compilerPackageDef = protoLoader.loadSync(compilerProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const agentPackageDef = protoLoader.loadSync(agentProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const frontendPackageDef = protoLoader.loadSync(frontendProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const compilerProto = grpc.loadPackageDefinition(compilerPackageDef);
  const agentProto = grpc.loadPackageDefinition(agentPackageDef);
  const frontendProto = grpc.loadPackageDefinition(frontendPackageDef);

  // Test results
  const results = {
    compiler: { status: 'unknown', error: null },
    agent: { status: 'unknown', error: null },
    gateway: { status: 'unknown', error: null }
  };

  // Test Compiler gRPC Service
  console.log('1. Testing Compiler gRPC Service...');
  try {
    const compilerClient = new compilerProto.compiler.CompilerService(
      'localhost:50052',
      grpc.credentials.createInsecure()
    );

    const healthResponse = await new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      compilerClient.HealthCheck({}, { deadline }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    if (healthResponse.healthy) {
      console.log('   ✅ Compiler service is healthy');
      results.compiler.status = 'healthy';
      
      // Test getting supported languages
      const languagesResponse = await new Promise((resolve, reject) => {
        compilerClient.GetSupportedLanguages({}, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
      
      console.log(`   📋 Supported languages: ${languagesResponse.languages?.length || 0}`);
    } else {
      results.compiler.status = 'unhealthy';
      results.compiler.error = healthResponse.message;
    }

    compilerClient.close();
  } catch (error) {
    console.log(`   ❌ Compiler service error: ${error.message}`);
    results.compiler.status = 'error';
    results.compiler.error = error.message;
  }

  // Test Agent gRPC Service
  console.log('\\n2. Testing Agent gRPC Service...');
  try {
    const agentClient = new agentProto.agent.AgentService(
      'localhost:50053',
      grpc.credentials.createInsecure()
    );

    const healthResponse = await new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      agentClient.HealthCheck({}, { deadline }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    if (healthResponse.healthy) {
      console.log('   ✅ Agent service is healthy');
      results.agent.status = 'healthy';
      
      // Test getting supported models
      const modelsResponse = await new Promise((resolve, reject) => {
        agentClient.GetSupportedModels({}, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
      
      console.log(`   🤖 Supported models: ${modelsResponse.models?.length || 0}`);
    } else {
      results.agent.status = 'unhealthy';
      results.agent.error = healthResponse.message;
    }

    agentClient.close();
  } catch (error) {
    console.log(`   ❌ Agent service error: ${error.message}`);
    results.agent.status = 'error';
    results.agent.error = error.message;
  }

  // Test Frontend Gateway Service
  console.log('\\n3. Testing Frontend Gateway Service...');
  try {
    const gatewayClient = new frontendProto.frontend.FrontendGatewayService(
      'localhost:50051',
      grpc.credentials.createInsecure()
    );

    const healthResponse = await new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      gatewayClient.HealthCheck({}, { deadline }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    if (healthResponse.healthy) {
      console.log('   ✅ Gateway service is healthy');
      results.gateway.status = 'healthy';
      
      // Test system status
      const systemStatus = await new Promise((resolve, reject) => {
        gatewayClient.GetSystemStatus({}, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
      
      console.log(`   🔧 System healthy: ${systemStatus.healthy}`);
      console.log(`   📊 Connected services: ${Object.keys(systemStatus.services || {}).length}`);
    } else {
      results.gateway.status = 'unhealthy';
      results.gateway.error = healthResponse.message;
    }

    gatewayClient.close();
  } catch (error) {
    console.log(`   ❌ Gateway service error: ${error.message}`);
    results.gateway.status = 'error';
    results.gateway.error = error.message;
  }

  // Test End-to-End Communication
  console.log('\\n4. Testing End-to-End Communication...');
  try {
    const gatewayClient = new frontendProto.frontend.FrontendGatewayService(
      'localhost:50051',
      grpc.credentials.createInsecure()
    );

    // Test agent communication through gateway
    const messageResponse = await new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 15);
      
      gatewayClient.SendMessageToAgent({
        model: 'gemini-2.0-flash-exp',
        messages: [{
          role: 'user',
          content: 'Hello! This is a test of the gRPC communication system.',
          timestamp: Date.now()
        }],
        options: {
          temperature: 0.7,
          max_tokens: 100,
          stream: false
        }
      }, { deadline }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    if (messageResponse.success) {
      console.log('   ✅ End-to-end agent communication successful');
      console.log(`   💬 Response: "${messageResponse.response?.substring(0, 50)}..."`);
    }

    // Test compiler communication through gateway
    const languagesResponse = await new Promise((resolve, reject) => {
      gatewayClient.GetSupportedLanguages({}, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    if (languagesResponse.success) {
      console.log('   ✅ End-to-end compiler communication successful');
      console.log(`   🔧 Languages available: ${languagesResponse.languages?.length || 0}`);
    }

    gatewayClient.close();
  } catch (error) {
    console.log(`   ❌ End-to-end communication error: ${error.message}`);
  }

  // Print summary
  console.log('\\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Compiler Service: ${results.compiler.status === 'healthy' ? '✅' : '❌'} ${results.compiler.status}`);
  console.log(`Agent Service:    ${results.agent.status === 'healthy' ? '✅' : '❌'} ${results.agent.status}`);
  console.log(`Gateway Service:  ${results.gateway.status === 'healthy' ? '✅' : '❌'} ${results.gateway.status}`);
  
  const healthyServices = Object.values(results).filter(r => r.status === 'healthy').length;
  const totalServices = Object.keys(results).length;
  
  console.log(`\\n🎯 Overall Status: ${healthyServices}/${totalServices} services healthy`);
  
  if (healthyServices === totalServices) {
    console.log('🎉 All gRPC services are working correctly!');
    console.log('✨ System is ready for full gRPC communication.');
  } else {
    console.log('⚠️  Some services need attention before full deployment.');
  }

  return results;
}

// Run the test
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testGrpcCommunication()
    .then(() => {
      console.log('\\n🏁 Testing completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n💥 Testing failed:', error);
      process.exit(1);
    });
}

export { testGrpcCommunication };