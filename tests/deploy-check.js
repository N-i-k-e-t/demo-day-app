const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    console.error(`✗ ${message}`);
    failures++;
  }
}

console.log('--- 1. Validating Code Syntax ---');
['app.js', 'sw.js', 'config.js', 'server.js'].forEach(file => {
  const filePath = path.join(root, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    new Function(content);
    assert(true, `${file} syntax is valid`);
  } catch (err) {
    assert(false, `${file} syntax error: ${err.message}`);
  }
});

console.log('\n--- 2. Validating JSON Files ---');
['package.json', 'vercel.json', 'manifest.webmanifest', 'realtime-contract.json', 'healthz.json'].forEach(file => {
  const filePath = path.join(root, file);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    JSON.parse(raw);
    assert(true, `${file} is valid JSON`);
  } catch (err) {
    assert(false, `${file} JSON error: ${err.message}`);
  }
});

console.log('\n--- 3. Validating Deployment & Platform Files ---');
[
  'Dockerfile',
  'nginx.conf',
  '.dockerignore',
  'docker-compose.yml',
  'netlify.toml',
  '.env.example',
  'assets/icon.svg'
].forEach(file => {
  const filePath = path.join(root, file);
  assert(fs.existsSync(filePath), `${file} exists`);
});

console.log('\n--- 4. Validating Production Server & Healthcheck ---');
process.env.PORT = '9876';
process.env.HOST = '127.0.0.1';
const server = require(path.join(root, 'server.js'));

setTimeout(() => {
  const req = http.get('http://127.0.0.1:9876/healthz', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        assert(res.statusCode === 200, `Healthcheck returned HTTP 200`);
        assert(json.status === 'healthy', `Healthcheck returned status: ${json.status}`);
        assert(json.service === 'demo-day-app', `Healthcheck reported correct service name`);
      } catch (err) {
        assert(false, `Healthcheck response parse error: ${err.message}`);
      }
      server.close(() => {
        finish();
      });
    });
  });

  req.on('error', (err) => {
    assert(false, `Failed to query local healthcheck: ${err.message}`);
    server.close(() => {
      finish();
    });
  });
}, 300);

function finish() {
  console.log('\n========================================');
  if (failures === 0) {
    console.log('🎉 ALL PRODUCTION DEPLOYMENT CHECKS PASSED!');
    console.log('========================================');
    process.exit(0);
  } else {
    console.error(`💥 ${failures} check(s) failed.`);
    console.log('========================================');
    process.exit(1);
  }
}
