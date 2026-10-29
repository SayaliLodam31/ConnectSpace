const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, '.run', 'dev.pid');

function stopProcess() {
  console.log('====================================================');
  console.log(' ConnectSpace - Safe Process Shutdown');
  console.log('====================================================');

  if (!fs.existsSync(PID_FILE)) {
    console.log('No active PID file found at .run/dev.pid. No processes were stopped.');
    return;
  }

  let pidData;
  try {
    pidData = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading .run/dev.pid:', e.message);
    return;
  }

  const pid = pidData.pid;
  if (!pid) {
    console.log('Invalid PID in .run/dev.pid.');
    return;
  }

  console.log(`Stopping ConnectSpace process (PID: ${pid}, Port: ${pidData.port || 'unknown'})...`);

  try {
    if (process.platform === 'win32') {
      // Use taskkill only for the specific PID and its tree, never globally
      const { execSync } = require('child_process');
      execSync(`taskkill /PID ${pid} /T /F`);
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`Successfully stopped ConnectSpace process ${pid}.`);
  } catch (err) {
    console.log(`Process ${pid} was already stopped or could not be reached:`, err.message);
  } finally {
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {}
  }

  console.log('No other project processes were modified.');
  console.log('====================================================');
}

stopProcess();
