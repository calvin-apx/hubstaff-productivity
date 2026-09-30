import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, Vite serves the UI on :5173 and forwards /api calls to the Node server on :3939.
// Change the proxy target here if you change PORT in .env.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3939" },
  },
});
