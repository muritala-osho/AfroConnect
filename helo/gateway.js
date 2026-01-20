const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const GATEWAY_PORT = 5000;
const BACKEND_PORT = 3001;
const EXPO_WEB_PORT = 3002;

// Create proxy instances
const backendProxy = httpProxy.createProxyServer({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  ws: true,
  xfwd: true
});

const expoProxy = httpProxy.createProxyServer({
  target: `http://localhost:${EXPO_WEB_PORT}`,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  secure: false
});

// Error handlers
backendProxy.on('error', (err, req, res) => {
  console.error('Backend error:', err.message);
  if (res && res.writeHead) {
    res.writeHead(502, { 
      'Content-Type': 'application/json', 
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify({ error: 'Backend unavailable', message: err.message }));
  }
});

expoProxy.on('error', (err, req, res) => {
  console.error('Expo error:', err.message);
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ error: 'Frontend unavailable' }));
  }
});

// Helper to serve static files for the web admin dashboard
const serveStatic = (req, res) => {
  let filePath = path.join(__dirname, 'admin-dashboard', req.url.replace('/admin-web', ''));
  if (req.url === '/admin-web' || req.url === '/admin-web/') {
    filePath = path.join(__dirname, 'admin-dashboard', 'index.html');
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js': contentType = 'text/javascript'; break;
    case '.css': contentType = 'text/css'; break;
    case '.json': contentType = 'application/json'; break;
    case '.png': contentType = 'image/png'; break;
    case '.jpg': contentType = 'image/jpg'; break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
};

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  console.log(`[GATEWAY] ${method} ${url}`);

  if (url.startsWith('/admin-web')) {
    serveStatic(req, res);
  } else if (url.startsWith('/api/') || url.startsWith('/socket.io/')) {
    // Forward /api and /socket.io to backend (port 3001)
    console.log(`[GATEWAY] Routing ${method} ${url} to BACKEND`);
    backendProxy.web(req, res);
  } else if (url === '/api' || url === '/socket.io') {
    console.log(`[GATEWAY] Routing ${method} ${url} to BACKEND`);
    backendProxy.web(req, res);
  } else {
    // For Expo web, we need to ensure the Host header matches what Expo expects
    req.headers['host'] = `localhost:${EXPO_WEB_PORT}`;
    expoProxy.web(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/socket.io')) {
    backendProxy.ws(req, socket, head);
  } else {
    expoProxy.ws(req, socket, head);
  }
});

server.listen(GATEWAY_PORT, '0.0.0.0', () => {
  console.log(`✅ Gateway running on port ${GATEWAY_PORT}`);
});