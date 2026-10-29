const WebSocket = require('ws');

const ws1 = new WebSocket('ws://localhost:5017');
const ws2 = new WebSocket('ws://localhost:5017');

let receivedByWs2 = false;

function waitForOpen(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.once('open', resolve);
  });
}

async function runTest() {
  await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);
  console.log('Both clients connected');

  ws1.send(JSON.stringify({ type: 'join', meetingCode: 'test-code', userId: 'user-1' }));
  ws2.send(JSON.stringify({ type: 'join', meetingCode: 'test-code', userId: 'user-2' }));

  setTimeout(() => {
    ws1.send(JSON.stringify({
      type: 'offer',
      target: 'user-2',
      from: 'user-1',
      sdp: 'mock-sdp-offer'
    }));
  }, 200);
}

runTest();

ws2.on('message', (msg) => {
  const data = JSON.parse(msg.toString());
  console.log('Client 2 received message:', data.type, 'from:', data.from);
  if (data.type === 'offer' && data.from === 'user-1') {
    receivedByWs2 = true;
    console.log('SIGNALING RELAY TEST PASSED!');
    ws1.close();
    ws2.close();
    process.exit(0);
  }
});

setTimeout(() => {
  if (!receivedByWs2) {
    console.error('Signaling test timed out!');
    ws1.close();
    ws2.close();
    process.exit(1);
  }
}, 3000);
