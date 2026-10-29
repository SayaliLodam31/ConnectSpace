const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT_DIR, '.config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ports.json');
const RUN_DIR = path.join(ROOT_DIR, '.run');
const PID_FILE = path.join(RUN_DIR, 'dev.pid');
const ENV_LOCAL = path.join(ROOT_DIR, '.env.local');

const FRONTEND_RANGE = [3017, 3018, 3019, 3020, 3021];
const BACKEND_RANGE = [4017, 4018, 4019, 4020, 4021];
const SIGNALING_RANGE = [5017, 5018, 5019, 5020, 5021];

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false); // In use by active service
    });
    socket.once('error', () => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '0.0.0.0');
    });
  });
}

async function findAvailablePort(range, serviceName, preferredPort) {
  if (preferredPort && (await isPortAvailable(preferredPort))) {
    return preferredPort;
  }
  if (preferredPort) {
    console.log(`Port ${preferredPort} is occupied by another process. Checking next available approved port for ${serviceName}... No other process was stopped.`);
  }
  for (const port of range) {
    if (await isPortAvailable(port)) {
      if (preferredPort && port !== preferredPort) {
        console.log(`Port ${preferredPort} is occupied by another process. This project will use port ${port}. No other process was stopped.`);
      }
      return port;
    }
  }
  throw new Error(`All approved ports for ${serviceName} (${range.join(', ')}) are in use!`);
}

function updateEnvLocal(frontendPort, backendPort, signalingPort) {
  let content = '';
  if (fs.existsSync(ENV_LOCAL)) {
    content = fs.readFileSync(ENV_LOCAL, 'utf8');
  }

  const updates = {
    NEXT_PUBLIC_APP_URL: `http://localhost:${frontendPort}`,
    NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}`,
    NEXT_PUBLIC_SIGNALING_URL: `http://localhost:${signalingPort}`,
  };

  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${val}`);
    } else {
      content += (content.endsWith('\n') || content.length === 0 ? '' : '\n') + `${key}=${val}\n`;
    }
  }

  fs.writeFileSync(ENV_LOCAL, content, 'utf8');
}

async function start() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(RUN_DIR)) {
    fs.mkdirSync(RUN_DIR, { recursive: true });
  }

  let preferred = { frontend: 3017, backend: 4017, signaling: 5017 };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      preferred = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {}
  }

  const selectedFrontend = await findAvailablePort(FRONTEND_RANGE, 'frontend', preferred.frontend);
  const selectedBackend = await findAvailablePort(BACKEND_RANGE, 'backend', preferred.backend);
  const selectedSignaling = await findAvailablePort(SIGNALING_RANGE, 'signaling', preferred.signaling);

  const finalConfig = {
    frontend: selectedFrontend,
    backend: selectedBackend,
    signaling: selectedSignaling,
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(finalConfig, null, 2), 'utf8');
  updateEnvLocal(selectedFrontend, selectedBackend, selectedSignaling);

  console.log('====================================================');
  console.log(' ConnectSpace - Starting with Isolated Ports');
  console.log('====================================================');
  console.log(`Frontend URL:   http://localhost:${selectedFrontend}`);
  console.log(`Backend Port:   ${selectedBackend}`);
  console.log(`Signaling Port: ${selectedSignaling}`);
  console.log('====================================================');

  const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(selectedFrontend)], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(selectedFrontend),
    },
  });

  fs.writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, port: selectedFrontend, startedAt: new Date().toISOString() }), 'utf8');

  child.on('exit', (code, signal) => {
    if (fs.existsSync(PID_FILE)) {
      try {
        fs.unlinkSync(PID_FILE);
      } catch (e) {}
    }
    process.exit(code || 0);
  });

  const cleanup = () => {
    if (!child.killed) {
      child.kill();
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
