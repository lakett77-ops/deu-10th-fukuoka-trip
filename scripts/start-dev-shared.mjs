import { spawn } from "node:child_process";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const env = { ...process.env };

const yjs = spawn(npm, ["run", "sync-server"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

const vite = spawn(npm, ["run", "dev"], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

const shutdown = (signal) => {
  if (!yjs.killed) yjs.kill(signal);
  if (!vite.killed) vite.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const exitWhenDone = (code) => {
  shutdown("SIGTERM");
  process.exit(code ?? 0);
};

yjs.on("exit", exitWhenDone);
vite.on("exit", exitWhenDone);
