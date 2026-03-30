/**
 * Multiplayer deathmatch slice — keep in sync with `server/src/constants.ts`.
 */
export const MP_DEFAULT_MAP_ID = "courtyard";
export const MP_ALLOWED_PRIMARY_INDEX = 0; // assault rifle
export const MP_PLAYER_HEIGHT = 1.65;

export const MP_ARENA = 28;
export const MP_PLAYER_RADIUS = 0.35;
export const MP_MOVE_SPEED = 9;
export const MP_CROUCH_SPEED_MUL = 0.58;
export const MP_GRAVITY = 32;
export const MP_JUMP_SPEED = 11;
export const MP_PLAYER_MAX_HEALTH = 150;
export const MP_MAG_SIZE = 20;
export const MP_RESERVE_MAX = 200;
export const MP_FIRE_COOLDOWN = 0.075;
export const MP_RELOAD_TIME = 3;

/** Courtyard pillars XZ — circle push (client prediction helper). */
export const MP_PILLAR_POSITIONS = [
  [-10, -8],
  [8, -7],
  [-6, 5],
  [11, 6],
  [-3, 12],
  [6, -12],
  [-12, 10],
  [4, 2],
];
export const MP_PILLAR_RADIUS = 1.12;
