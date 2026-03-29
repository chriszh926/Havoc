/** Procedural SFX via Web Audio (no asset files). */

let ctx = null;
/** @type {GainNode | null} */
let sfxInput = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/**
 * One-time master chain: trim → compressor → EQ → destination.
 * Tames peaks and rolls off exaggerated highs so procedural SFX sit more naturally.
 */
function getSfxOut(c) {
  if (sfxInput) return sfxInput;
  const gIn = c.createGain();
  gIn.gain.value = 0.72;

  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 26;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.0015;
  comp.release.value = 0.22;

  const warm = c.createBiquadFilter();
  warm.type = "lowshelf";
  warm.frequency.value = 220;
  warm.gain.value = 1.4;

  const deHarsh = c.createBiquadFilter();
  deHarsh.type = "peaking";
  deHarsh.frequency.value = 3800;
  deHarsh.Q.value = 0.65;
  deHarsh.gain.value = -3.8;

  const airCut = c.createBiquadFilter();
  airCut.type = "highshelf";
  airCut.frequency.value = 6200;
  airCut.gain.value = -5;

  const brick = c.createBiquadFilter();
  brick.type = "lowpass";
  brick.frequency.value = 11200;
  brick.Q.value = 0.7;

  gIn.connect(comp);
  comp.connect(warm);
  warm.connect(deHarsh);
  deHarsh.connect(airCut);
  airCut.connect(brick);
  brick.connect(c.destination);

  sfxInput = gIn;
  return sfxInput;
}

export async function resumeAudio() {
  const c = getCtx();
  if (c?.state === "suspended") await c.resume();
}

/** Paul Kellet-style pink noise sample (smoother than white for impacts / cracks). */
function pinkSample(state) {
  const white = Math.random() * 2 - 1;
  state.b0 = 0.99886 * state.b0 + white * 0.0555179;
  state.b1 = 0.99332 * state.b1 + white * 0.0750759;
  state.b2 = 0.969 * state.b2 + white * 0.153852;
  state.b3 = 0.8665 * state.b3 + white * 0.3104856;
  state.b4 = 0.55 * state.b4 + white * 0.5329522;
  state.b5 = -0.7616 * state.b5 - white * 0.016898;
  const out =
    state.b0 + state.b1 + state.b2 + state.b3 + state.b4 + state.b5 + state.b6 + white * 0.5362;
  state.b6 = white * 0.115926;
  return out * 0.11;
}

function makePinkNoiseBuffer(c, durSec, envPow = 2, amp = 1) {
  const n = Math.max(2, Math.floor(c.sampleRate * durSec));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = Math.pow(1 - i / (n - 1), envPow);
    d[i] = pinkSample(st) * e * amp;
  }
  return buf;
}

/**
 * Weapon-specific gunshot: layered muzzle crack + low body + short tail.
 * @param {'rifle'|'smg'|'pistol'|'shotgun'} kind
 */
export function playShoot(kind = "rifle") {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const bodyJit = 1 + (Math.random() * 2 - 1) * 0.028;

  const cfg = {
    rifle: {
      crackMs: 0.0095,
      crackGain: 0.28,
      hp: 900,
      lp: 5200,
      bodyHz: 118,
      bodyMs: 0.028,
      bodyGain: 0.11,
      tailMs: 0.072,
      tailGain: 0.045,
    },
    smg: {
      crackMs: 0.007,
      crackGain: 0.24,
      hp: 1200,
      lp: 6400,
      bodyHz: 155,
      bodyMs: 0.02,
      bodyGain: 0.085,
      tailMs: 0.048,
      tailGain: 0.036,
    },
    pistol: {
      crackMs: 0.008,
      crackGain: 0.26,
      hp: 750,
      lp: 4800,
      bodyHz: 92,
      bodyMs: 0.032,
      bodyGain: 0.12,
      tailMs: 0.056,
      tailGain: 0.042,
    },
    shotgun: {
      crackMs: 0.018,
      crackGain: 0.32,
      hp: 220,
      lp: 3200,
      bodyHz: 62,
      bodyMs: 0.12,
      bodyGain: 0.24,
      tailMs: 0.14,
      tailGain: 0.078,
    },
  };
  const k = cfg[kind] ?? cfg.rifle;

  const crackBuf = makePinkNoiseBuffer(c, k.crackMs, 1.25, 1);
  const crack = c.createBufferSource();
  crack.buffer = crackBuf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(k.hp, t);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(k.lp, 6200), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(700, k.lp * 0.28), t + k.crackMs * 1.45);
  const gCrack = c.createGain();
  gCrack.gain.setValueAtTime(0, t);
  gCrack.gain.linearRampToValueAtTime(k.crackGain, t + 0.0008);
  gCrack.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.055, k.crackMs * 6.2));
  crack.connect(hp).connect(lp).connect(gCrack).connect(dest);
  crack.start(t);

  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(k.bodyHz * 1.22 * bodyJit, t);
  body.frequency.exponentialRampToValueAtTime(k.bodyHz * 0.48 * bodyJit, t + k.bodyMs);
  const gBody = c.createGain();
  gBody.gain.setValueAtTime(0, t);
  gBody.gain.linearRampToValueAtTime(k.bodyGain, t + 0.0025);
  gBody.gain.exponentialRampToValueAtTime(0.001, t + k.bodyMs + 0.022);
  body.connect(gBody).connect(dest);
  body.start(t);
  body.stop(t + k.bodyMs + 0.03);

  const tailBuf = makePinkNoiseBuffer(c, k.tailMs, 1.05, 0.72);
  const tail = c.createBufferSource();
  tail.buffer = tailBuf;
  const lpT = c.createBiquadFilter();
  lpT.type = "lowpass";
  lpT.frequency.setValueAtTime(1800, t);
  lpT.frequency.exponentialRampToValueAtTime(320, t + k.tailMs);
  const gTail = c.createGain();
  gTail.gain.setValueAtTime(0, t + k.crackMs * 0.45);
  gTail.gain.linearRampToValueAtTime(k.tailGain, t + k.crackMs * 0.45 + 0.006);
  gTail.gain.exponentialRampToValueAtTime(0.001, t + k.tailMs + 0.055);
  tail.connect(lpT).connect(gTail).connect(dest);
  tail.start(t + k.crackMs * 0.32);
}

/** Body hit — armor thud + meaty impact + faint ring-off. */
export function playHit() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const thud = c.createOscillator();
  thud.type = "triangle";
  thud.frequency.setValueAtTime(175, t);
  thud.frequency.exponentialRampToValueAtTime(68, t + 0.08);
  const g0 = c.createGain();
  g0.gain.setValueAtTime(0.11, t);
  g0.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  thud.connect(g0).connect(dest);
  thud.start(t);
  thud.stop(t + 0.105);

  const n = Math.floor(c.sampleRate * 0.036);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * e * 0.88;
  }
  const slap = c.createBufferSource();
  slap.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(420, t);
  bp.frequency.exponentialRampToValueAtTime(200, t + 0.034);
  bp.Q.value = 1.05;
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0.14, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
  slap.connect(bp).connect(g1).connect(dest);
  slap.start(t);

  const tick = c.createOscillator();
  tick.type = "sine";
  tick.frequency.setValueAtTime(920, t + 0.004);
  tick.frequency.exponentialRampToValueAtTime(280, t + 0.055);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, t + 0.004);
  g2.gain.linearRampToValueAtTime(0.038, t + 0.009);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  tick.connect(g2).connect(dest);
  tick.start(t + 0.004);
  tick.stop(t + 0.075);
}

/** Headshot — sharp crack + helmet knock + shorter, darker ring (distinct from body). */
export function playHeadshot() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const n = Math.floor(c.sampleRate * 0.048);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * e * 0.95;
  }
  const crack = c.createBufferSource();
  crack.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 800;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(4800, t);
  bp.frequency.exponentialRampToValueAtTime(1100, t + 0.04);
  bp.Q.value = 0.75;
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0.2, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
  crack.connect(hp).connect(bp).connect(g1).connect(dest);
  crack.start(t);

  const knock = c.createOscillator();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(380, t + 0.001);
  knock.frequency.exponentialRampToValueAtTime(88, t + 0.058);
  const lpK = c.createBiquadFilter();
  lpK.type = "lowpass";
  lpK.frequency.value = 1100;
  const gK = c.createGain();
  gK.gain.setValueAtTime(0, t + 0.001);
  gK.gain.linearRampToValueAtTime(0.078, t + 0.007);
  gK.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  knock.connect(lpK).connect(gK).connect(dest);
  knock.start(t + 0.001);
  knock.stop(t + 0.085);

  const ping = c.createOscillator();
  ping.type = "sine";
  ping.frequency.setValueAtTime(1680, t + 0.003);
  ping.frequency.exponentialRampToValueAtTime(380, t + 0.07);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, t + 0.003);
  g2.gain.linearRampToValueAtTime(0.09, t + 0.016);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
  ping.connect(g2).connect(dest);
  ping.start(t + 0.003);
  ping.stop(t + 0.1);
}

export function playKill() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.23);
}

export function playEmpty() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(165, t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.045, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.042);
}

/** Reload start — mag out / pouch handling. */
export function playReloadStart() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const clothN = makePinkNoiseBuffer(c, 0.024, 1.15, 0.42);
  const cSrc = c.createBufferSource();
  cSrc.buffer = clothN;
  const cBp = c.createBiquadFilter();
  cBp.type = "bandpass";
  cBp.frequency.value = 360;
  cBp.Q.value = 1.05;
  const gN = c.createGain();
  gN.gain.setValueAtTime(0.075, t);
  gN.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
  cSrc.connect(cBp).connect(gN).connect(dest);
  cSrc.start(t);

  const thud = c.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(92, t);
  thud.frequency.exponentialRampToValueAtTime(50, t + 0.08);
  const g0 = c.createGain();
  g0.gain.setValueAtTime(0.14, t);
  g0.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  thud.connect(g0).connect(dest);
  thud.start(t);
  thud.stop(t + 0.105);

  const scrape = c.createOscillator();
  scrape.type = "triangle";
  scrape.frequency.setValueAtTime(380, t + 0.04);
  scrape.frequency.linearRampToValueAtTime(155, t + 0.12);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 620;
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0, t + 0.04);
  g1.gain.linearRampToValueAtTime(0.048, t + 0.052);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  scrape.connect(f).connect(g1).connect(dest);
  scrape.start(t + 0.04);
  scrape.stop(t + 0.135);

  const fabric = c.createOscillator();
  fabric.type = "triangle";
  fabric.frequency.setValueAtTime(85, t + 0.1);
  fabric.frequency.linearRampToValueAtTime(36, t + 0.17);
  const gf = c.createGain();
  gf.gain.setValueAtTime(0, t + 0.1);
  gf.gain.linearRampToValueAtTime(0.04, t + 0.122);
  gf.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
  fabric.connect(gf).connect(dest);
  fabric.start(t + 0.1);
  fabric.stop(t + 0.2);
}

/** Mag catch / hand off weapon — short low thump. */
export function playReloadGrab() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const n = Math.floor(c.sampleRate * 0.038);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * 0.85;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 200;
  bp.Q.value = 0.85;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.052);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

/** Rounds sliding / mag well — light metallic scrape. */
export function playReloadInsert() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(290, t);
  osc.frequency.linearRampToValueAtTime(115, t + 0.09);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 780;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.018);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.108);
  osc.connect(lp).connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.115);

  const grit = c.createBufferSource();
  grit.buffer = makePinkNoiseBuffer(c, 0.034, 1.45, 0.38);
  const gLp = c.createBiquadFilter();
  gLp.type = "lowpass";
  gLp.frequency.value = 950;
  const gG = c.createGain();
  gG.gain.setValueAtTime(0.055, t + 0.012);
  gG.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  grit.connect(gLp).connect(gG).connect(dest);
  grit.start(t + 0.01);

  const tick = c.createOscillator();
  tick.type = "triangle";
  tick.frequency.value = 480;
  const lp2 = c.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = 1200;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.048, t + 0.055);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.072);
  tick.connect(lp2).connect(g2).connect(dest);
  tick.start(t + 0.055);
  tick.stop(t + 0.075);
}

/** Mid reload — mag seats / click. */
export function playReloadMid() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const click = c.createOscillator();
  click.type = "triangle";
  click.frequency.setValueAtTime(265, t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.075, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 720;
  click.connect(lp).connect(g).connect(dest);
  click.start(t);
  click.stop(t + 0.034);

  const clack = c.createOscillator();
  clack.type = "sine";
  clack.frequency.setValueAtTime(400, t + 0.028);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.095, t + 0.028);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.058);
  clack.connect(g2).connect(dest);
  clack.start(t + 0.028);
  clack.stop(t + 0.06);
}

/** Follower spring / last round tap before bolt. */
export function playReloadBrass() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const ping = c.createOscillator();
  ping.type = "sine";
  ping.frequency.setValueAtTime(580, t);
  ping.frequency.exponentialRampToValueAtTime(200, t + 0.052);
  const g = c.createGain();
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  ping.connect(g).connect(dest);
  ping.start(t);
  ping.stop(t + 0.07);

  const grit = c.createOscillator();
  grit.type = "triangle";
  grit.frequency.setValueAtTime(190, t + 0.03);
  grit.frequency.setValueAtTime(92, t + 0.055);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, t + 0.03);
  g2.gain.linearRampToValueAtTime(0.05, t + 0.038);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
  grit.connect(g2).connect(dest);
  grit.start(t + 0.03);
  grit.stop(t + 0.075);
}

/** Reload complete — bolt / charging handle. */
export function playReloadDone() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const slide = c.createOscillator();
  slide.type = "triangle";
  slide.frequency.setValueAtTime(170, t);
  slide.frequency.linearRampToValueAtTime(84, t + 0.078);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.092);
  slide.connect(g).connect(dest);
  slide.start(t);
  slide.stop(t + 0.095);

  const snap = c.createOscillator();
  snap.type = "sine";
  snap.frequency.setValueAtTime(560, t + 0.06);
  snap.frequency.setValueAtTime(340, t + 0.075);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, t + 0.06);
  g2.gain.linearRampToValueAtTime(0.14, t + 0.068);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.118);
  snap.connect(g2).connect(dest);
  snap.start(t + 0.06);
  snap.stop(t + 0.12);

  const ring = c.createOscillator();
  ring.type = "sine";
  ring.frequency.setValueAtTime(980, t + 0.09);
  ring.frequency.exponentialRampToValueAtTime(360, t + 0.13);
  const g3 = c.createGain();
  g3.gain.setValueAtTime(0, t + 0.09);
  g3.gain.linearRampToValueAtTime(0.038, t + 0.098);
  g3.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  ring.connect(g3).connect(dest);
  ring.start(t + 0.09);
  ring.stop(t + 0.16);
}

export function playHurt() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const n = Math.floor(c.sampleRate * 0.11);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * 0.42;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 260;
  bp.Q.value = 1.05;
  const g = c.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.115);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

export function playJump() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(340, t + 0.048);
  const g = c.createGain();
  g.gain.setValueAtTime(0.038, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Enemy melee swing + dull connect (plays with player hurt). */
export function playEnemyAttack() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const n = Math.floor(c.sampleRate * 0.054);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * e * 0.75;
  }
  const whoosh = c.createBufferSource();
  whoosh.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1100, t);
  bp.frequency.exponentialRampToValueAtTime(220, t + 0.05);
  bp.Q.value = 0.75;
  const g0 = c.createGain();
  g0.gain.setValueAtTime(0.22, t);
  g0.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  whoosh.connect(bp).connect(g0).connect(dest);
  whoosh.start(t);

  const th = c.createOscillator();
  th.type = "sine";
  th.frequency.setValueAtTime(125, t + 0.016);
  th.frequency.exponentialRampToValueAtTime(45, t + 0.078);
  const g1 = c.createGain();
  g1.gain.setValueAtTime(0, t + 0.016);
  g1.gain.linearRampToValueAtTime(0.16, t + 0.022);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.098);
  th.connect(g1).connect(dest);
  th.start(t + 0.016);
  th.stop(t + 0.1);
}

/**
 * Soft landing on floor / crate — `intensity` 0–1 scales volume from fall speed.
 */
export function playLandThud(intensity = 0.5) {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const s = Math.max(0, Math.min(1, intensity));
  if (s < 0.04) return;
  const t = c.currentTime;
  const peak = 0.04 + s * 0.062;

  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(82 + s * 28, t);
  body.frequency.exponentialRampToValueAtTime(38, t + 0.095);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  body.connect(g).connect(dest);
  body.start(t);
  body.stop(t + 0.125);

  const cloth = c.createOscillator();
  cloth.type = "triangle";
  cloth.frequency.setValueAtTime(55, t + 0.005);
  cloth.frequency.linearRampToValueAtTime(32, t + 0.055);
  const gc = c.createGain();
  gc.gain.setValueAtTime(0, t + 0.005);
  gc.gain.linearRampToValueAtTime(peak * 0.28, t + 0.014);
  gc.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  cloth.connect(gc).connect(dest);
  cloth.start(t + 0.005);
  cloth.stop(t + 0.07);

  const n = Math.floor(c.sampleRate * 0.024);
  const nbuf = c.createBuffer(1, n, c.sampleRate);
  const nd = nbuf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) nd[i] = pinkSample(st) * (1 - i / n) * 0.32;
  const tap = c.createBufferSource();
  tap.buffer = nbuf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 360;
  const gt = c.createGain();
  gt.gain.setValueAtTime(peak * 0.36, t + 0.003);
  gt.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  tap.connect(lp).connect(gt).connect(dest);
  tap.start(t + 0.003);
}

/** Quick concrete/metal footstep with crouch variant. */
export function playFootstep(kind = "run") {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const crouch = kind === "crouch";
  const peak = crouch ? 0.055 : 0.085;

  const n = Math.floor(c.sampleRate * (crouch ? 0.024 : 0.03));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * (0.82 + (crouch ? 0 : 0.2));
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = crouch ? 200 : 280;
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (crouch ? 0.055 : 0.07));
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

/** Early reload — pouch / mag bump against kit. */
export function playReloadPouchTap() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const n = Math.floor(c.sampleRate * 0.028);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * 0.9;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 320;
  bp.Q.value = 1.05;
  const g = c.createGain();
  g.gain.setValueAtTime(0.11, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.044);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);

  const th = c.createOscillator();
  th.type = "sine";
  th.frequency.setValueAtTime(155, t + 0.004);
  th.frequency.exponentialRampToValueAtTime(68, t + 0.045);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.075, t + 0.004);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
  th.connect(g2).connect(dest);
  th.start(t + 0.004);
  th.stop(t + 0.06);
}

/** Mid reload — nylon / vest shift. */
export function playReloadVestShift() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(115, t);
  osc.frequency.linearRampToValueAtTime(42, t + 0.11);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 480;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.042, t + 0.022);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(lp).connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.13);
}

/** Between insert and seat — light metal-on-metal tick. */
export function playReloadMagTick() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  for (let k = 0; k < 2; k++) {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = 360 + k * 85;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 950;
    const g = c.createGain();
    const off = t + k * 0.022;
    g.gain.setValueAtTime(0, off);
    g.gain.linearRampToValueAtTime(0.052, off + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, off + 0.03);
    o.connect(lp).connect(g).connect(dest);
    o.start(off);
    o.stop(off + 0.034);
  }
}

/** Late reload — brass rattle / pocket shuffle before bolt. */
export function playReloadRoundRattle() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const n = Math.floor(c.sampleRate * 0.055);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const st = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
  for (let i = 0; i < n; i++) {
    const e = 1 - i / n;
    d[i] = pinkSample(st) * e * 0.48;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(780, t);
  bp.frequency.exponentialRampToValueAtTime(360, t + 0.05);
  bp.Q.value = 1.25;
  const g = c.createGain();
  g.gain.setValueAtTime(0.085, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  src.connect(bp).connect(g).connect(dest);
  src.start(t);
}

/** Just before charge ends — sling / shoulder fabric + tiny clack. */
export function playReloadShoulderNudge() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;
  const fabric = c.createOscillator();
  fabric.type = "sine";
  fabric.frequency.setValueAtTime(68, t);
  fabric.frequency.linearRampToValueAtTime(36, t + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.052, t + 0.025);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
  fabric.connect(g).connect(dest);
  fabric.start(t);
  fabric.stop(t + 0.1);

  const ck = c.createOscillator();
  ck.type = "triangle";
  ck.frequency.setValueAtTime(480, t + 0.045);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0, t + 0.045);
  g2.gain.linearRampToValueAtTime(0.058, t + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
  ck.connect(g2).connect(dest);
  ck.start(t + 0.045);
  ck.stop(t + 0.08);
}

/** Grenade detonation: deep thump + noisy crack + short tail. */
export function playGrenadeExplosion() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const boom = c.createOscillator();
  boom.type = "triangle";
  boom.frequency.setValueAtTime(78, t);
  boom.frequency.exponentialRampToValueAtTime(34, t + 0.24);
  const gBoom = c.createGain();
  gBoom.gain.setValueAtTime(0, t);
  gBoom.gain.linearRampToValueAtTime(0.22, t + 0.01);
  gBoom.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  boom.connect(gBoom).connect(dest);
  boom.start(t);
  boom.stop(t + 0.31);

  const crackBuf = makePinkNoiseBuffer(c, 0.2, 1.05, 1);
  const crack = c.createBufferSource();
  crack.buffer = crackBuf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(220, t);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(760, t + 0.18);
  const gCrack = c.createGain();
  gCrack.gain.setValueAtTime(0.24, t);
  gCrack.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  crack.connect(hp).connect(lp).connect(gCrack).connect(dest);
  crack.start(t);

  const tailBuf = makePinkNoiseBuffer(c, 0.34, 1.18, 0.7);
  const tail = c.createBufferSource();
  tail.buffer = tailBuf;
  const lpTail = c.createBiquadFilter();
  lpTail.type = "lowpass";
  lpTail.frequency.setValueAtTime(1200, t);
  lpTail.frequency.exponentialRampToValueAtTime(300, t + 0.34);
  const gTail = c.createGain();
  gTail.gain.setValueAtTime(0, t + 0.035);
  gTail.gain.linearRampToValueAtTime(0.12, t + 0.065);
  gTail.gain.exponentialRampToValueAtTime(0.001, t + 0.39);
  tail.connect(lpTail).connect(gTail).connect(dest);
  tail.start(t + 0.03);
}

/** Practice 2: attention cue when the reaction flash begins. */
export function playPracticeFlashCue() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const sweep = c.createOscillator();
  sweep.type = "triangle";
  sweep.frequency.setValueAtTime(280, t);
  sweep.frequency.exponentialRampToValueAtTime(1650, t + 0.095);
  const gSw = c.createGain();
  gSw.gain.setValueAtTime(0, t);
  gSw.gain.linearRampToValueAtTime(0.24, t + 0.006);
  gSw.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  sweep.connect(gSw).connect(dest);
  sweep.start(t);
  sweep.stop(t + 0.13);

  const click = c.createOscillator();
  click.type = "sine";
  click.frequency.setValueAtTime(2400, t + 0.04);
  click.frequency.exponentialRampToValueAtTime(900, t + 0.055);
  const gCk = c.createGain();
  gCk.gain.setValueAtTime(0, t + 0.038);
  gCk.gain.linearRampToValueAtTime(0.14, t + 0.043);
  gCk.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
  click.connect(gCk).connect(dest);
  click.start(t + 0.038);
  click.stop(t + 0.08);
}

/** Practice 2: quick positive chime on successful click. */
export function playPracticeReactSuccess() {
  const c = getCtx();
  if (!c) return;
  const dest = getSfxOut(c);
  const t = c.currentTime;

  const freqs = [523.25, 659.25, 783.99];
  for (let i = 0; i < freqs.length; i++) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freqs[i];
    const g = c.createGain();
    g.gain.setValueAtTime(0, t + i * 0.022);
    g.gain.linearRampToValueAtTime(0.1 - i * 0.022, t + i * 0.022 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g).connect(dest);
    o.start(t + i * 0.022);
    o.stop(t + 0.42);
  }
}
