const { createServer } = require("http");
const { createReadStream, existsSync } = require("fs");
const next = require("next");
const path = require("path");
const { Server } = require("socket.io");
const { setIO } = require("./lib/realtime.cjs");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || (dev ? "127.0.0.1" : "0.0.0.0");
const port = Number(process.env.PORT || 3000);
const internalHost = hostname === "0.0.0.0" ? "127.0.0.1" : hostname;

const app = next({ dev, hostname: internalHost, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  let io;
  const httpServer = createServer(async (req, res) => {
    if ((req.method === "GET" || req.method === "HEAD") && req.url?.startsWith("/maps/")) {
      const pathname = decodeURIComponent(new URL(req.url, `http://${internalHost}:${port}`).pathname);
      const publicMapsPath = path.join(process.cwd(), "public", "maps");
      const filePath = path.normalize(path.join(process.cwd(), "public", pathname));

      if (!filePath.startsWith(publicMapsPath) || !existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const contentType = getContentType(filePath);
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=0, must-revalidate" });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      createReadStream(filePath).pipe(res);
      return;
    }

    if (req.method === "POST" && req.url?.startsWith("/api/realtime/emit")) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const { event, payload } = JSON.parse(body || "{}");
          if (event && io) {
            io.emit(event, payload || {});
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
      return;
    }

    await handle(req, res);
  });
  io = new Server(httpServer, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    socket.emit("server:ready", { ok: true });
  });

  setIO(io);

  httpServer.listen(port, hostname, () => {
    console.log(`Smart Parking app ready at http://${hostname}:${port}`);
  });
});

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  };

  return types[extension] || "application/octet-stream";
}
