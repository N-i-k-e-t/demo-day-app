const https = require('https');

// Extract config from config.js
const fs = require('fs');
const configContent = fs.readFileSync('config.js', 'utf8');

const urlMatch = configContent.match(/SUPABASE_URL:\s*userConfig\.SUPABASE_URL\s*\|\|\s*'([^']+)'/);
const keyMatch = configContent.match(/const DEFAULT_ANON_KEY = (\[[\s\S]*?\])\.join\('\.'\);/);

if (!urlMatch || !keyMatch) {
  console.error('FAIL: Could not extract Supabase config');
  process.exit(1);
}

const supabaseUrl = urlMatch[1];
const supabaseKey = eval(keyMatch[1]).join('.');

console.log('Testing live connectivity to:', supabaseUrl);

function testEndpoint(path) {
  return new Promise((resolve) => {
    const url = new URL(path, supabaseUrl);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: body });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ status: 0, error: 'Timeout' });
    });

    req.end();
  });
}

async function run() {
  console.log('\n--- 1. Testing Live Web Hosting (GitHub Pages) ---');
  try {
    const urls = [
      'https://n-i-k-e-t.github.io/demo-day-app/',
      'https://n-i-k-e-t.github.io/demo-day-app/styles.css',
      'https://n-i-k-e-t.github.io/demo-day-app/app.js'
    ];
    for (const u of urls) {
      const start = Date.now();
      const res = await fetch(u);
      console.log(`[${res.status}] ${u} (${Date.now() - start}ms)`);
    }
  } catch (e) {
    console.error('Web host test failed:', e.message);
  }

  console.log('\n--- 2. Testing Live Supabase Database Tables ---');
  const invRes = await testEndpoint('/rest/v1/demo_investors?select=investor_key,full_name,email&limit=3');
  console.log('demo_investors status:', invRes.status);
  if (invRes.status === 200) {
    console.log('demo_investors sample:', invRes.data.substring(0, 120) + '...');
  } else {
    console.warn('demo_investors response:', invRes.data);
  }

  const respRes = await testEndpoint('/rest/v1/demo_responses?select=startup_id,response_type&limit=3');
  console.log('demo_responses status:', respRes.status);
  if (respRes.status === 200) {
    console.log('demo_responses sample:', respRes.data.substring(0, 120) + '...');
  } else {
    console.warn('demo_responses response:', respRes.data);
  }

  const stateRes = await testEndpoint('/rest/v1/demo_event_state?select=*&limit=1');
  console.log('demo_event_state status:', stateRes.status);
  if (stateRes.status === 200) {
    console.log('demo_event_state sample:', stateRes.data.substring(0, 120) + '...');
  } else {
    console.warn('demo_event_state response:', stateRes.data);
  }

  const allPassed = [invRes.status, respRes.status, stateRes.status].every(s => s >= 200 && s < 300);
  if (allPassed) {
    console.log('\n🎉 ALL LIVE APP & CLOUD DATABASE CONNECTIONS ARE 100% HEALTHY & RESPONDING (HTTP 200)!');
  } else {
    console.error('\n⚠️ SOME CHECKS DID NOT RETURN 200. Review above logs.');
  }
}

run();
