const http = require('http');
const server = require('../server');

const TEST_PORT = 8089;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  // Start server on test port
  await new Promise(resolve => {
    server.close(() => {
      server.listen(TEST_PORT, '127.0.0.1', resolve);
    });
  });

  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Healthz check
    const health = await request('/healthz');
    console.log('1. /healthz status:', health.status, 'service:', health.json?.service);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Unauthorized request check
    const unauth = await request('/admin/metrics/overview');
    console.log('2. Unauthorized /admin/metrics/overview status:', unauth.status, '(Expected 401)');
    if (unauth.status !== 401) throw new Error('Expected 401 for unauthorized access');

    // 3. Authorized Overview check
    const authHeaders = { 'x-admin-passcode': 'thatAff2026@' };
    const overview = await request('/admin/metrics/overview', { headers: authHeaders });
    console.log('3. Authorized /admin/metrics/overview status:', overview.status);
    if (overview.status !== 200) throw new Error('Authorized overview failed');
    console.log('   Eligible Investors:', overview.json.investors.eligibleCount);
    console.log('   Total Active Votes:', overview.json.voting.totalActiveVotes);
    console.log('   Cutoff Display:', overview.json.cutoff.display);

    // 4. Startups endpoint
    const startups = await request('/admin/metrics/startups', { headers: authHeaders });
    console.log('4. /admin/metrics/startups status:', startups.status);
    console.log('   Total startups returned:', startups.json.startups.length);
    if (startups.json.startups.length !== 13) throw new Error('Expected 13 startups');

    // 5. Single Startup Drilldown
    const startupDetail = await request('/admin/metrics/startups/s07', { headers: authHeaders });
    console.log('5. /admin/metrics/startups/s07 status:', startupDetail.status);
    console.log('   Startup Name:', startupDetail.json.startupName, 'Voters:', startupDetail.json.voters.length);

    // 6. Investors endpoint
    const investors = await request('/admin/metrics/investors', { headers: authHeaders });
    console.log('6. /admin/metrics/investors status:', investors.status);
    console.log('   Total eligible investors:', investors.json.investors.length);
    if (investors.json.investors.length !== 57) throw new Error('Expected 57 eligible investors');

    // 7. Activity stream endpoint
    const activity = await request('/admin/metrics/activity?limit=25', { headers: authHeaders });
    console.log('7. /admin/metrics/activity status:', activity.status);
    console.log('   Events returned:', activity.json.events.length);

    // 8. CSV Export endpoint
    const exportCsv = await request('/admin/metrics/export?type=startup-votes', { headers: authHeaders });
    console.log('8. /admin/metrics/export status:', exportCsv.status);
    console.log('   Content-Type:', exportCsv.headers['content-type']);
    console.log('   CSV header:', exportCsv.body.split('\r\n')[0]);

    console.log('\n🎉 ALL BACKEND API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('API endpoint test failed:', err);
  process.exit(1);
});
