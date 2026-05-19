import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import process from "node:process";
import { Level } from "level";
import { WebSocketServer } from "ws";
import {
  getYDoc,
  setContentInitializor,
  setPersistence,
  setupWSConnection,
} from "@y/websocket-server/utils";
import * as Y from "../node_modules/@y/websocket-server/node_modules/yjs/src/index.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = resolve(process.cwd(), "dist");
const PERSISTENCE_DIR = resolve(process.cwd(), process.env.YPERSISTENCE || "yjs-prod-db");
const DEFAULT_ROOM = "deu-10th-fukuoka-trip";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const persistence = new Level(PERSISTENCE_DIR, { valueEncoding: "json" });
await persistence.open();

setPersistence({
  bindState: (docName, doc) => {
    doc.on("update", (update) => {
      const encoded = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
      void persistence.put(docName, {
        updatedAt: Date.now(),
        updateBase64: encoded,
      });
    });
  },
  writeState: async (docName, doc) => {
    await persistence.put(docName, {
      updatedAt: Date.now(),
      updateBase64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    });
  },
});

setContentInitializor(async (doc) => {
  try {
    const record = await persistence.get(doc.name);
    if (record?.updateBase64) {
      const update = Buffer.from(record.updateBase64, "base64");
      if (update.byteLength > 0) {
        Y.applyUpdate(doc, update);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Failed to load persisted room ${doc.name}`, error);
    }
  }
});

const wss = new WebSocketServer({ noServer: true });

const send = (res, statusCode, body, headers = {}) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const serveFile = async (res, filePath) => {
  const buffer = await readFile(filePath);
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";
  send(res, 200, buffer, {
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
  });
};

const resolvePublicPath = (pathname) => {
  const safePath = pathname.replace(/^\/+/, "");
  const resolved = resolve(PUBLIC_DIR, safePath || "index.html");
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return null;
  }
  return resolved;
};

const handleRequest = async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (url.pathname === "/healthz") {
    send(res, 200, "ok", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (url.pathname.startsWith("/yjs")) {
    send(res, 200, "websocket endpoint", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  const initialPath = url.pathname === "/" ? "/index.html" : url.pathname;
  let filePath = resolvePublicPath(initialPath);
  if (filePath === null) {
    send(res, 400, "Bad Request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  const exists = await stat(filePath)
    .then((entry) => entry.isFile())
    .catch(() => false);

  if (!exists) {
    if (extname(initialPath)) {
      send(res, 404, "Not Found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    filePath = resolve(PUBLIC_DIR, "index.html");
  }

  await serveFile(res, filePath);
};

const server = createServer((req, res) => {
  void handleRequest(req, res).catch((error) => {
    console.error("Request failed:", error);
    if (!res.headersSent) {
      send(res, 500, "Internal Server Error", {
        "Content-Type": "text/plain; charset=utf-8",
      });
      return;
    }
    res.destroy(error);
  });
});

server.on("upgrade", async (request, socket, head) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (!url.pathname.startsWith("/yjs")) {
      socket.destroy();
      return;
    }

    const roomName = decodeURIComponent(url.pathname.replace(/^\/yjs\/?/, "")) || DEFAULT_ROOM;
    const doc = getYDoc(roomName);
    await doc.whenInitialized;

    wss.handleUpgrade(request, socket, head, (ws) => {
      setupWSConnection(ws, request, { docName: roomName });
    });
  } catch (error) {
    console.error("WebSocket upgrade failed:", error);
    socket.destroy();
  }
});

const shutdown = () => {
  server.close(() => {
    wss.close();
    void persistence.close();
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await stat(resolve(PUBLIC_DIR, "index.html"));

server.listen(PORT, HOST, () => {
  console.log(`Production server running at http://${HOST}:${PORT}`);
});
