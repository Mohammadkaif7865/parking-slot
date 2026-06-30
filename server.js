const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const { setIO } = require("./lib/realtime.cjs");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  let io;
  const httpServer = createServer(async (req, res) => {
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
