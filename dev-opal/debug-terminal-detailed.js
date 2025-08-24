import WebSocket from 'ws';

console.log('🔍 Detailed Terminal Debug...');

const ws = new WebSocket('ws://localhost:3003');
let commandCount = 0;

ws.on('open', function open() {
  console.log('✅ Connected');
  
  setTimeout(() => {
    commandCount++;
    console.log(`📤 [${commandCount}] Sending: whoami`);
    ws.send(JSON.stringify({ 
      type: 'input', 
      data: 'whoami\n' // Try \n instead of \r
    }));
  }, 3000);
  
  setTimeout(() => {
    commandCount++;
    console.log(`📤 [${commandCount}] Sending: pwd`);
    ws.send(JSON.stringify({ 
      type: 'input', 
      data: 'pwd\n'
    }));
  }, 5000);
  
  setTimeout(() => {
    commandCount++;
    console.log(`📤 [${commandCount}] Sending: echo test`);
    ws.send(JSON.stringify({ 
      type: 'input', 
      data: 'echo test\n'
    }));
  }, 7000);
});

ws.on('message', function message(data) {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'output') {
      const cleaned = msg.data.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
      if (cleaned.trim()) {
        console.log('📦 Output:', JSON.stringify(cleaned));
      }
    } else {
      console.log('📨 Message:', msg.type, msg.sessionId ? `(${msg.sessionId.slice(-6)})` : '');
    }
  } catch (e) {
    console.log('📨 Raw:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.log('🚫 Error:', err.message);
});

setTimeout(() => {
  console.log('🔚 Test complete');
  ws.close();
}, 10000);