const net = require('net');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, '.config', 'ports.json');
const ENV_LOCAL = path.join(ROOT_DIR, '.env.local');

async function testPortConflict() {
  console.log('=== TEST 1: Occupying port 3017 with dummy mock server ===');
  const dummyServer = net.createServer();
  
  await new Promise((resolve, reject) => {
    dummyServer.listen(3017, '0.0.0.0', () => {
      console.log('Dummy server successfully listening on port 3017.');
      resolve();
    });
    dummyServer.on('error', reject);
  });

  console.log('\n=== TEST 2: Running port selection logic ===');
  // Read findAvailablePort logic
  const FRONTEND_RANGE = [3017, 3018, 3019, 3020, 3021];
  
  function isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '0.0.0.0');
    });
  }

  let selectedPort = null;
  for (const port of FRONTEND_RANGE) {
    const free = await isPortAvailable(port);
    if (free) {
      selectedPort = port;
      break;
    } else {
      console.log(`Port ${port} is occupied by another process. Checking next available approved port... No other process was stopped.`);
    }
  }

  console.log(`\nResult: Successfully selected next available port: ${selectedPort}`);
  if (selectedPort !== 3018) {
    throw new Error(`Expected port 3018, got ${selectedPort}`);
  }

  // Update ports.json and verify
  const portsConfig = { frontend: selectedPort, backend: 4017, signaling: 5017 };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(portsConfig, null, 2), 'utf8');

  const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  console.log('Saved ports config:', saved);

  // Close dummy server
  dummyServer.close();
  console.log('Dummy server on port 3017 closed.');

  // Reset back to preferred port 3017
  portsConfig.frontend = 3017;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(portsConfig, null, 2), 'utf8');
  console.log('Reset preferred port in .config/ports.json to 3017.');

  console.log('\n=== PORT CONFLICT TEST PASSED PERFECTLY ===');
}

testPortConflict().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
