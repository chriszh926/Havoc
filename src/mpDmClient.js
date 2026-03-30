import { io } from "socket.io-client";

let socket = null;
export let mpDmPlayerId = "";
export let mpDmRoomId = "";
export let mpDmMapId = "";

let onState = () => {};
let onWelcome = () => {};
let onDisconnect = () => {};

export function setMpDmHandlers(h) {
  if (h.onState) onState = h.onState;
  if (h.onWelcome) onWelcome = h.onWelcome;
  if (h.onDisconnect) onDisconnect = h.onDisconnect;
}

export function mpDmConnected() {
  return socket?.connected === true;
}

export function disconnectMpDm() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  mpDmPlayerId = "";
  mpDmRoomId = "";
  mpDmMapId = "";
}

/**
 * User-visible hint when the Socket.IO handshake fails (server down, wrong URL, etc.).
 * @param {unknown} err
 * @param {string} baseUrl
 */
function formatConnectionError(err, baseUrl) {
  const raw = err && typeof err === "object" && "message" in err ? String(err.message) : String(err);
  return (
    "Cannot connect to the multiplayer server.\n\n" +
    "1) Open a second terminal in the Havoc project folder.\n" +
    "2) Run:  npm run mp-server\n" +
    "3) Wait for the line showing  http://127.0.0.1:8765  (or your PORT=…).\n" +
    "4) Retry Deploy.\n\n" +
    "If you use npm run dev: leave Server URL as your game URL (e.g. http://localhost:5176).\n" +
    "Vite proxies /socket.io to the mp-server. Direct http://127.0.0.1:8765 also works when\n" +
    "the server is running.\n\n" +
    `Server URL in the menu: ${baseUrl || "(empty)"}\n` +
    `Details: ${raw}`
  );
}

/**
 * @param {string} httpBase e.g. http://127.0.0.1:8765
 * @param {string} roomId
 * @param {string} [displayName]
 */
export function connectMpDm(httpBase, roomId, displayName = "Player") {
  disconnectMpDm();
  return new Promise((resolve, reject) => {
    const base = (httpBase || "").replace(/\/$/, "");
    if (!base) {
      reject(new Error("Server URL is empty. Use e.g. http://127.0.0.1:8765"));
      return;
    }

    let settled = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let to;

    const settleReject = (msg) => {
      if (settled) return;
      settled = true;
      if (to !== undefined) window.clearTimeout(to);
      disconnectMpDm();
      reject(new Error(msg));
    };

    const settleResolve = (w) => {
      if (settled) return;
      settled = true;
      if (to !== undefined) window.clearTimeout(to);
      mpDmPlayerId = w.playerId;
      mpDmRoomId = w.roomId;
      mpDmMapId = w.mapId;
      onWelcome(w);
      resolve(w);
    };

    try {
      socket = io(base, {
        // Polling first avoids some environments where WebSocket upgrade fails immediately.
        transports: ["polling", "websocket"],
        reconnection: false,
        timeout: 12_000,
        forceNew: true,
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    to = window.setTimeout(() => {
      settleReject(
        formatConnectionError(new Error("Connection timed out after 12s"), base)
      );
    }, 12_000);

    socket.once("connect_error", (err) => {
      settleReject(formatConnectionError(err, base));
    });

    socket.once("connect", () => {
      socket.emit("join_room", { room: roomId, name: displayName });
    });

    socket.once("welcome", (w) => {
      settleResolve(w);
    });

    socket.on("room_state", (state) => onState(state));

    socket.on("disconnect", () => {
      onDisconnect();
    });
  });
}

export function mpDmSendInput(payload) {
  socket?.emit("input", payload);
}

export function mpDmSendLook(yaw, pitch) {
  socket?.emit("look", { yaw, pitch });
}

export function mpDmSendFire() {
  socket?.emit("fire");
}

export function mpDmSendReload() {
  socket?.emit("reload");
}

export function mpDmSendSwitchWeapon(slot) {
  socket?.emit("switch_weapon", { slot });
}
