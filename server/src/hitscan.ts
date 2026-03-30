import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  EYE_STAND,
  EYE_CROUCH,
} from "./constants.js";
import type { PlayerInternal } from "./types.js";

export type HitResult = { target: PlayerInternal; headshot: boolean; dist: number };

const HEAD_CENTER_Y = 1.32;
const HEAD_RADIUS = 0.14;
const BODY_R = PLAYER_RADIUS * 0.95;

function aimDir(yaw: number, pitch: number) {
  const dx = -Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * Math.cos(pitch);
  return { dx, dy, dz };
}

function raySphere(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number
): number | null {
  const fx = ox - cx;
  const fy = oy - cy;
  const fz = oz - cz;
  const b = fx * dx + fy * dy + fz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  if (c < 0 && b * b < c) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  const t1 = -b + s;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return t1;
  return null;
}

/** Vertical capsule (body) + head sphere; feet at p.y */
function rayPlayer(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  p: PlayerInternal,
  crouch: number
): { t: number; head: boolean } | null {
  const feet = p.y;
  const eyeOfs = EYE_STAND + (EYE_CROUCH - EYE_STAND) * crouch;
  const hx = p.x;
  const hz = p.z;
  const hy = feet + HEAD_CENTER_Y * (1 - crouch * 0.12);

  const ht = raySphere(ox, oy, oz, dx, dy, dz, hx, hy, hz, HEAD_RADIUS);
  let best: { t: number; head: boolean } | null = null;
  if (ht != null) best = { t: ht, head: true };

  const cylY0 = feet + PLAYER_RADIUS * 0.8;
  const cylY1 = feet + PLAYER_HEIGHT * 0.92;
  const oxr = ox - p.x;
  const ozr = oz - p.z;
  const rdx = dx;
  const rdz = dz;
  const a = rdx * rdx + rdz * rdz;
  if (a < 1e-8) {
    return best;
  }
  const b2 = 2 * (oxr * rdx + ozr * rdz);
  const c2 = oxr * oxr + ozr * ozr - BODY_R * BODY_R;
  const disc = b2 * b2 - 4 * a * c2;
  if (disc < 0) return best;
  const s = Math.sqrt(disc);
  let tNear = (-b2 - s) / (2 * a);
  let tFar = (-b2 + s) / (2 * a);
  if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
  for (const t of [tNear, tFar]) {
    if (t < 0) continue;
    const iy = oy + t * dy;
    if (iy >= cylY0 && iy <= cylY1) {
      if (!best || t < best.t) best = { t, head: false };
      break;
    }
  }
  return best;
}

export function hitscanPlayers(
  shooter: PlayerInternal,
  players: PlayerInternal[]
): HitResult | null {
  const crouch = shooter.crouch;
  const eyeOfs = EYE_STAND + (EYE_CROUCH - EYE_STAND) * crouch;
  const ox = shooter.x;
  const oy = shooter.y + eyeOfs;
  const oz = shooter.z;
  const { dx, dy, dz } = aimDir(shooter.yaw, shooter.pitch);
  let best: HitResult | null = null;

  for (const q of players) {
    if (q.id === shooter.id || q.dead) continue;
    const hit = rayPlayer(ox, oy, oz, dx, dy, dz, q, q.crouch);
    if (!hit) continue;
    if (!best || hit.t < best.dist) {
      best = {
        target: q,
        headshot: hit.head,
        dist: hit.t,
      };
    }
  }
  return best;
}
