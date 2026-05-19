import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const env = {
  ...process.env,
  HOST: "127.0.0.1",
  PORT: "1234",
  YPERSISTENCE: "./yjs-db",
};

const serverPath = resolve(process.cwd(), "node_modules/@y/websocket-server/src/server.js");
const child = spawn("node", [serverPath], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  windowsHide: true,
});

const shutdown = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
