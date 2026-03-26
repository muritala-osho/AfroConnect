const http = require("http");
const httpProxy = require("http-proxy");
const fs = require("fs");
const path = require("path");

const GATEWAY_PORT = 5000;
const BACKEND_PORT = 3001;
const EXPO_WEB_PORT = 19006;

const backendProxy = httpProxy.createProxyServer({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

const expoProxy = httpProxy.createProxyServer({
  target: `http://localhost:${EXPO_WEB_PORT}`,
  changeOrigin: true,
  ws: true,
  xfwd: false,
  secure: false,
});

backendProxy.on("error", (err, req, res) => {
  console.error("Backend error:", err.message);
  if (res && res.writeHead) {
    res.writeHead(502, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end(
      JSON.stringify({ error: "Backend unavailable", message: err.message }),
    );
  }
});

expoProxy.on("error", (err, req, res) => {
  console.error("Expo error:", err.message);
  if (res && res.writeHead) {
    res.writeHead(502, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    res.end(JSON.stringify({ error: "Frontend unavailable" }));
  }
});

expoProxy.on("proxyReq", (proxyReq) => {
  proxyReq.setHeader("Host", `localhost:${EXPO_WEB_PORT}`);
});

// Helper to serve static files for the web admin dashboard
const serveStatic = (req, res) => {
  const reqPath = req.url.split("?")[0];
  const relativePath = reqPath.replace("/admin-web", "") || "/";
  let filePath = path.join(__dirname, "admin-dashboard", relativePath);

  if (reqPath === "/admin-web" || reqPath === "/admin-web/") {
    filePath = path.join(__dirname, "admin-dashboard", "index.html");
  }

  const extname = path.extname(filePath);
  let contentType = "text/html";
  switch (extname) {
    case ".js":
      contentType = "text/javascript";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
    case ".jpeg":
      contentType = "image/jpeg";
      break;
    case ".svg":
      contentType = "image/svg+xml";
      break;
    case ".ico":
      contentType = "image/x-icon";
      break;
    case ".woff":
      contentType = "font/woff";
      break;
    case ".woff2":
      contentType = "font/woff2";
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == "ENOENT") {
        if (!extname || extname === ".html") {
          fs.readFile(
            path.join(__dirname, "admin-dashboard", "index.html"),
            (err2, fallback) => {
              if (err2) {
                res.writeHead(404);
                res.end("Admin dashboard not found");
              } else {
                res.writeHead(200, {
                  "Content-Type": "text/html",
                  "Cache-Control": "no-cache",
                });
                res.end(fallback, "utf-8");
              }
            },
          );
        } else {
          res.writeHead(404);
          res.end("File not found");
        }
      } else {
        res.writeHead(500);
        res.end("Server error: " + error.code);
      }
    } else {
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": extname ? "public, max-age=3600" : "no-cache",
      });
      res.end(content, "utf-8");
    }
  });
};

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;
  console.log(`[GATEWAY] ${method} ${url}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  const cleanUrl = url.split("?")[0];
  if (
    cleanUrl === "/admin-web" ||
    cleanUrl.startsWith("/admin-web/") ||
    cleanUrl.startsWith("/admin-web.")
  ) {
    serveStatic(req, res);
  } else if (cleanUrl.startsWith("/assets/")) {
    const assetsDir = path.join(__dirname, "assets");
    const assetPath = path.resolve(path.join(__dirname, cleanUrl));
    if (!assetPath.startsWith(assetsDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const extname = path.extname(assetPath);
    let ct = "application/octet-stream";
    if (extname === ".png") ct = "image/png";
    else if (extname === ".jpg" || extname === ".jpeg") ct = "image/jpeg";
    else if (extname === ".svg") ct = "image/svg+xml";
    else if (extname === ".gif") ct = "image/gif";
    fs.readFile(assetPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
      } else {
        res.writeHead(200, {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=86400",
        });
        res.end(content);
      }
    });
  } else if (url.startsWith("/public/")) {
    console.log(`[GATEWAY] Routing ${method} ${url} to BACKEND (static)`);
    backendProxy.web(req, res);
  } else if (url.startsWith("/api/") || url.startsWith("/socket.io/")) {
    console.log(`[GATEWAY] Routing ${method} ${url} to BACKEND`);
    backendProxy.web(req, res);
  } else if (url === "/api" || url === "/socket.io") {
    console.log(`[GATEWAY] Routing ${method} ${url} to BACKEND`);
    backendProxy.web(req, res);
  } else {
    expoProxy.web(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/socket.io")) {
    backendProxy.ws(req, socket, head);
  } else {
    expoProxy.ws(req, socket, head);
  }
});

server.listen(GATEWAY_PORT, "0.0.0.0", () => {
  console.log(`✅ Gateway running on port ${GATEWAY_PORT}`);
});
