import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Temporary: same as vite.config.ts but proxies to a test backend on port 8100.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:8100", changeOrigin: false },
    },
  },
});
