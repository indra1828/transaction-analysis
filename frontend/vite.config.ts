/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The backend session cookie is set on the same origin as the app, so
// requests to /api are proxied to the FastAPI server during development.
// changeOrigin: false keeps the browser's Host header (localhost:5173). The
// backend builds the Google redirect_uri from that Host, so it must stay
// the address registered in the Google OAuth client.
const backend = { target: "http://127.0.0.1:8000", changeOrigin: false };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": backend,
      "/docs": backend,
      "/openapi.json": backend,
    },
  },
  test: {
    environment: "jsdom",
  },
});
