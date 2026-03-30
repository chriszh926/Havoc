export type ClientInput = {
  seq: number;
  /** Movement intent -1..1 from WASD (server normalizes). */
  mx: number;
  mz: number;
  jump: boolean;
  crouch: boolean;
};

export type PlayerPublic = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  pitch: number;
  health: number;
  dead: boolean;
  respawnIn: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  reloadLeft: number;
  kills: number;
  deaths: number;
  /** Crouch 0–1 smoothed (for eye height). */
  crouch: number;
};

export type PlayerInternal = PlayerPublic & {
  fireCd: number;
  wantFire: boolean;
  lastInputSeq: number;
};

export type RoomStatePacket = {
  t: number;
  tick: number;
  mapId: string;
  players: PlayerPublic[];
};
