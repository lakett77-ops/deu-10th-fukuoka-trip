import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/deu-10th-fukuoka-trip/" : "/",
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/yjs": {
        target: "ws://127.0.0.1:1234",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yjs/, ""),
      },
    },
  },
});
