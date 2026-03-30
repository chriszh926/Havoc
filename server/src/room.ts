import {
  TICK_DT,
  PLAYER_MAX_HEALTH,
  MAG_SIZE,
  RESERVE_MAX,
  FIRE_COOLDOWN,
  RELOAD_TIME,
  RESPAWN_DELAY,
  MP_DEFAULT_MAP,
  ARENA,
  assaultBodyDamage,
} from "./constants.js";
import { stepPlayer } from "./sim.js";
import { hitscanPlayers } from "./hitscan.js";
import type { ClientInput, PlayerInternal, PlayerPublic, RoomStatePacket } from "./types.js";

function randomSpawn() {
  const edge = Math.floor(Math.random() * 4);
  const t = (Math.random() - 0.5) * (ARENA - 4) * 2;
  switch (edge) {
    case 0:
      return { x: t, z: -ARENA + 2.5 };
    case 1:
      return { x: t, z: ARENA - 2.5 };
    case 2:
      return { x: -ARENA + 2.5, z: t };
    default:
      return { x: ARENA - 2.5, z: t };
  }
}

function makePlayer(id: string, name: string): PlayerInternal {
  const s = randomSpawn();
  return {
    id,
    name,
    x: s.x,
    y: 0,
    z: s.z,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    health: PLAYER_MAX_HEALTH,
    dead: false,
    respawnIn: 0,
    ammo: MAG_SIZE,
    reserve: RESERVE_MAX,
    reloading: false,
    reloadLeft: 0,
    kills: 0,
    deaths: 0,
    crouch: 0,
    fireCd: 0,
    wantFire: false,
    lastInputSeq: -1,
  };
}

export class GameRoom {
  id: string;
  mapId = MP_DEFAULT_MAP;
  tick = 0;
  players = new Map<string, PlayerInternal>();
  private inputs = new Map<string, ClientInput>();

  constructor(id: string) {
    this.id = id;
  }

  addPlayer(socketId: string, displayName: string): PlayerInternal {
    const p = makePlayer(socketId, displayName);
    this.players.set(socketId, p);
    return p;
  }

  removePlayer(socketId: string) {
    this.players.delete(socketId);
    this.inputs.delete(socketId);
  }

  setInput(socketId: string, inp: ClientInput) {
    this.inputs.set(socketId, inp);
  }

  queueFire(socketId: string) {
    const p = this.players.get(socketId);
    if (p) p.wantFire = true;
  }

  queueReload(socketId: string) {
    const p = this.players.get(socketId);
    if (!p || p.dead || p.reloading) return;
    if (p.ammo >= MAG_SIZE || p.reserve <= 0) return;
    p.reloading = true;
    p.reloadLeft = RELOAD_TIME;
  }

  tickSim() {
    this.tick++;
    const dt = TICK_DT;
    const list = [...this.players.values()];

    for (const p of list) {
      if (p.fireCd > 0) p.fireCd -= dt;

      if (p.reloading && !p.dead) {
        p.reloadLeft -= dt;
        if (p.reloadLeft <= 0) {
          const need = MAG_SIZE - p.ammo;
          const pull = Math.min(need, p.reserve);
          p.ammo += pull;
          p.reserve -= pull;
          p.reloading = false;
          p.reloadLeft = 0;
        }
      }

      if (p.dead) {
        p.respawnIn -= dt;
        if (p.respawnIn <= 0) {
          const s = randomSpawn();
          p.x = s.x;
          p.z = s.z;
          p.y = 0;
          p.vy = 0;
          p.health = PLAYER_MAX_HEALTH;
          p.dead = false;
          p.respawnIn = 0;
          p.ammo = MAG_SIZE;
          p.reserve = RESERVE_MAX;
          p.reloading = false;
          p.reloadLeft = 0;
          p.fireCd = 0;
        }
        continue;
      }

      const inp = this.inputs.get(p.id);
      if (inp && inp.seq > p.lastInputSeq) {
        p.lastInputSeq = inp.seq;
      }
      stepPlayer(p, inp, dt);
    }

    for (const p of list) {
      if (p.dead || !p.wantFire) continue;
      p.wantFire = false;
      if (p.reloading || p.fireCd > 0) continue;
      if (p.ammo <= 0) {
        this.queueReload(p.id);
        continue;
      }
      p.ammo--;
      p.fireCd = FIRE_COOLDOWN;
      const hit = hitscanPlayers(p, list);
      if (!hit) continue;
      const dist = hit.dist;
      const distM = Math.max(0.05, dist);
      let dmg = assaultBodyDamage(distM);
      if (hit.headshot) {
        dmg = Math.round(dmg * 2 * 10) / 10;
      }
      hit.target.health -= dmg;
      if (hit.target.health <= 0) {
        hit.target.health = 0;
        hit.target.dead = true;
        hit.target.respawnIn = RESPAWN_DELAY;
        hit.target.deaths++;
        p.kills++;
      }
    }
  }

  snapshot(): RoomStatePacket {
    const players: PlayerPublic[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vz: p.vz,
      vy: p.vy,
      yaw: p.yaw,
      pitch: p.pitch,
      health: p.health,
      dead: p.dead,
      respawnIn: Math.max(0, p.respawnIn),
      ammo: p.ammo,
      reserve: p.reserve,
      reloading: p.reloading,
      reloadLeft: Math.max(0, p.reloadLeft),
      kills: p.kills,
      deaths: p.deaths,
      crouch: p.crouch,
    }));
    return {
      t: Date.now(),
      tick: this.tick,
      mapId: this.mapId,
      players,
    };
  }
}
