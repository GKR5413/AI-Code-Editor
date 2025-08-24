import WebSocket from 'ws';

console.log('🔍 Debug Terminal Connection...');

const ws = new WebSocket('ws://localhost:3003');

ws.on('open', function open() {
  console.log('✅ Connected');
  
  // Send a simple command
  console.log('📤 Sending: echo "Hello Debug"');
  ws.send(JSON.stringify({ 
    type: 'input', 
    data: 'echo "Hello Debug"\r' 
  }));
  
  // Wait 2 seconds, then send ls
  setTimeout(() => {
    console.log('📤 Sending: ls -la');
    ws.send(JSON.stringify({ 
      type: 'input', 
      data: 'ls -la\r' 
    }));
  }, 2000);
  
  // Wait 4 seconds, then send pwd
  setTimeout(() => {
    console.log('📤 Sending: pwd');
    ws.send(JSON.stringify({ 
      type: 'input', 
      data: 'pwd\r' 
    }));
  }, 4000);
});

ws.on('message', function message(data) {
  try {
    const msg = JSON.parse(data.toString());
    console.log('📨 Message type:', msg.type);
    if (msg.type === 'output') {
      console.log('📦 Raw output:', JSON.stringify(msg.data));
      console.log('📄 Display output:', msg.data.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, ''));
    } else {
      console.log('📨 Full message:', msg);
    }
  } catch (e) {
    console.log('📨 Raw data:', data.toString());
  }
});

ws.on('close', function close() {
  console.log('❌ Connection closed');
});

ws.on('error', function error(err) {
  console.log('🚫 Error:', err.message);
});

// Keep alive for 10 seconds
setTimeout(() => {
  console.log('🔚 Closing...');
  ws.close();
}, 10000);