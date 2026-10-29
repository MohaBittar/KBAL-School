// Minimal static file server for local development (no dependencies).
// Usage:  node server.js   →  http://localhost:5000
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 5000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".md": "text/plain; charset=utf-8",
  ".rules": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/" || p === "") p = "/index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found: " + p); }
      res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    });
  })
  .listen(port, () => {
    const url = "http://localhost:" + port;
    console.log("KBAL-School running at " + url);
    console.log("Open that address in your browser (do NOT open index.html as a file).");
    console.log("Press Ctrl+C to stop the server.");

    // Open the default browser once, unless OPEN_BROWSER=0
    if (process.env.OPEN_BROWSER !== "0") {
      const { exec } = require("child_process");
      const cmd =
        process.platform === "win32"
          ? `start "" "${url}"`
          : process.platform === "darwin"
            ? `open "${url}"`
            : `xdg-open "${url}"`;
      setTimeout(() => exec(cmd), 400);
    }
  });
