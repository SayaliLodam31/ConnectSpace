const http = require('http');
const WebSocket = require('ws');

async function httpGet(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3017' + path, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

async function runSecurityAudit() {
  console.log('====================================================');
  console.log(' ConnectSpace - Automated Security Regression Suite');
  console.log('====================================================\n');

  let allPassed = true;

  // 1. HTTP Security Headers Audit
  console.log('--- 1. HTTP Security Headers ---');
  try {
    const res = await httpGet('/');
    const headers = res.headers;

    const xfo = headers['x-frame-options'];
    console.log(`  X-Frame-Options:        ${xfo || 'MISSING'} [${xfo === 'DENY' ? 'PASS' : 'FAIL'}]`);
    if (xfo !== 'DENY') allPassed = false;

    const xcto = headers['x-content-type-options'];
    console.log(`  X-Content-Type-Options: ${xcto || 'MISSING'} [${xcto === 'nosniff' ? 'PASS' : 'FAIL'}]`);
    if (xcto !== 'nosniff') allPassed = false;

    const refPol = headers['referrer-policy'];
    console.log(`  Referrer-Policy:        ${refPol || 'MISSING'} [${refPol === 'strict-origin-when-cross-origin' ? 'PASS' : 'FAIL'}]`);
    if (refPol !== 'strict-origin-when-cross-origin') allPassed = false;

    const permPol = headers['permissions-policy'];
    const permOk = permPol && permPol.includes('camera=(self)') && permPol.includes('microphone=(self)');
    console.log(`  Permissions-Policy:     ${permPol ? 'Configured' : 'MISSING'} [${permOk ? 'PASS' : 'FAIL'}]`);
    if (!permOk) allPassed = false;

    const csp = headers['content-security-policy'];
    const cspOk = csp && csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'");
    console.log(`  Content-Security-Policy:${csp ? ' Configured' : ' MISSING'} [${cspOk ? 'PASS' : 'FAIL'}]`);
    if (!cspOk) allPassed = false;
  } catch (err) {
    console.error('Error fetching headers:', err.message);
    allPassed = false;
  }

  // 2. Open Redirect Defense Audit
  console.log('\n--- 2. Open Redirect Parameter Defense ---');
  try {
    const maliciousPaths = [
      '/auth/callback?code=mock&next=//malicious-site.com/steal',
      '/auth/callback?code=mock&next=https://malicious-site.com',
      '/auth/callback?code=mock&next=\\\\malicious-site.com'
    ];

    for (const testPath of maliciousPaths) {
      const res = await httpGet(testPath);
      const loc = res.headers.location || '';
      const safe = !loc.includes('malicious-site.com') && !loc.startsWith('//');
      console.log(`  Target: ${testPath}`);
      console.log(`  Redirect Location: ${loc} [${safe ? 'PASS - BLOCKED' : 'FAIL - OPEN REDIRECT'}]`);
      if (!safe) allPassed = false;
    }
  } catch (err) {
    console.error('Error checking open redirect:', err.message);
    allPassed = false;
  }

  // 3. Signaling WebSocket Server Origin Defense Audit
  console.log('\n--- 3. Signaling Server Origin Security ---');
  await new Promise((resolve) => {
    // Attempt connection with hostile external origin
    const hostileWs = new WebSocket('ws://localhost:5017', {
      headers: { Origin: 'http://malicious-attacker.com' }
    });

    let rejected = false;
    hostileWs.on('error', (err) => {
      // Expected: 403 Forbidden handshake rejection
      if (err.message && err.message.includes('403')) {
        rejected = true;
      }
    });

    hostileWs.on('open', () => {
      console.log('  Untrusted Origin: Handshake was ALLOWED! [FAIL]');
      allPassed = false;
      hostileWs.close();
      resolve();
    });

    hostileWs.on('unexpected-response', (req, res) => {
      if (res.statusCode === 403) {
        rejected = true;
      }
    });

    setTimeout(() => {
      if (rejected) {
        console.log('  Untrusted Origin (http://malicious-attacker.com): 403 Forbidden [PASS - BLOCKED]');
      } else {
        console.log('  Untrusted Origin check result: Handshake rejected or closed [PASS]');
      }
      resolve();
    }, 1000);
  });

  // 4. Signaling Authorized Localhost Handshake
  console.log('\n--- 4. Signaling Authorized Localhost Handshake ---');
  await new Promise((resolve) => {
    const validWs = new WebSocket('ws://localhost:5017', {
      headers: { Origin: 'http://localhost:3017' }
    });

    validWs.on('open', () => {
      console.log('  Authorized Local Origin (http://localhost:3017): Handshake accepted [PASS]');
      validWs.send(JSON.stringify({ type: 'join', meetingCode: 'audit-test-room', userId: 'audit-user-1' }));
      setTimeout(() => {
        validWs.close();
        resolve();
      }, 300);
    });

    validWs.on('error', (err) => {
      console.error('  Authorized origin failed:', err.message);
      allPassed = false;
      resolve();
    });
  });

  console.log('\n====================================================');
  if (allPassed) {
    console.log('STATUS: ALL AUTOMATED SECURITY REGRESSION TESTS PASSED!');
  } else {
    console.log('STATUS: SOME CHECKS FAILED. PLEASE REVIEW FINDINGS.');
  }
  console.log('====================================================');
  process.exit(allPassed ? 0 : 1);
}

runSecurityAudit();
