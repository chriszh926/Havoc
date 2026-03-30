import { defineConfig } from "vite";

/** Where the authoritative mp-server listens (must match `npm run mp-server`). */
const MP_SERVER_ORIGIN =
  process.env.VITE_MP_PROXY_TARGET || "http://127.0.0.1:8765";

export default defineConfig({
  server: {
    open: true,
    port: 5173,
    // Same-origin Socket.IO in dev: client uses `window.location.origin` so polling/WebSocket
    // go through Vite and are forwarded here — avoids some cross-port / xhr poll issues.
    proxy: {
      "/socket.io": {
        target: MP_SERVER_ORIGIN,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
