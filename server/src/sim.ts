import {
  ARENA,
  PLAYER_RADIUS,
  MOVE_SPEED,
  CROUCH_SPEED_MUL,
  GRAVITY,
  JUMP_SPEED,
  PILLAR_POSITIONS,
  PILLAR_RADIUS,
} from "./constants.js";
import type { ClientInput, PlayerInternal } from "./types.js";

const CROUCH_SMOOTH = 14;

export function clampArena(x: number, z: number) {
  const max = ARENA - PLAYER_RADIUS - 0.5;
  return {
    x: Math.min(max, Math.max(-max, x)),
    z: Math.min(max, Math.max(-max, z)),
  };
}

function resolvePillars(x: number, z: number) {
  let px = x;
  let pz = z;
  const minD = PILLAR_RADIUS + PLAYER_RADIUS;
  for (const [cx, cz] of PILLAR_POSITIONS) {
    const dx = px - cx;
    const dz = pz - cz;
    const d = Math.hypot(dx, dz) || 1e-4;
    if (d < minD) {
      const push = (minD - d) / d;
      px += dx * push;
      pz += dz * push;
    }
  }
  return { x: px, z: pz };
}

export function stepPlayer(
  p: PlayerInternal,
  input: ClientInput | undefined,
  dt: number
) {
  if (p.dead) {
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    return;
  }

  const wantCrouch = !!(input?.crouch);
  const ck = 1 - Math.exp(-CROUCH_SMOOTH * dt);
  if (wantCrouch) {
    p.crouch = Math.min(1, p.crouch + (1 - p.crouch) * ck);
  } else {
    p.crouch *= 1 - ck;
  }

  const moveMul = 1 + (CROUCH_SPEED_MUL - 1) * p.crouch;

  const yaw = p.yaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);

  let mx = 0;
  let mz = 0;
  if (input) {
    mx = input.mx;
    mz = input.mz;
  }
  const mlen = Math.hypot(mx, mz);
  if (mlen > 1e-5) {
    mx /= mlen;
    mz /= mlen;
  }

  const wx = (fx * mx + rx * mz) * MOVE_SPEED * moveMul;
  const wz = (fz * mx + rz * mz) * MOVE_SPEED * moveMul;

  p.x += wx * dt;
  p.z += wz * dt;
  const cl = clampArena(p.x, p.z);
  p.x = cl.x;
  p.z = cl.z;
  const pil = resolvePillars(p.x, p.z);
  p.x = pil.x;
  p.z = pil.z;
  const cl2 = clampArena(p.x, p.z);
  p.x = cl2.x;
  p.z = cl2.z;

  p.vy -= GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y < 0) {
    p.y = 0;
    p.vy = 0;
  }

  if (input?.jump && p.y <= 0.001 && !wantCrouch) {
    p.vy = JUMP_SPEED;
  }

  p.vx = wx;
  p.vz = wz;
}
