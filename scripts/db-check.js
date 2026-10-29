const https = require('https');
const fs = require('fs');
const path = require('path');

const ENV_LOCAL = path.join(__dirname, '..', '.env.local');

function readEnvVar(name) {
  if (fs.existsSync(ENV_LOCAL)) {
    const content = fs.readFileSync(ENV_LOCAL, 'utf8');
    const match = content.match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (match) return match[1].trim();
  }
  return process.env[name] || '';
}

const supabaseUrl = readEnvVar('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const supabaseKey = readEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local');
  process.exit(1);
}

const tables = [
  'profiles',
  'meetings',
  'meeting_participants',
  'meeting_invitations',
  'meeting_messages',
  'meeting_files',
  'whiteboards',
  'whiteboard_items',
  'notifications',
];

function checkTable(table) {
  return new Promise((resolve) => {
    const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
    const req = https.get(
      url,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ table, status: 'EXISTS', code: res.statusCode });
          } else if (res.statusCode === 404 && body.includes('PGRST205')) {
            resolve({ table, status: 'MISSING (Table not found)', code: res.statusCode });
          } else {
            resolve({ table, status: `HTTP ${res.statusCode}`, code: res.statusCode, body: body.slice(0, 100) });
          }
        });
      }
    );
    req.on('error', (err) => {
      resolve({ table, status: `ERROR: ${err.message}`, code: 0 });
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log(' ConnectSpace - Supabase PostgreSQL Schema Check');
  console.log('====================================================');
  console.log(`Target Supabase URL: ${supabaseUrl}`);
  console.log('Checking required database tables in public schema...\n');

  const results = await Promise.all(tables.map(checkTable));
  let allExist = true;

  for (const r of results) {
    const symbol = r.status === 'EXISTS' ? '✓' : '✗';
    console.log(`  ${symbol} public.${r.table.padEnd(22)} : ${r.status}`);
    if (r.status !== 'EXISTS') {
      allExist = false;
    }
  }

  console.log('\n====================================================');
  if (allExist) {
    console.log('STATUS: ALL 9 REQUIRED TABLES EXIST IN SUPABASE!');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.log('STATUS: MISSING TABLES DETECTED IN SUPABASE DATABASE.');
    console.log('Action: Apply the migration script in Supabase SQL Editor:');
    console.log('  File: supabase/migrations/20261021000001_consolidated_schema.sql');
    console.log('====================================================');
    process.exit(1);
  }
}

main().catch(console.error);
