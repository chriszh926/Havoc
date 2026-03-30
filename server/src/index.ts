import { createServer } from "http";
import { Server } from "socket.io";
import { GameRoom } from "./room.js";
import { TICK_DT } from "./constants.js";
import type { ClientInput } from "./types.js";

const PORT = Number(process.env.PORT) || 8765;
const rooms = new Map<string, GameRoom>();
const socketRoom = new Map<string, string>();

function getRoom(roomId: string) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new GameRoom(roomId));
  }
  return rooms.get(roomId)!;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  socket.on("join_room", (msg: { room?: string; name?: string }) => {
    const raw =
      String(msg?.room || "default")
        .replace(/[^\w-]/g, "")
        .slice(0, 48) || "default";
    const displayName = String(msg?.name || "Player").slice(0, 24);
    const room = getRoom(raw);
    void socket.join(raw);
    socketRoom.set(socket.id, raw);
    room.addPlayer(socket.id, displayName);
    socket.emit("welcome", {
      playerId: socket.id,
      roomId: raw,
      mapId: room.mapId,
    });
    socket.to(raw).emit("player_joined", {
      playerId: socket.id,
      name: displayName,
    });
  });

  socket.on(
    "input",
    (msg: {
      seq?: number;
      mx?: number;
      mz?: number;
      jump?: boolean;
      crouch?: boolean;
    }) => {
      const rid = socketRoom.get(socket.id);
      if (!rid) return;
      const room = rooms.get(rid);
      if (!room) return;
      const inp: ClientInput = {
        seq: typeof msg?.seq === "number" ? msg.seq : 0,
        mx: Math.max(-1, Math.min(1, Number(msg?.mx) || 0)),
        mz: Math.max(-1, Math.min(1, Number(msg?.mz) || 0)),
        jump: !!msg?.jump,
        crouch: !!msg?.crouch,
      };
      room.setInput(socket.id, inp);
    }
  );

  socket.on("look", (msg: { yaw?: number; pitch?: number }) => {
    const rid = socketRoom.get(socket.id);
    if (!rid) return;
    const room = rooms.get(rid);
    const p = room?.players.get(socket.id);
    if (!p || p.dead) return;
    if (typeof msg?.yaw === "number") {
      p.yaw = msg.yaw;
    }
    if (typeof msg?.pitch === "number") {
      p.pitch = Math.max(-1.55, Math.min(1.55, msg.pitch));
    }
  });

  socket.on("fire", () => {
    const rid = socketRoom.get(socket.id);
    if (!rid) return;
    const room = rooms.get(rid);
    if (!room) return;
    room.queueFire(socket.id);
  });

  socket.on("reload", () => {
    const rid = socketRoom.get(socket.id);
    if (!rid) return;
    const room = rooms.get(rid);
    if (!room) return;
    room.queueReload(socket.id);
  });

  socket.on("switch_weapon", () => {
    /* Deathmatch v1 only supports primary. */
  });

  socket.on("disconnect", () => {
    const rid = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    if (!rid) return;
    const room = rooms.get(rid);
    if (!room) return;
    room.removePlayer(socket.id);
    io.to(rid).emit("player_left", { playerId: socket.id });
    if (room.players.size === 0) {
      rooms.delete(rid);
    }
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    room.tickSim();
    io.to(room.id).emit("room_state", room.snapshot());
  }
}, TICK_DT * 1000);

httpServer.listen(PORT, () => {
  console.log(
    `[havoc-mp] Socket.IO authoritative server at http://127.0.0.1:${PORT} (PORT=${PORT})`
  );
});
