const net = require('net');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, '.config', 'ports.json');
const ENV_LOCAL = path.join(ROOT_DIR, '.env.local');

function isPortActive(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // Port has active listener
    });
    socket.once('error', () => {
      const server = net.createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close(() => resolve(false));
      });
      server.listen(port, '0.0.0.0');
    });
  });
}

function readEnvVar(name) {
  if (fs.existsSync(ENV_LOCAL)) {
    const content = fs.readFileSync(ENV_LOCAL, 'utf8');
    const match = content.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (match) return match[1].trim();
  }
  return process.env[name] || '';
}

async function run() {
  console.log('====================================================');
  console.log(' ConnectSpace - Port & Environment Diagnostics');
  console.log('====================================================');
  console.log(`Project Name: ConnectSpace`);

  let portsConfig = { frontend: 3017, backend: 4017, signaling: 5017 };
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      portsConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (e) {
      console.warn('Warning: Could not parse .config/ports.json, using defaults.');
    }
  }

  const frontendActive = await isPortActive(portsConfig.frontend);
  const backendActive = await isPortActive(portsConfig.backend);
  const signalingActive = await isPortActive(portsConfig.signaling);

  console.log(`Frontend Port:         ${portsConfig.frontend} (${frontendActive ? 'ACTIVE / IN USE' : 'FREE'})`);
  console.log(`Backend Port:          ${portsConfig.backend} (${backendActive ? 'ACTIVE / IN USE' : 'FREE'})`);
  console.log(`Signaling Port:        ${portsConfig.signaling} (${signalingActive ? 'ACTIVE / IN USE' : 'FREE'})`);

  const supabaseUrl = readEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = readEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const configured = Boolean(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl !== '' &&
    !supabaseUrl.includes('placeholder.supabase.co')
  );

  console.log(`Supabase URL:          ${supabaseUrl || '[NOT CONFIGURED in .env.local]'}`);
  console.log(`Supabase Configured:   ${configured ? 'YES (Ready)' : 'NO (Action Required)'}`);
  console.log(`Application URL:       http://localhost:${portsConfig.frontend}`);
  console.log('====================================================');
}

run();
