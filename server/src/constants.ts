/** Keep in sync with `src/mpConfig.js` for client prediction. */

export const MP_DEFAULT_MAP = "courtyard";

export const ARENA = 28;
export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.65;
export const MOVE_SPEED = 9;
export const CROUCH_SPEED_MUL = 0.58;
export const GRAVITY = 32;
export const JUMP_SPEED = 11;
export const PLAYER_MAX_HEALTH = 150;

export const EYE_STAND = PLAYER_HEIGHT;
export const EYE_CROUCH = 0.92;

export const MAG_SIZE = 20;
export const RESERVE_MAX = 200;
export const FIRE_COOLDOWN = 0.075;
export const RELOAD_TIME = 3;

export const AR_DAMAGE_MAX = 8.5;
export const AR_DAMAGE_MIN = 6.5;
export const AR_RAMP_START = 10;
export const AR_RAMP_END = 44;
export const MP_AR_DAMAGE_MUL = 1.56;

export const RESPAWN_DELAY = 3.2;
export const TICK_DT = 0.05;
export const TICK_HZ = 20;

/** Courtyard pillar centers — circle collision XZ. */
export const PILLAR_POSITIONS: [number, number][] = [
  [-10, -8],
  [8, -7],
  [-6, 5],
  [11, 6],
  [-3, 12],
  [6, -12],
  [-12, 10],
  [4, 2],
];
export const PILLAR_RADIUS = 1.12;

export function assaultBodyDamage(dist: number): number {
  const span = AR_RAMP_END - AR_RAMP_START;
  const t =
    span > 1e-6
      ? Math.min(1, Math.max(0, (dist - AR_RAMP_START) / span))
      : 0;
  const raw = AR_DAMAGE_MAX + (AR_DAMAGE_MIN - AR_DAMAGE_MAX) * t;
  return Math.round(raw * MP_AR_DAMAGE_MUL * 10) / 10;
}
