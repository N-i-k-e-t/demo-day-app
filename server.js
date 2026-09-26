/**
 * Production Static Server (Zero-Dependency Node.js)
 * High-performance, production-ready static file server with gzip compression,
 * security headers, SPA fallback routing, and health checks.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const metricsService = require('./metrics-service');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://*.supabase.co wss://*.supabase.co data: blob:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:;"
};

function getCacheControl(filePath) {
  const base = path.basename(filePath);
  if (base === 'sw.js') {
    return 'public, max-age=0, must-revalidate';
  }
  if (base === 'manifest.webmanifest') {
    return 'public, max-age=86400';
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'no-cache, no-store, must-revalidate';
  }
  const ext = path.extname(filePath).toLowerCase();
  if (['.css', '.js', '.png', '.svg', '.jpg', '.woff', '.woff2'].includes(ext)) {
    return 'public, max-age=3600, must-revalidate';
  }
  return 'public, max-age=0, must-revalidate';
}

const server = http.createServer((req, res) => {
  // Security Headers
  Object.entries(SECURITY_HEADERS).forEach(([key, val]) => res.setHeader(key, val));

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Healthcheck endpoint
  if (pathname === '/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'demo-day-app',
      version: '2.1.0'
    }));
    return;
  }

  // Handle Admin Metrics API Endpoints
  if (pathname.startsWith('/admin/metrics')) {
    const origin = req.headers.origin || 'http://localhost:8080';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-passcode, x-admin-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    metricsService.handleMetricsApiRoute(req, res).catch(err => {
      console.error('[Server] Metrics route error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Prevent directory traversal attacks
  let safePath = path.normalize(path.join(ROOT, pathname));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if target exists
  let stat;
  try {
    stat = fs.statSync(safePath);
  } catch (err) {
    stat = null;
  }

  // SPA fallback: if file does not exist or is a directory without index, serve index.html
  if (!stat || stat.isDirectory()) {
    if (stat && stat.isDirectory()) {
      const indexPath = path.join(safePath, 'index.html');
      if (fs.existsSync(indexPath)) {
        safePath = indexPath;
        stat = fs.statSync(indexPath);
      } else {
        safePath = path.join(ROOT, 'index.html');
        stat = fs.statSync(safePath);
      }
    } else {
      safePath = path.join(ROOT, 'index.html');
      stat = fs.statSync(safePath);
    }
  }

  const ext = path.extname(safePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = getCacheControl(safePath);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);

  // Gzip compression for text/json/svg assets
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const isCompressible = /text|javascript|json|xml|svg/i.test(contentType);

  if (isCompressible && acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.writeHead(200);
    const rawStream = fs.createReadStream(safePath);
    const gzip = zlib.createGzip();
    rawStream.pipe(gzip).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    res.writeHead(200);
    fs.createReadStream(safePath).pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Production Server] Running at http://${HOST}:${PORT}`);
  console.log(`[Healthcheck] http://${HOST}:${PORT}/healthz`);
});

// Graceful termination handling
process.on('SIGTERM', () => {
  console.log('[Production Server] SIGTERM received, closing...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Production Server] SIGINT received, closing...');
  server.close(() => process.exit(0));
});

module.exports = server;
