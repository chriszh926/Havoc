import * as THREE from "three";
import {
  resumeAudio,
  playShoot,
  playHit,
  playHeadshot,
  playKill,
  playEmpty,
  playReloadStart,
  playReloadGrab,
  playReloadInsert,
  playReloadMid,
  playReloadBrass,
  playReloadDone,
  playReloadPouchTap,
  playReloadVestShift,
  playReloadMagTick,
  playReloadRoundRattle,
  playReloadShoulderNudge,
  playHurt,
  playJump,
  playEnemyAttack,
  playLandThud,
  playFootstep,
  playGrenadeExplosion,
  playPracticeFlashCue,
  playPracticeReactSuccess,
} from "./sounds.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("c");
const overlay = document.getElementById("overlay");
const gameoverEl = document.getElementById("gameover");
const startBtn = document.getElementById("start");
const restartBtn = document.getElementById("restart");
const crosshair = document.getElementById("crosshair");
const hitmarkerEl = document.getElementById("hitmarker");
const scoreEl = document.getElementById("score");
const streakToastEl = document.getElementById("streak-toast");
const healthEl = document.getElementById("health");
const healthBarFillEl = document.getElementById("health-bar-fill");
const damageVignetteEl = document.getElementById("damage-vignette");
const sniperScopeEl = document.getElementById("sniper-scope");
const finalScoreEl = document.getElementById("final-score");
const ammoEl = document.getElementById("ammo");
const weaponBarEl = document.getElementById("weapon-bar");
const damageFloaterRoot = document.getElementById("damage-floaters");
const menuBtn = document.getElementById("menu-btn");
const loadoutPrimaryEl = document.getElementById("loadout-primary");
const loadoutSecondaryEl = document.getElementById("loadout-secondary");
const loadoutMeleeEl = document.getElementById("loadout-melee");
const loadoutUtilityEl = document.getElementById("loadout-utility");
const practiceModeEl = document.getElementById("practice-mode");
const practiceMode2El = document.getElementById("practice-mode-2");
const menuObjectiveEl = document.getElementById("menu-objective");
const practiceHintEl = document.getElementById("practice-hint");
const practiceReactFlashEl = document.getElementById("practice-react-flash");
const practiceReactPromptEl = document.getElementById("practice-react-prompt");
const practiceReactDoneEl = document.getElementById("practice-react-done");

const ARENA = 28;
const PLAYER_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.35;
const MOVE_SPEED = 9;
const MOUSE_SENS = 0.0022;
/** Multiply drag-look sensitivity for touch pointers (coarse / mobile). */
const TOUCH_LOOK_SENS_MUL = 1.62;
const PITCH_LIMIT = Math.PI / 2 - 0.08;
const CAMERA_FOV_HIP = 72;
const CAMERA_FOV_ADS = 50;
/** Feet above block top by this much: no XZ wall (jump over thin pads / rails). */
const COLLIDE_CLEAR_ABOVE_TOP = 0.08;
/** Standing on surface: feet may sit slightly below mesh top. */
const COLLIDE_ON_TOP_BAND_BELOW = 0.045;
/** Bob / snap above platform top while supported. */
const COLLIDE_ON_TOP_BAND_ABOVE = 0.18;
/** Enemy XZ moves per frame are split so thin geometry is not tunnelled through. */
const ENEMY_MOVE_SUBSTEPS = 4;
const SLOT_PRIMARY = 0;
const SLOT_SECONDARY = 1;
const SLOT_MELEE = 2;
const SLOT_UTILITY = 3;

const PRIMARY_OPTIONS = [
  {
    label: "Assault Rifle",
    magSize: 20,
    reserveMax: 200,
    reloadTime: 3,
    fireCooldown: 0.075,
    moveMul: 1,
    arDamageMul: 1.56,
  },
  {
    label: "Battle Rifle",
    magSize: 12,
    reserveMax: 72,
    reloadTime: 2.6,
    fireCooldown: 0.2,
    moveMul: 0.94,
    arDamageMul: 1.2,
  },
  {
    label: "SMG",
    magSize: 84,
    reserveMax: 672,
    reloadTime: 2.4,
    fireCooldown: 0.06,
    moveMul: 1.08,
    arDamageMul: 0.72,
  },
  {
    label: "Shotgun",
    magSize: 8,
    reserveMax: 48,
    reloadTime: 2.9,
    fireCooldown: 0.82,
    moveMul: 0.93,
    /** Ignored for damage — shotgun uses spread + its own falloff. */
    arDamageMul: 1,
  },
  {
    label: "Sniper",
    magSize: 5,
    reserveMax: 30,
    reloadTime: 3.2,
    fireCooldown: 1.1,
    moveMul: 0.82,
    /** Uses fixed sniper damage in `shoot()`. */
    arDamageMul: 1,
  },
];

const PRIMARY_INDEX_ASSAULT = 0;
const PRIMARY_INDEX_SHOTGUN = 3;
const PRIMARY_INDEX_SMG = 2;
const PRIMARY_INDEX_SNIPER = 4;

const SECONDARY_OPTIONS = [
  {
    label: "Handgun",
    magSize: 12,
    reserveMax: 120,
    reloadTime: 2,
    fireCooldown: 0.25,
    moveMul: 1.1,
    hgDamageMul: 1,
  },
  {
    label: "Heavy Pistol",
    magSize: 8,
    reserveMax: 64,
    reloadTime: 2.2,
    fireCooldown: 0.3167,
    moveMul: 1.05,
    hgDamageMul: 1.18,
  },
  {
    label: "Revolver",
    magSize: 6,
    reserveMax: 48,
    reloadTime: 2.8,
    fireCooldown: 0.375,
    moveMul: 1.02,
    hgDamageMul: 1.35,
  },
];

const MELEE_OPTIONS = [
  { label: "Knife", damage: 20, meleeRange: 3.55, fireCooldown: 0.4, meleeConeDeg: 58, moveMul: 1.25 },
  { label: "Tactical Axe", damage: 32, meleeRange: 2.95, fireCooldown: 0.58, meleeConeDeg: 48, moveMul: 1.12 },
  { label: "Brass Knuckles", damage: 14, meleeRange: 2.25, fireCooldown: 0.28, meleeConeDeg: 65, moveMul: 1.35 },
];
const MELEE_INDEX_KNUCKLES = 2;

const UTILITY_OPTIONS = [
  { label: "Resupply", kind: "resupply", addP: 22, addS: 14, cooldown: 38 },
  { label: "Medkit", kind: "medkit", heal: 100, cooldown: 42 },
  { label: "Grenade", kind: "grenade", damage: 95, cooldown: 15, fuse: 1.15, speed: 16.5, radius: 5.2 },
];

const LOADOUT_SLOTS = 4;
const loadoutChoice = [0, 0, 0, 0];

function clampToOptions(v, maxIdx) {
  return THREE.MathUtils.clamp(Math.floor(Number(v)) || 0, 0, maxIdx);
}

function readLoadoutFromMenu() {
  if (loadoutPrimaryEl) {
    loadoutChoice[SLOT_PRIMARY] = clampToOptions(
      loadoutPrimaryEl.value,
      PRIMARY_OPTIONS.length - 1
    );
  }
  if (loadoutSecondaryEl) {
    loadoutChoice[SLOT_SECONDARY] = clampToOptions(
      loadoutSecondaryEl.value,
      SECONDARY_OPTIONS.length - 1
    );
  }
  if (loadoutMeleeEl) {
    loadoutChoice[SLOT_MELEE] = clampToOptions(loadoutMeleeEl.value, MELEE_OPTIONS.length - 1);
  }
  if (loadoutUtilityEl) {
    loadoutChoice[SLOT_UTILITY] = clampToOptions(loadoutUtilityEl.value, UTILITY_OPTIONS.length - 1);
  } else {
    loadoutChoice[SLOT_UTILITY] = 0;
  }
  try {
    localStorage.setItem(
      "havocLoadout",
      JSON.stringify({
        p: loadoutChoice[SLOT_PRIMARY],
        s: loadoutChoice[SLOT_SECONDARY],
        m: loadoutChoice[SLOT_MELEE],
        u: loadoutChoice[SLOT_UTILITY],
      })
    );
  } catch (_) {
    /* ignore */
  }
}

function applyStoredLoadoutToMenu() {
  try {
    const raw = localStorage.getItem("havocLoadout");
    if (!raw) return;
    const j = JSON.parse(raw);
    if (loadoutPrimaryEl && Number.isInteger(j.p)) {
      loadoutPrimaryEl.value = String(clampToOptions(j.p, PRIMARY_OPTIONS.length - 1));
    }
    if (loadoutSecondaryEl && Number.isInteger(j.s)) {
      loadoutSecondaryEl.value = String(clampToOptions(j.s, SECONDARY_OPTIONS.length - 1));
    }
    if (loadoutMeleeEl && Number.isInteger(j.m)) {
      loadoutMeleeEl.value = String(clampToOptions(j.m, MELEE_OPTIONS.length - 1));
    }
    if (loadoutUtilityEl && Number.isInteger(j.u)) {
      loadoutUtilityEl.value = String(clampToOptions(j.u, UTILITY_OPTIONS.length - 1));
    }
  } catch (_) {
    /* ignore */
  }
}

function getPrimaryDef() {
  return PRIMARY_OPTIONS[loadoutChoice[SLOT_PRIMARY]];
}
function getSecondaryDef() {
  return SECONDARY_OPTIONS[loadoutChoice[SLOT_SECONDARY]];
}
function getMeleeDef() {
  return MELEE_OPTIONS[loadoutChoice[SLOT_MELEE]];
}
function getUtilityDef() {
  return UTILITY_OPTIONS[loadoutChoice[SLOT_UTILITY]];
}

function ammoIdxForGunSlot(slot) {
  return slot === SLOT_PRIMARY ? loadoutChoice[SLOT_PRIMARY] : loadoutChoice[SLOT_SECONDARY];
}

function magAmmoStoreForSlot(slot) {
  return slot === SLOT_PRIMARY ? primaryMagAmmo : secondaryMagAmmo;
}

function reserveAmmoStoreForSlot(slot) {
  return slot === SLOT_PRIMARY ? primaryReserveAmmo : secondaryReserveAmmo;
}

function refreshWeaponBarFromLoadout() {
  const labels = [
    getPrimaryDef().label,
    getSecondaryDef().label,
    getMeleeDef().label,
    getUtilityDef().label,
  ];
  document.querySelectorAll(".weapon-slot[data-slot]").forEach((el) => {
    const i = Number(el.dataset.slot);
    if (i >= 0 && i < LOADOUT_SLOTS) {
      const nameEl = el.querySelector(".weapon-slot-name");
      if (nameEl) nameEl.textContent = labels[i];
    }
  });
}

function moveMulForActiveSlot() {
  switch (activeWeapon) {
    case SLOT_PRIMARY:
      return getPrimaryDef().moveMul;
    case SLOT_SECONDARY:
      return getSecondaryDef().moveMul;
    case SLOT_MELEE:
      return getMeleeDef().moveMul;
    default:
      return 1;
  }
}

/** Assault rifle: linear falloff muzzle → hit (meters), then rounded to 0.1. */
const AR_DAMAGE_MAX = 8.5;
const AR_DAMAGE_MIN = 6.5;
const AR_DAMAGE_RAMP_START_M = 10;
const AR_DAMAGE_RAMP_END_M = 44;

function assaultRifleBodyDamageAtDistance(distMeters) {
  const span = AR_DAMAGE_RAMP_END_M - AR_DAMAGE_RAMP_START_M;
  const t =
    span > 1e-6
      ? THREE.MathUtils.clamp((distMeters - AR_DAMAGE_RAMP_START_M) / span, 0, 1)
      : 0;
  const raw = THREE.MathUtils.lerp(AR_DAMAGE_MAX, AR_DAMAGE_MIN, t);
  return Math.round(raw * 10) / 10;
}

/** Handgun: linear falloff muzzle → hit (meters), rounded to 0.1. */
const HG_DAMAGE_MAX = 12;
const HG_DAMAGE_MIN = 8;
const HG_DAMAGE_RAMP_START_M = 10;
const HG_DAMAGE_RAMP_END_M = 44;

function handgunBodyDamageAtDistance(distMeters) {
  const span = HG_DAMAGE_RAMP_END_M - HG_DAMAGE_RAMP_START_M;
  const t =
    span > 1e-6
      ? THREE.MathUtils.clamp((distMeters - HG_DAMAGE_RAMP_START_M) / span, 0, 1)
      : 0;
  const raw = THREE.MathUtils.lerp(HG_DAMAGE_MAX, HG_DAMAGE_MIN, t);
  return Math.round(raw * 10) / 10;
}

/** Spread shot: total damage if all pellets connect at same range (muzzle → hit). */
const SHOTGUN_PELLET_COUNT = 10;
const SHOTGUN_DMG_MAX = 65;
const SHOTGUN_DMG_AT_NEXT = 35;
const SHOTGUN_DMG_MIN = 5;
const SHOTGUN_DIST_FULL_M = 1.15;
const SHOTGUN_DIST_NEXT_M = 4;
const SHOTGUN_DIST_MIN_M = 24;

function shotgunShellDamageAtDistance(distMeters) {
  const d = Math.max(0, distMeters);
  if (d <= SHOTGUN_DIST_FULL_M) return SHOTGUN_DMG_MAX;
  if (d >= SHOTGUN_DIST_MIN_M) return SHOTGUN_DMG_MIN;
  if (d <= SHOTGUN_DIST_NEXT_M) {
    const span = SHOTGUN_DIST_NEXT_M - SHOTGUN_DIST_FULL_M;
    const t = span > 1e-6 ? THREE.MathUtils.clamp((d - SHOTGUN_DIST_FULL_M) / span, 0, 1) : 1;
    return THREE.MathUtils.lerp(SHOTGUN_DMG_MAX, SHOTGUN_DMG_AT_NEXT, t);
  }
  const span2 = SHOTGUN_DIST_MIN_M - SHOTGUN_DIST_NEXT_M;
  const t2 = span2 > 1e-6 ? THREE.MathUtils.clamp((d - SHOTGUN_DIST_NEXT_M) / span2, 0, 1) : 1;
  return THREE.MathUtils.lerp(SHOTGUN_DMG_AT_NEXT, SHOTGUN_DMG_MIN, t2);
}

function shotgunPelletDamageAtDistance(distMeters) {
  const per = shotgunShellDamageAtDistance(distMeters) / SHOTGUN_PELLET_COUNT;
  return Math.round(per * 10) / 10;
}

const DASH_SPEED = 26;
const DASH_DURATION = 0.2;
const DASH_COOLDOWN = 1.2;
/** Extra FOV (wider = zoomed out) while dashing; eased in/out. */
const DASH_FOV_BOOST = 10;
const DASH_FOV_SMOOTH = 18;
const GRAVITY = 32;
const JUMP_SPEED = 11;
const ADS_SMOOTH = 16;
const ADS_SMOOTH_SNIPER = 7.6;
const CROUCH_SMOOTH = 14;
const EYE_STAND = PLAYER_HEIGHT;
const EYE_CROUCH = 0.92;
/** Camera looks down −local Z; +Z places the rig behind the character. */
const THIRD_PERSON_CAMERA_Z = 4.12;
const THIRD_PERSON_CAMERA_Y_OFST = 0.38;
const THIRD_PERSON_FOV_EXTRA = 7;
const THIRD_PERSON_NEAR = 0.11;
const FIRST_PERSON_NEAR = 0.06;
const THIRD_PERSON_FIRE_FORWARD_OF_EYE = 0.52;
const CROUCH_SPEED_MUL = 0.5;
const ENEMY_SPEED = 3.2;
const SPAWN_INTERVAL = 2.2;
const ENEMY_DAMAGE = 12;
const DAMAGE_COOLDOWN = 0.8;
const WOLF_HP = 50;
const BEAR_HP = 150;
const WOLF_SPEED_MUL = 1.25;
const WOLF_DAMAGE_MUL = 1.25;
const BEAR_SPEED_MUL = 0.75;
const BEAR_DAMAGE_MUL = 2;
/** Forest only: fraction of wildlife spawns that are bears (rest are wolves). */
const FOREST_BEAR_SPAWN_CHANCE = 0.085;
/** Hits on the same enemy within this window merge into one floating damage number. */
const DAMAGE_POPUP_MERGE_MS = 500;
const PLAYER_MAX_HEALTH = 150;
const MEDKIT_USE_TIME = 5;
const RECOIL_PULSE_TIME = 0.075;

const COLORS = {
  tan: 0xc9a86c,
  tanDark: 0xa88b55,
  black: 0x151518,
  tracer: 0xff5500,
};

const keys = new Set();
let pointerLocked = false;
let useDragLook = false;
let draggingView = false;
let lastDragX = 0;
let lastDragY = 0;
let lockFallbackTimer = 0;

const INPUT_LAYOUT_STORAGE_KEY = "havoc_input_layout";

function readStoredInputLayout() {
  try {
    const v = localStorage.getItem(INPUT_LAYOUT_STORAGE_KEY);
    if (v === "mobile") return true;
    if (v === "desktop") return false;
  } catch (_) {
    /* ignore */
  }
  return null;
}

/** `null` until the player chooses in the menu. */
let inputLayoutMobile = readStoredInputLayout();
let inputLayoutModalOpen = false;

function useMobileFriendlyUi() {
  return inputLayoutMobile === true;
}

function updateInputLayoutModalVisibility() {
  const modal = document.getElementById("menu-modal-input-layout");
  if (!modal) return;
  const show = inputLayoutModalOpen || inputLayoutMobile === null;
  modal.classList.toggle("hidden", !show);
}

function syncStartButtonForLayout() {
  if (startBtn) startBtn.disabled = inputLayoutMobile === null;
}

function syncInputLayoutMenuLabel() {
  const el = document.getElementById("menu-open-input-layout");
  if (!el) return;
  if (inputLayoutMobile === null) {
    el.textContent = "Device: tap to choose phone/tablet or computer (required)";
  } else if (inputLayoutMobile) {
    el.textContent = "Device: Mobile / tablet (tap to change)";
  } else {
    el.textContent = "Device: Computer (tap to change)";
  }
}

function setInputLayoutMobile(isMobile) {
  inputLayoutMobile = isMobile;
  inputLayoutModalOpen = false;
  try {
    localStorage.setItem(
      INPUT_LAYOUT_STORAGE_KEY,
      isMobile ? "mobile" : "desktop"
    );
  } catch (_) {
    /* ignore */
  }
  updateInputLayoutModalVisibility();
  syncStartButtonForLayout();
  syncInputLayoutMenuLabel();
}

function openInputLayoutChoiceModal() {
  inputLayoutModalOpen = true;
  updateInputLayoutModalVisibility();
}

/** Virtual stick −1..1; merged with WASD in movement tick. */
let mobileFwd = 0;
let mobileStrafe = 0;
let mobileFireHeld = false;
let mobileAdsHeld = false;
let mobileJoyPointerId = null;

function resetMobileInput() {
  mobileFwd = 0;
  mobileStrafe = 0;
  mobileFireHeld = false;
  mobileAdsHeld = false;
  mobileJoyPointerId = null;
  const stick = document.getElementById("mobile-joystick-stick");
  if (stick) stick.style.transform = "translate(0, 0)";
}
let score = 0;
/** Rapid kills within this window stack streak bonus + HUD toast. */
const KILL_CHAIN_WINDOW_MS = 2600;
let killChainCount = 0;
let killChainExpireAt = 0;
let streakToastHideT = 0;

/** Practice — moving ball targets (Practice 1). */
let practiceMovingTargets = false;
/** Practice 2 — obby + reaction flash drill (no guns / balls). */
let practiceMode2 = false;
/** True when either practice mode is active (no waves / enemy damage). */
let practiceMode = false;

function practicePrimaryInfiniteAmmo() {
  return practiceMode && !practiceMode2 && activeWeapon === SLOT_PRIMARY;
}

function readPracticeMovingTargets() {
  return !!document.getElementById("practice-mode")?.checked;
}

function readPracticeReactionMode() {
  return !!document.getElementById("practice-mode-2")?.checked;
}

function enforceExclusivePracticeModes(changed) {
  const p1 = document.getElementById("practice-mode");
  const p2 = document.getElementById("practice-mode-2");
  if (!p1 || !p2) return;
  if (changed === "p1" && p1.checked) p2.checked = false;
  if (changed === "p2" && p2.checked) p1.checked = false;
}

/** If practice was toggled while paused, align targets, enemies, and loadout. */
function syncPracticeSessionIfNeeded() {
  const wantM = readPracticeMovingTargets();
  const want2 = readPracticeReactionMode();
  if (wantM === practiceMovingTargets && want2 === practiceMode2) return;
  const was2 = practiceMode2;
  practiceMovingTargets = wantM;
  practiceMode2 = want2;
  practiceMode = wantM || want2;
  rebuildLevelForCurrentPracticeState();
  if (practiceMode2) {
    resetPractice2SpawnToStart();
  } else if (was2) {
    playerVelY = 0;
    slideVelX = 0;
    slideVelZ = 0;
    slideBurstTimer = 0;
    slideCamOffsetX = 0;
    slideCamRoll = 0;
    crouchBlend = 0;
    practice2ObbyWasOnFinish = false;
    yaw.position.set(0, 0, 0);
    resolvePlayerColliders();
    clampPlayer();
    camera.position.y = EYE_STAND;
  }
  if (practiceMode) {
    loadoutChoice[SLOT_PRIMARY] = PRIMARY_INDEX_ASSAULT;
    for (const e of enemies) {
      clearEnemyDamagePopup(e);
      scene.remove(e.root);
    }
    enemies.length = 0;
    clearAmmoPickups();
    refreshWeaponBarFromLoadout();
    syncLoadoutViewmodels();
    updateWeaponHud();
    updateAmmoHud();
    if (practiceMovingTargets) {
      spawnPracticeGallery();
    } else {
      clearPracticeTargets();
    }
    if (practiceMode2) {
      schedulePracticeReactNext(performance.now());
    } else {
      teardownPracticeReactChallenge();
    }
  } else {
    clearPracticeTargets();
    spawnTimer = 0;
    teardownPracticeReactChallenge();
    clearAmmoPickups();
  }
}

const PRACTICE_REACT_WINDOW_MS = 1000;
const PRACTICE_REACT_GAP_MIN_MS = 1000;
const PRACTICE_REACT_GAP_MAX_MS = 15000;
/** Feet Y on first Practice 2 obby platform (must match first block top: y + h/2). */
const PRACTICE2_SPAWN_FEET_Y = 0.55;
const PRACTICE2_VOID_Y = -8;
/** Goal pad (must match the block with `finish: true` in practice2_obby). */
const PRACTICE2_FINISH = { x: 25.55, z: 6.15, w: 2.5, d: 2.5, yTop: 4.34, ry: 0.05 };
const PRACTICE2_OBBY_FINISH_SCORE = 420;
let practice2ObbyWasOnFinish = false;

function resetPractice2SpawnToStart() {
  playerVelY = 0;
  slideVelX = 0;
  slideVelZ = 0;
  slideBurstTimer = 0;
  slideCamOffsetX = 0;
  slideCamRoll = 0;
  crouchBlend = 0;
  practice2ObbyWasOnFinish = false;
  yaw.position.set(0, PRACTICE2_SPAWN_FEET_Y, 0);
  yaw.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  camera.position.y = EYE_STAND;
  resolvePlayerColliders();
  clampPlayer();
}

function isPlayerOnPractice2Finish(px, pz, feetY) {
  const f = PRACTICE2_FINISH;
  const foot = obbXZExtents(f.x, f.z, f.w, f.d, f.ry);
  if (
    !circleXZOverlapAABB(px, pz, PLAYER_RADIUS * 0.82, foot.minX, foot.maxX, foot.minZ, foot.maxZ)
  ) {
    return false;
  }
  return Math.abs(feetY - f.yTop) < 0.38;
}

function triggerPractice2ObbyFinish() {
  score += PRACTICE2_OBBY_FINISH_SCORE;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  void resumeAudio();
  playPracticeReactSuccess();
  addCameraShake(0.12, 0.014, 0.45);
  if (streakToastEl) {
    clearTimeout(streakToastHideT);
    streakToastEl.textContent = "OBBY CLEAR — +420 · step off the pad to run again!";
    streakToastEl.classList.remove("hidden", "streak-toast-out");
    void streakToastEl.offsetWidth;
    streakToastEl.classList.add("streak-toast-in");
    streakToastHideT = window.setTimeout(() => {
      streakToastEl?.classList.add("streak-toast-out");
      window.setTimeout(() => streakToastEl?.classList.add("hidden"), 320);
    }, 2800);
  }
}

let practiceReactNextAt = 0;
let practiceReactActive = false;
let practiceReactDeadline = 0;

function schedulePracticeReactNext(fromT = performance.now()) {
  practiceReactNextAt =
    fromT +
    PRACTICE_REACT_GAP_MIN_MS +
    Math.random() * (PRACTICE_REACT_GAP_MAX_MS - PRACTICE_REACT_GAP_MIN_MS);
}

function teardownPracticeReactChallenge() {
  practiceReactActive = false;
  practiceReactNextAt = 0;
  practiceReactDeadline = 0;
  canvas.removeEventListener("pointerdown", onPracticeReactPointerDown, true);
  canvas.removeEventListener("mousedown", onPracticeReactPointerDown, true);
  practiceReactFlashEl?.classList.add("hidden");
  practiceReactPromptEl?.classList.add("hidden");
  practiceReactDoneEl?.classList.add("hidden");
  practiceReactDoneEl?.classList.remove("practice-react-done--show");
}

function showPracticeReactSuccessOverlay() {
  const wrap = practiceReactDoneEl;
  const icon = wrap?.querySelector(".practice-react-done-icon");
  if (!wrap || !icon) return;
  wrap.classList.remove("hidden");
  wrap.classList.remove("practice-react-done--show");
  void wrap.offsetWidth;
  wrap.classList.add("practice-react-done--show");
  const finish = () => {
    wrap.classList.add("hidden");
    wrap.classList.remove("practice-react-done--show");
  };
  icon.addEventListener("animationend", finish, { once: true });
}

function onPracticeReactPointerDown(e) {
  if (e.button !== 0) return;
  if (!practiceReactActive || !practiceMode2) return;
  if (performance.now() > practiceReactDeadline) return;
  endPracticeReactFlash(true);
}

function beginPracticeReactFlash(t) {
  if (!practiceReactFlashEl) return;
  practiceReactActive = true;
  practiceReactDeadline = t + PRACTICE_REACT_WINDOW_MS;
  const r = 50 + Math.floor(Math.random() * 206);
  const g = 50 + Math.floor(Math.random() * 206);
  const b = 50 + Math.floor(Math.random() * 206);
  practiceReactFlashEl.style.backgroundColor = `rgb(${r},${g},${b})`;
  practiceReactFlashEl.style.opacity = "0.9";
  practiceReactFlashEl.classList.remove("hidden");
  practiceReactPromptEl?.classList.remove("hidden");
  void resumeAudio();
  playPracticeFlashCue();
  canvas.addEventListener("pointerdown", onPracticeReactPointerDown, true);
  canvas.addEventListener("mousedown", onPracticeReactPointerDown, true);
}

function endPracticeReactFlash(success) {
  if (!practiceReactActive) return;
  practiceReactActive = false;
  canvas.removeEventListener("pointerdown", onPracticeReactPointerDown, true);
  canvas.removeEventListener("mousedown", onPracticeReactPointerDown, true);
  practiceReactFlashEl?.classList.add("hidden");
  practiceReactPromptEl?.classList.add("hidden");
  if (success) {
    score += 55;
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    void resumeAudio();
    playPracticeReactSuccess();
    showPracticeReactSuccessOverlay();
  }
  schedulePracticeReactNext();
}

function updatePracticeReactChallenge(now) {
  if (!practiceMode2) {
    teardownPracticeReactChallenge();
    return;
  }
  const menuBlocking =
    !playing ||
    health <= 0 ||
    !overlay?.classList.contains("hidden") ||
    (gameoverEl && !gameoverEl.classList.contains("hidden"));
  if (menuBlocking) {
    if (practiceReactActive) {
      practiceReactActive = false;
      canvas.removeEventListener("pointerdown", onPracticeReactPointerDown, true);
      canvas.removeEventListener("mousedown", onPracticeReactPointerDown, true);
      practiceReactFlashEl?.classList.add("hidden");
      practiceReactPromptEl?.classList.add("hidden");
      schedulePracticeReactNext(now);
    }
    return;
  }
  if (practiceReactActive) {
    if (now >= practiceReactDeadline) endPracticeReactFlash(false);
    return;
  }
  if (practiceReactNextAt <= 0) schedulePracticeReactNext(now);
  if (now >= practiceReactNextAt) beginPracticeReactFlash(now);
}

function scoreForKill() {
  const now = performance.now();
  if (now > killChainExpireAt) killChainCount = 0;
  killChainCount += 1;
  killChainExpireAt = now + KILL_CHAIN_WINDOW_MS;
  const bonus =
    killChainCount >= 2 ? Math.min(80, 10 + (killChainCount - 2) * 18) : 0;
  if (killChainCount >= 2 && streakToastEl) {
    clearTimeout(streakToastHideT);
    const label =
      killChainCount >= 8
        ? "UNSTOPPABLE"
        : killChainCount >= 5
          ? "ON A TEAR"
          : killChainCount >= 3
            ? "RAMPAGE"
            : "DOUBLE DOWN";
    streakToastEl.textContent = `${killChainCount}× ${label}`;
    streakToastEl.classList.remove("hidden", "streak-toast-out");
    void streakToastEl.offsetWidth;
    streakToastEl.classList.add("streak-toast-in");
    streakToastHideT = window.setTimeout(() => {
      streakToastEl?.classList.add("streak-toast-out");
      window.setTimeout(() => streakToastEl?.classList.add("hidden"), 260);
    }, 820);
  }
  return 100 + bonus;
}

function resetKillChain() {
  killChainCount = 0;
  killChainExpireAt = 0;
  clearTimeout(streakToastHideT);
  streakToastHideT = 0;
  streakToastEl?.classList.remove("streak-toast-in", "streak-toast-out");
  streakToastEl?.classList.add("hidden");
}

let health = PLAYER_MAX_HEALTH;
/** Brief red pulse on melee hit (decays in `updateHurtVignette`). */
let hurtFlash = 0;
/** Brief green pulse after medkit completes. */
let healFlash = 0;
let playing = false;
let fireTimer = 0;
let spawnTimer = 0;
let damageCooldown = 0;
let medkitUseTimer = 0;
let medkitPendingHeal = 0;
let medkitCooldownAfter = 0;
let activeWeapon = SLOT_PRIMARY;
let primaryMagAmmo = PRIMARY_OPTIONS.map((w) => w.magSize);
let primaryReserveAmmo = PRIMARY_OPTIONS.map((w) => w.reserveMax);
let secondaryMagAmmo = SECONDARY_OPTIONS.map((w) => w.magSize);
let secondaryReserveAmmo = SECONDARY_OPTIONS.map((w) => w.reserveMax);
let utilityCdRemain = 0;
let recoilPulseTimer = 0;
let camShakeTime = 0;
let camShakeAmp = 0;
let camShakePhase = 0;
let camShakeJitter = 0;
let slideCamOffsetX = 0;
let slideCamRoll = 0;
let slideVelX = 0;
let slideVelZ = 0;
let slideBurstTimer = 0;
let slideDirX = 0;
let slideDirZ = 0;
let slideSideSign = 1;
let lastCrouchTapAt = -1e9;
let lastMoveTapAt = -1e9;
let switchingWeapon = false;
let switchTimer = 0;
let switchDuration = 0;
let footstepTimer = 0;
let reloading = false;
let reloadTimer = 0;
const reloadSoundTimers = [];

function clearReloadSoundTimers() {
  for (const id of reloadSoundTimers) clearTimeout(id);
  reloadSoundTimers.length = 0;
}
let fireHeld = false;
let playerVelY = 0;
let adsBlend = 0;
let thirdPersonMode = false;
try {
  thirdPersonMode = localStorage.getItem("havoc_tp") === "1";
} catch {
  thirdPersonMode = false;
}
let crouchBlend = 0;
let hitmarkerHideTimer = 0;
let dashRemain = 0;
let dashCd = 0;
let dashFovBlend = 0;
const dashDir = new THREE.Vector3();

const KNIFE_SWING_DUR = 0.34;
const KNUCKLE_PUNCH_DUR = 0.26;
/** Idle pose: blade mostly vertical in view. */
const KNIFE_REST_ROT = new THREE.Euler(0.12, -0.06, 0.03, "YXZ");
let knifeSwingT = 0;
/** Next / current swing: true = diagonal right → left, false = left → right. */
let knifeSwingRtl = true;
let knifeSwingPivot = null;

const GUN_SWAY_POS_MAX = 0.024;
/** Lower = less bob on jump / fall (vertical velocity → gun Y sway). */
const GUN_SWAY_VY_SCALE = 0.0075;
const GUN_SWAY_SMOOTH = 10.5;
const GUN_RECOIL_DECAY = 14;
let gunSwayPos = new THREE.Vector3();
let gunSwayRot = new THREE.Vector3();
let gunRecoilZ = 0;
const quatSway = new THREE.Quaternion();
const eulerSway = new THREE.Euler(0, 0, 0, "YXZ");
const tmpGunBase = new THREE.Vector3();
const tmpSwayTarget = new THREE.Vector3();
const tmpRotTgt = new THREE.Vector3();
const eulerReload = new THREE.Euler(0, 0, 0, "YXZ");
const quatReload = new THREE.Quaternion();
const reloadPosOfs = new THREE.Vector3();
const quatSwitch = new THREE.Quaternion();
const switchPosOfs = new THREE.Vector3();

const SLIDE_INPUT_WINDOW_MS = 500;
const SLIDE_BURST_TIME = 0.52;
const TRAMPOLINE_LAUNCH_SPEED = 18.5;
const trampolineVolumes = [];
const grenades = [];
const GRENADE_GRAVITY = 28;
const GRENADE_BOUNCE_DAMPING = 0.46;

function isMoveKey(code) {
  return code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD";
}

function getWeaponSwapTime(slot) {
  if (slot === SLOT_PRIMARY) {
    const idx = loadoutChoice[SLOT_PRIMARY];
    if (idx === PRIMARY_INDEX_SNIPER) return 0.44;
    if (idx === PRIMARY_INDEX_SHOTGUN) return 0.32;
    if (idx === PRIMARY_INDEX_SMG) return 0.2;
    if (idx === PRIMARY_INDEX_ASSAULT) return 0.24;
    return 0.28;
  }
  if (slot === SLOT_SECONDARY) {
    const idx = loadoutChoice[SLOT_SECONDARY];
    if (idx === 0) return 0.16;
    if (idx === 1) return 0.2;
    return 0.24;
  }
  if (slot === SLOT_MELEE) return 0.18;
  return 0.2;
}

function resetGunSway() {
  gunSwayPos.set(0, 0, 0);
  gunSwayRot.set(0, 0, 0);
  gunRecoilZ = 0;
}

function resetKnifeSwing() {
  knifeSwingT = 0;
  if (knifeSwingPivot) {
    knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
    knifeSwingPivot.position.set(0, 0, 0);
  }
}

const raycaster = new THREE.Raycaster();
/** Pixels from screen center; must match HUD CSS vars (--crosshair-ox / --crosshair-oy). */
const CROSSHAIR_OFFSET_PX_X = 0;
const CROSSHAIR_OFFSET_PX_Y = 0;
const aimNdc = new THREE.Vector2();

function syncCrosshairHudCssVars() {
  const hud = document.getElementById("hud");
  if (hud) {
    hud.style.setProperty("--crosshair-ox", `${CROSSHAIR_OFFSET_PX_X}px`);
    hud.style.setProperty("--crosshair-oy", `${CROSSHAIR_OFFSET_PX_Y}px`);
  }
}

function updateAimNdc() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  aimNdc.x = (CROSSHAIR_OFFSET_PX_X / w) * 2;
  aimNdc.y = -(CROSSHAIR_OFFSET_PX_Y / h) * 2;
}
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpDmgProj = new THREE.Vector3();
const tmpEyeWorld = new THREE.Vector3();
const tmpTracerDir = new THREE.Vector3();
const tmpShotPelletDir = new THREE.Vector3();
const tracerYAxis = new THREE.Vector3(0, 1, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x95a8b8, 26, 80);

const camera = new THREE.PerspectiveCamera(72, 1, 0.06, 140);
camera.position.set(0, EYE_STAND, 0);

const yaw = new THREE.Group();
const pitch = new THREE.Group();
yaw.add(pitch);
/** World-space eye height under pitch; used for melee / grenade / tracer starts in third person. */
const eyeAimAnchor = new THREE.Object3D();
pitch.add(eyeAimAnchor);
pitch.add(camera);
scene.add(yaw);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.63;

const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(window.innerWidth, window.innerHeight);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.72,
  0.38,
  0.25
);
bloomPass.threshold = 0.58;
bloomPass.strength = 0.175;
bloomPass.radius = 0.28;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

const ambientLight = new THREE.AmbientLight(0xb4c6dc, 0.24);
scene.add(ambientLight);
const hemi = new THREE.HemisphereLight(0xa8c0e8, 0xd8e0ec, 0.42);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6f0, 0.58);
sun.position.set(-14, 38, 18);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 90;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0002;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xc8dcff, 0.1);
fill.position.set(20, 18, -22);
scene.add(fill);

/** Procedural sky (blue gradient, clouds, sun) — follows player; `fog: false` so distance fog does not tint it. */
let skyShaderMaterial = null;
const skyFollowGroup = new THREE.Group();
const skyVertexShader = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const skyFragmentShader = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform float uTime;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p = p * 2.02 + vec2(17.0, 13.0);
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 dir = normalize(vWorldPos - uCamPos);
  float up = max(0.0, dir.y);
  vec3 baseCol = mix(uHorizon, uZenith, smoothstep(0.0, 0.58, up));

  vec2 cu = dir.xz * (2.8 / max(0.1, dir.y + 0.18));
  cu += vec2(uTime * 0.0035, uTime * 0.0012);
  float c = fbm(cu) * 0.52 + fbm(cu * 1.85 + vec2(4.2, 2.1)) * 0.34;
  float cl = smoothstep(0.36, 0.76, c) * smoothstep(-0.15, 0.62, dir.y);
  baseCol = mix(baseCol, vec3(0.98, 0.99, 1.0), cl * 0.44);

  vec3 L = normalize(uSunDir);
  float mu = max(0.0, dot(dir, L));
  float glow = pow(mu, 96.0) * 0.38 + pow(mu, 6.0) * 0.12;
  vec3 col = baseCol + vec3(1.0, 0.96, 0.88) * glow;

  gl_FragColor = vec4(col, 1.0);
}
`;
skyShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uHorizon: { value: new THREE.Vector3(0.62, 0.74, 0.88) },
    uZenith: { value: new THREE.Vector3(0.22, 0.52, 0.98) },
    uSunDir: { value: new THREE.Vector3() },
    uCamPos: { value: new THREE.Vector3() },
    uTime: { value: 0 },
  },
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
tmpV.copy(sun.position).normalize();
skyShaderMaterial.uniforms.uSunDir.value.copy(tmpV);

const skyDome = new THREE.Mesh(new THREE.SphereGeometry(130, 40, 28), skyShaderMaterial);
skyDome.renderOrder = -999;
skyFollowGroup.add(skyDome);

const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(2.8, 14, 14),
  new THREE.MeshBasicMaterial({ color: 0xfff8e8, fog: false })
);
sunDisc.position.copy(sun.position).normalize().multiplyScalar(118);
skyFollowGroup.add(sunDisc);

scene.add(skyFollowGroup);

function texAniso() {
  const cap = renderer.capabilities;
  const m = cap.getMaxAnisotropy;
  return Math.min(16, typeof m === "function" ? m.call(cap) : (m ?? 8));
}

function finishRepeatTexture(tex, repeatX, repeatY, srgb) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.anisotropy = texAniso();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Tileable hash in [0,1) for integer grid coords mod `period`. */
function tileHash(ix, iy, period) {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function smoothTileNoise(x, y, period) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = x - x0;
  const sy = y - y0;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);
  const a = tileHash(x0, y0, period);
  const b = tileHash(x0 + 1, y0, period);
  const c = tileHash(x0, y0 + 1, period);
  const d = tileHash(x0 + 1, y0 + 1, period);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbmTile(px, py, res) {
  let amp = 0.5;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 5; i++) {
    const period = Math.max(8, (res / f) | 0);
    sum += amp * smoothTileNoise(px * f, py * f, period);
    norm += amp;
    f *= 2;
    amp *= 0.52;
  }
  return sum / norm;
}

/** Albedo + roughness for one 1×1 world-unit floor tile (seamless). */
function createFloorTileTextures(cellsAcross) {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  const groutW = 4;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 0.85, y * 0.85, res);
      const fine = fbmTile(x * 3.1, y * 3.1, res) * 0.12;
      const edgeDist = Math.min(x, res - 1 - x, y, res - 1 - y);
      const edgeFade = Math.min(1, edgeDist / 8);
      let lum = 232 + n * 22 - fine * 18;
      const groutT = THREE.MathUtils.clamp(1 - edgeDist / groutW, 0, 1);
      const groutMix = groutT * groutT * (3 - 2 * groutT);
      const groutLum = 162 + n * 16 - fine * 8;
      lum = THREE.MathUtils.lerp(lum, groutLum, groutMix);
      lum *= 0.94 + 0.06 * edgeFade;
      const i = (y * res + x) * 4;
      const v = THREE.MathUtils.clamp(lum, 0, 255);
      d[i] = v;
      d[i + 1] = v + 2;
      d[i + 2] = v + 4;
      d[i + 3] = 255;
      let rough = 0.42 + n * 0.28 + fine * 0.35;
      const groutRough = 0.78 + n * 0.14;
      rough = THREE.MathUtils.lerp(rough, groutRough, groutMix);
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, cellsAcross, cellsAcross, true);
  finishRepeatTexture(roughMap, cellsAcross, cellsAcross, false);
  return { map, roughnessMap: roughMap };
}

/** Tileable grass albedo + roughness for forest floor (no concrete grout). */
function createGrassFloorTextures(cellsAcross) {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 0.62, y * 0.62, res);
      const fine = fbmTile(x * 2.8, y * 2.8, res) * 0.14;
      const blade =
        Math.abs(Math.sin(x * 0.38 + n * 3.1) * Math.cos(y * 0.36 - n * 2.4)) * (0.12 + fine);
      const sun = 0.8 + n * 0.14 + blade * 0.2;
      const gCh = 132 + n * 56 + blade * 62;
      const rCh = 18 + n * 12 + blade * 10;
      const bCh = 22 + n * 14 + blade * 9;
      const i = (y * res + x) * 4;
      let r = THREE.MathUtils.clamp(rCh * sun * 0.82, 0, 255);
      let gg = THREE.MathUtils.clamp(gCh * sun, 0, 255);
      let b = THREE.MathUtils.clamp(bCh * sun * 0.92, 0, 255);
      gg = Math.min(255, gg + 24 + blade * 26);
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = b;
      d[i + 3] = 255;
      let rough = 0.58 + n * 0.32 + fine * 0.45 + blade * 0.25;
      rough = THREE.MathUtils.clamp(rough, 0.38, 0.98);
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, cellsAcross, cellsAcross, true);
  finishRepeatTexture(roughMap, cellsAcross, cellsAcross, false);
  return { map, roughnessMap: roughMap };
}

/** Running-bond brick albedo + roughness (repeats on wall faces; period divides canvas for no cut-off seams). */
function createBrickFaceTextures() {
  const mortar = 4;
  const bh = 52;
  const bw = 116;
  const cellX = bw + mortar;
  const cellY = bh + mortar;
  const w = cellX * 5;
  const h = cellY * 6;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const r = document.createElement("canvas");
  r.width = w;
  r.height = h;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  g.fillStyle = "#6a5c58";
  g.fillRect(0, 0, w, h);
  gr.fillStyle = "#888888";
  gr.fillRect(0, 0, w, h);
  for (let row = -1; row < h / cellY + 2; row++) {
    const y = row * cellY;
    const offset = (row % 2) * (cellX * 0.5) - cellX;
    for (let col = -1; col < w / cellX + 3; col++) {
      const x = offset + col * cellX;
      const hx = x | 0;
      const hy = y | 0;
      if (hx >= w || hy >= h || hx + bw <= 0 || hy + bh <= 0) continue;
      const seed = tileHash(hx + row * 131, hy + col * 97, 997);
      const dr = (seed - 0.5) * 18;
      const dg = (tileHash(hx + 3, hy + 9, 997) - 0.5) * 14;
      const db = (tileHash(hx + 7, hy + 2, 997) - 0.5) * 12;
      g.fillStyle = `rgb(${THREE.MathUtils.clamp(185 + dr, 120, 230)}, ${THREE.MathUtils.clamp(
        178 + dg,
        115,
        220
      )}, ${THREE.MathUtils.clamp(168 + db, 105, 210)})`;
      g.fillRect(hx, hy, bw, bh);
      const n = fbmTile(hx * 0.08, hy * 0.08, 256);
      g.fillStyle = `rgba(0,0,0,${0.04 + n * 0.08})`;
      g.fillRect(hx, hy, bw, bh);
      const rv = THREE.MathUtils.clamp((0.55 + n * 0.25) * 255, 0, 255);
      gr.fillStyle = `rgb(${rv},${rv},${rv})`;
      gr.fillRect(hx, hy, bw, bh);
    }
  }
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1.15, 1.35, true);
  finishRepeatTexture(roughMap, 1.15, 1.35, false);
  return { map, roughnessMap: roughMap };
}

/** Subtle panel noise for pillars / trim (tileable). */
function createPanelTextures() {
  const res = 384;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 0.6, y * 0.6, res);
      const streak = Math.sin(x * 0.04 + y * 0.02) * 0.5 + 0.5;
      const lum = 235 + n * 18 - streak * 10;
      const i = (y * res + x) * 4;
      d[i] = lum;
      d[i + 1] = lum + 3;
      d[i + 2] = lum + 6;
      d[i + 3] = 255;
      const rough = 0.38 + n * 0.35;
      const rv = rough * 255;
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 2.2, 3.2, true);
  finishRepeatTexture(roughMap, 2.2, 3.2, false);
  return { map, roughnessMap: roughMap };
}

function createWoodCrateTextures() {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  const plankPeriod = 32;
  const plankH = 26;
  const gap = plankPeriod - plankH;
  for (let y = 0; y < res; y++) {
    const py = y % plankPeriod;
    const inGap = py >= plankH;
    for (let x = 0; x < res; x++) {
      const i = (y * res + x) * 4;
      if (inGap) {
        const gNoise = fbmTile(x * 0.4, y * 0.4, res) * 18;
        d[i] = THREE.MathUtils.clamp(52 + gNoise, 0, 255);
        d[i + 1] = THREE.MathUtils.clamp(42 + gNoise * 0.85, 0, 255);
        d[i + 2] = THREE.MathUtils.clamp(34 + gNoise * 0.7, 0, 255);
        d[i + 3] = 255;
        const grv = THREE.MathUtils.clamp((0.72 + fbmTile(x * 0.5, y * 0.5, res) * 0.18) * 255, 0, 255);
        dr[i] = dr[i + 1] = dr[i + 2] = grv;
        dr[i + 3] = 255;
        continue;
      }
      const grain = Math.sin(x * 0.11 + y * 0.07) * 0.5 + 0.5;
      const ring = fbmTile(x * 0.35, y * 0.35, res);
      const R = THREE.MathUtils.clamp(118 + grain * 38 + ring * 22, 0, 255);
      const G = THREE.MathUtils.clamp(82 + grain * 28 + ring * 16, 0, 255);
      const B = THREE.MathUtils.clamp(52 + grain * 20 + ring * 12, 0, 255);
      d[i] = R;
      d[i + 1] = G;
      d[i + 2] = B;
      d[i + 3] = 255;
      const rough = 0.48 + grain * 0.32 + ring * 0.22;
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1.8, 1.8, true);
  finishRepeatTexture(roughMap, 1.8, 1.8, false);
  return { map, roughnessMap: roughMap };
}

function createConcreteTextures() {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 0.35, y * 0.35, res);
      const speck = fbmTile(x * 2.2, y * 2.2, res);
      const lum = 168 + n * 38 + (speck - 0.5) * 22;
      const i = (y * res + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = THREE.MathUtils.clamp(lum, 0, 255);
      d[i + 3] = 255;
      const rough = 0.5 + n * 0.38 + speck * 0.2;
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1.2, 1.2, true);
  finishRepeatTexture(roughMap, 1.2, 1.2, false);
  return { map, roughnessMap: roughMap };
}

function createMetalTextures(dark) {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const base = dark ? 48 : 110;
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const brush = Math.sin(y * 0.11 + x * 0.03) * 0.5 + 0.5;
      const n = fbmTile(x * 0.5, y * 0.5, res);
      const lum = base + brush * 35 + n * 28;
      const i = (y * res + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = THREE.MathUtils.clamp(lum, 0, 255);
      d[i + 3] = 255;
      const rough = dark ? 0.58 + n * 0.28 : 0.28 + n * 0.22;
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 2.5, 2.5, true);
  finishRepeatTexture(roughMap, 2.5, 2.5, false);
  return { map, roughnessMap: roughMap };
}

function createHazardStripeTextures() {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const stripePeriod = 128;
      const stripe = ((x + y) % stripePeriod) < stripePeriod * 0.5 ? 1 : 0;
      const n = fbmTile(x * 0.25, y * 0.25, res);
      let R;
      let G;
      let B;
      if (stripe) {
        R = 210 + n * 25;
        G = 168 + n * 20;
        B = 58 + n * 15;
      } else {
        R = 38 + n * 18;
        G = 36 + n * 16;
        B = 40 + n * 18;
      }
      g.fillStyle = `rgb(${R|0},${G|0},${B|0})`;
      g.fillRect(x, y, 1, 1);
      const rough = stripe ? 0.62 + n * 0.2 : 0.72 + n * 0.18;
      const rv = rough * 255;
      gr.fillStyle = `rgb(${rv|0},${rv|0},${rv|0})`;
      gr.fillRect(x, y, 1, 1);
    }
  }
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1.4, 1.4, true);
  finishRepeatTexture(roughMap, 1.4, 1.4, false);
  return { map, roughnessMap: roughMap };
}

/** Enemy suit — panels, seams, hazard trim + woven noise (shared texture). */
function createEnemySkinTextures() {
  const res = 384;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const r = document.createElement("canvas");
  r.width = res;
  r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  const cellW = 48;
  const cellH = 48;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 0.55, y * 0.55, res);
      const weave = (Math.sin(x * 0.31) * Math.sin(y * 0.29) * 0.5 + 0.5) * 22;
      const cx = Math.floor(x / cellW);
      const cy = Math.floor(y / cellH);
      const lx = x - cx * cellW;
      const ly = y - cy * cellH;
      const seam = lx < 2 || lx > cellW - 3 || ly < 2 || ly > cellH - 3;
      const hBand = (cx * 5023 + cy * 1609) % 11 === 0 && ly > cellH * 0.72 && ly < cellH - 3;
      const chestGlow = y > res * 0.38 && y < res * 0.52;
      const panelHash = (cx * 7919 + cy * 2137) % 1000;
      const hazardStripe = panelHash % 37 === 0 && lx > 7 && lx < cellW - 8 && ly > 6 && ly < 13;
      let R = 192 + n * 58 + weave * 0.48;
      let G = 26 + n * 26 + weave * 0.12;
      let B = 40 + n * 32 + weave * 0.18;
      if (seam) {
        R *= 0.62;
        G *= 0.58;
        B *= 0.64;
      }
      if (hBand) {
        R += 28;
        G += 22;
        B += 18;
      }
      if (chestGlow) {
        R += 12;
        G += 8;
        B += 10;
      }
      if (hazardStripe) {
        R = R * 0.28 + 255 * 0.72;
        G = G * 0.28 + 195 * 0.72;
        B = B * 0.28 + 42 * 0.72;
      }
      const i = (y * res + x) * 4;
      d[i] = THREE.MathUtils.clamp(R, 0, 255);
      d[i + 1] = THREE.MathUtils.clamp(G, 0, 255);
      d[i + 2] = THREE.MathUtils.clamp(B, 0, 255);
      d[i + 3] = 255;
      let rough = 0.38 + n * 0.42 + weave * 0.008;
      if (seam) rough += 0.12;
      if (hazardStripe) rough -= 0.08;
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1.6, 1.6, true);
  finishRepeatTexture(roughMap, 1.6, 1.6, false);
  return { map, roughnessMap: roughMap };
}

/** Procedural maps for viewmodel knife (steel blade + rubber grip). */
function createKnifeProceduralTextures() {
  const an = texAniso();
  const bw = 640;
  const bh = 768;
  const bc = document.createElement("canvas");
  bc.width = bw;
  bc.height = bh;
  const bg = bc.getContext("2d");
  const bImg = bg.createImageData(bw, bh);
  const bd = bImg.data;
  for (let y = 0; y < bh; y++) {
    const gy = y / bh;
    for (let x = 0; x < bw; x++) {
      const gx = x / bw;
      const i = (y * bw + x) * 4;
      const gLin = 0.28 + gx * 0.12;
      const cold = 0.32 + gy * 0.08;
      let R = (gLin * 0.55 + cold * 0.25) * 255;
      let G = (gLin * 0.58 + cold * 0.28) * 255;
      let B = (gLin * 0.62 + cold * 0.32) * 255;
      const brush = Math.sin(x * 0.045 + y * 0.028) * 0.5 + 0.5;
      R += brush * 18 - 9;
      G += brush * 16 - 8;
      B += brush * 14 - 7;
      const n = fbmTile(x * 0.35, y * 0.35, 512);
      R += (n - 0.5) * 22;
      G += (n - 0.5) * 20;
      B += (n - 0.5) * 18;
      if (gx > 0.5) {
        const spine = ((gx - 0.5) / 0.5) ** 1.35;
        R -= spine * 26;
        G -= spine * 24;
        B -= spine * 22;
      }
      bd[i] = THREE.MathUtils.clamp(R, 0, 255);
      bd[i + 1] = THREE.MathUtils.clamp(G, 0, 255);
      bd[i + 2] = THREE.MathUtils.clamp(B, 0, 255);
      bd[i + 3] = 255;
    }
  }
  bg.putImageData(bImg, 0, 0);
  bg.globalAlpha = 0.14;
  bg.strokeStyle = "#d8e0ec";
  for (let y = 0; y < bh; y += 3) {
    const wobble = Math.sin(y * 0.08) * 0.8 + (Math.random() - 0.5) * 0.6;
    bg.beginPath();
    bg.moveTo(0, y + wobble);
    bg.lineTo(bw, y + wobble * 0.92);
    bg.stroke();
  }
  bg.globalAlpha = 1;
  const bladeColorMap = new THREE.CanvasTexture(bc);
  bladeColorMap.colorSpace = THREE.SRGBColorSpace;
  bladeColorMap.wrapS = bladeColorMap.wrapT = THREE.RepeatWrapping;
  bladeColorMap.repeat.set(2.2, 2.6);
  bladeColorMap.anisotropy = an;
  bladeColorMap.minFilter = THREE.LinearMipmapLinearFilter;
  bladeColorMap.generateMipmaps = true;

  const rw = 384;
  const rh = 384;
  const rc = document.createElement("canvas");
  rc.width = rw;
  rc.height = rh;
  const rg = rc.getContext("2d");
  const rImg = rg.createImageData(rw, rh);
  const rd = rImg.data;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const wave = Math.sin(y * 0.07 + x * 0.02) * 0.5 + 0.5;
      const n = fbmTile(x * 0.4, y * 0.4, rw);
      const streak = Math.sin(x * 0.055 + y * 0.095) * 22;
      const v = THREE.MathUtils.clamp(148 + wave * 52 + (n - 0.5) * 40 + streak, 35, 255);
      const i = (y * rw + x) * 4;
      rd[i] = rd[i + 1] = rd[i + 2] = v;
      rd[i + 3] = 255;
    }
  }
  rg.putImageData(rImg, 0, 0);
  const bladeRoughnessMap = new THREE.CanvasTexture(rc);
  bladeRoughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
  bladeRoughnessMap.wrapS = bladeRoughnessMap.wrapT = THREE.RepeatWrapping;
  bladeRoughnessMap.repeat.set(3.8, 3.8);
  bladeRoughnessMap.anisotropy = an;
  bladeRoughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  bladeRoughnessMap.generateMipmaps = true;

  const hw = 256;
  const hh = 256;
  const hc = document.createElement("canvas");
  hc.width = hw;
  hc.height = hh;
  const hg = hc.getContext("2d");
  const hImg = hg.createImageData(hw, hh);
  const hd = hImg.data;
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const n = fbmTile(x * 0.8, y * 0.8, hw);
      const stip = ((x * 13 + y * 7) % 17 < 4 ? 1 : 0) * 18;
      const jitter = (fbmTile(x * 2.2, y * 2.2, hw) - 0.5) * 14;
      const i = (y * hw + x) * 4;
      const base = 22 + n * 28 + stip;
      /* Olive-drab bias (rubber grip read). */
      hd[i] = THREE.MathUtils.clamp(base * 0.82 + jitter, 0, 255);
      hd[i + 1] = THREE.MathUtils.clamp(base * 1.05 + 10 + jitter, 0, 255);
      hd[i + 2] = THREE.MathUtils.clamp(base * 0.78 + 6 + jitter, 0, 255);
      hd[i + 3] = 255;
    }
  }
  hg.putImageData(hImg, 0, 0);
  const handleColorMap = new THREE.CanvasTexture(hc);
  handleColorMap.colorSpace = THREE.SRGBColorSpace;
  handleColorMap.wrapS = handleColorMap.wrapT = THREE.RepeatWrapping;
  handleColorMap.repeat.set(3.2, 4.2);
  handleColorMap.anisotropy = an;
  handleColorMap.minFilter = THREE.LinearMipmapLinearFilter;
  handleColorMap.generateMipmaps = true;

  const hrs = 192;
  const hrc = document.createElement("canvas");
  hrc.width = hrs;
  hrc.height = hrs;
  const hrg = hrc.getContext("2d");
  const hrImg = hrg.createImageData(hrs, hrs);
  const hrd = hrImg.data;
  for (let y = 0; y < hrs; y++) {
    for (let x = 0; x < hrs; x++) {
      const n = fbmTile(x * 1.1, y * 1.1, hrs);
      const bump = ((x + y * 3) % 9 < 2 ? 1 : 0) * 35;
      const v = THREE.MathUtils.clamp(138 + (n - 0.5) * 75 + bump, 20, 255);
      const i = (y * hrs + x) * 4;
      hrd[i] = hrd[i + 1] = hrd[i + 2] = v;
      hrd[i + 3] = 255;
    }
  }
  hrg.putImageData(hrImg, 0, 0);
  const handleRoughnessMap = new THREE.CanvasTexture(hrc);
  handleRoughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
  handleRoughnessMap.wrapS = handleRoughnessMap.wrapT = THREE.RepeatWrapping;
  handleRoughnessMap.repeat.set(4.5, 5.5);
  handleRoughnessMap.anisotropy = an;
  handleRoughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  handleRoughnessMap.generateMipmaps = true;

  return { bladeColorMap, bladeRoughnessMap, handleColorMap, handleRoughnessMap };
}

const panelTex = createPanelTextures();
const plasticWhite = new THREE.MeshStandardMaterial({
  color: 0xdce2ea,
  map: panelTex.map,
  roughnessMap: panelTex.roughnessMap,
  roughness: 1,
  metalness: 0,
  emissive: 0x1a2230,
  emissiveIntensity: 0.03,
});

const floorBaseMat = new THREE.MeshStandardMaterial({
  color: 0xb8c2ce,
  roughness: 1,
  metalness: 0,
  emissive: 0x151a22,
  emissiveIntensity: 0.025,
});

const { map: floorGridMap, roughnessMap: floorRoughMap } = createFloorTileTextures(ARENA * 2);
floorBaseMat.map = floorGridMap;
floorBaseMat.roughnessMap = floorRoughMap;
let grassFloorMap = null;
let grassFloorRoughMap = null;
/** Bump when grass algorithm changes so cached textures regenerate. */
const GRASS_FLOOR_TEX_REV = 2;
let grassFloorTexRevApplied = 0;
function ensureGrassFloorTextures() {
  if (grassFloorMap && grassFloorTexRevApplied === GRASS_FLOOR_TEX_REV) return;
  if (grassFloorMap) {
    grassFloorMap.dispose();
    grassFloorRoughMap?.dispose();
    grassFloorMap = null;
    grassFloorRoughMap = null;
  }
  const gf = createGrassFloorTextures(ARENA * 2);
  grassFloorMap = gf.map;
  grassFloorRoughMap = gf.roughnessMap;
  grassFloorTexRevApplied = GRASS_FLOOR_TEX_REV;
}

const brickFaceTex = createBrickFaceTextures();
const brickMat = new THREE.MeshStandardMaterial({
  color: 0xc8d0da,
  map: brickFaceTex.map,
  roughnessMap: brickFaceTex.roughnessMap,
  roughness: 1,
  metalness: 0,
  emissive: 0x121820,
  emissiveIntensity: 0.022,
});

const levelRoot = new THREE.Group();
scene.add(levelRoot);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2, 48, 48), floorBaseMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.001;
floor.receiveShadow = true;
levelRoot.add(floor);

const brickGeo = new THREE.BoxGeometry(2.45, 2.35, 0.62);
const brickMatrices = [];
const m4 = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quatId = new THREE.Quaternion();
const quatY90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
const scaleOne = new THREE.Vector3(1, 1, 1);
const brickH = 2.35;
const brickZ = 0.31;
const brickStepX = 2.5;
function pushBrick(px, py, pz, q) {
  pos.set(px, py, pz);
  m4.compose(pos, q, scaleOne);
  brickMatrices.push(m4.clone());
}
for (let row = 0; row < 2; row++) {
  const y = brickH * 0.5 + row * brickH;
  for (let x = -ARENA + brickStepX * 0.5; x < ARENA - 0.2; x += brickStepX) {
    pushBrick(x, y, -ARENA + brickZ, quatId);
    pushBrick(x, y, ARENA - brickZ, quatId);
  }
  for (let z = -ARENA + brickStepX * 0.5; z < ARENA - 0.2; z += brickStepX) {
    pushBrick(-ARENA + brickZ, y, z, quatY90);
    pushBrick(ARENA - brickZ, y, z, quatY90);
  }
}
const wallBricks = new THREE.InstancedMesh(brickGeo, brickMat, brickMatrices.length);
brickMatrices.forEach((mat, i) => wallBricks.setMatrixAt(i, mat));
wallBricks.instanceMatrix.needsUpdate = true;
wallBricks.castShadow = true;
wallBricks.receiveShadow = true;
levelRoot.add(wallBricks);

const pillarGeo = new THREE.BoxGeometry(1.15, 5.4, 1.15);
/** Forest: taller tapered trunk (collision top matches `pillarTopY` in preset). */
const FOREST_TRUNK_H = 6.85;
const forestTrunkGeo = new THREE.CylinderGeometry(0.6, 0.82, FOREST_TRUNK_H, 22);
const forestBranchGeo = new THREE.CylinderGeometry(0.06, 0.095, 2.35, 6);
const pillarMat = plasticWhite.clone();
const pillarsRoot = new THREE.Group();
levelRoot.add(pillarsRoot);

/** Forest-only leaf clusters (instanced-style shared geometry). */
const forestLeafIcoGeo = new THREE.IcosahedronGeometry(0.52, 0);
const forestLeafDodeGeo = new THREE.DodecahedronGeometry(0.44, 0);
const forestLeafMatDark = new THREE.MeshStandardMaterial({
  color: 0x2a5c32,
  roughness: 0.9,
  metalness: 0,
  emissive: 0x081808,
  emissiveIntensity: 0.06,
  side: THREE.DoubleSide,
});
const forestLeafMatMid = new THREE.MeshStandardMaterial({
  color: 0x3f8c4a,
  roughness: 0.82,
  metalness: 0,
  emissive: 0x123018,
  emissiveIntensity: 0.055,
  side: THREE.DoubleSide,
});
const forestLeafMatBright = new THREE.MeshStandardMaterial({
  color: 0x62b86e,
  roughness: 0.74,
  metalness: 0,
  emissive: 0x1a4820,
  emissiveIntensity: 0.045,
  side: THREE.DoubleSide,
});
const forestFoliageRoot = new THREE.Group();
levelRoot.add(forestFoliageRoot);

const WOLF_EAR_GEO = new THREE.ConeGeometry(0.052, 0.12, 5);
const BEAR_EAR_GEO = new THREE.SphereGeometry(0.07, 8, 6);

const obstaclesRoot = new THREE.Group();
levelRoot.add(obstaclesRoot);

const crateSurf = createWoodCrateTextures();
const concSurf = createConcreteTextures();
const barrierSurf = createMetalTextures(true);
const railSurf = createMetalTextures(false);
const stripeSurf = createHazardStripeTextures();

const obstacleMats = {
  crate: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: crateSurf.map,
    roughnessMap: crateSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: concSurf.map,
    roughnessMap: concSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
  }),
  barrier: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: barrierSurf.map,
    roughnessMap: barrierSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
  }),
  rail: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: railSurf.map,
    roughnessMap: railSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
  }),
  stripe: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stripeSurf.map,
    roughnessMap: stripeSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
    emissive: 0x221a10,
    emissiveIntensity: 0.05,
  }),
};
const trampolineMat = new THREE.MeshStandardMaterial({
  color: 0x5bb8ff,
  roughness: 0.38,
  metalness: 0.12,
  emissive: 0x123a66,
  emissiveIntensity: 0.24,
});

const DEFAULT_OBSTACLE_TINTS = {
  crate: 0xffffff,
  concrete: 0xffffff,
  barrier: 0xffffff,
  rail: 0xffffff,
  stripe: 0xffffff,
};

function applyObstacleTints(tints) {
  const t = { ...DEFAULT_OBSTACLE_TINTS, ...(tints || {}) };
  obstacleMats.crate.color.setHex(t.crate);
  obstacleMats.concrete.color.setHex(t.concrete);
  obstacleMats.barrier.color.setHex(t.barrier);
  obstacleMats.rail.color.setHex(t.rail);
  obstacleMats.stripe.color.setHex(t.stripe);
}

/** Stacked shipping-style crates (center x,z on floor). */
function crateStack(x, z, levels, ry, w = 2.05, h = 0.95, d = 1.5) {
  const out = [];
  for (let i = 0; i < levels; i++) {
    out.push({
      x,
      z,
      w,
      h,
      d,
      y: h * 0.5 + i * h,
      mat: "crate",
      ry: ry + i * 0.05,
    });
  }
  return out;
}

function clearObstacleMeshes() {
  while (obstaclesRoot.children.length) {
    const m = obstaclesRoot.children[0];
    obstaclesRoot.remove(m);
    m.geometry?.dispose();
  }
}

function rebuildObstacles(p) {
  clearObstacleMeshes();
  trampolineVolumes.length = 0;
  const list = typeof p.blocks === "function" ? p.blocks() : p.blocks || [];
  for (const b of list) {
    let mat = b.trampoline ? trampolineMat : obstacleMats[b.mat] || obstacleMats.concrete;
    if (b.finish && !b.trampoline) {
      mat = mat.clone();
      mat.emissive.setHex(0x16a34a);
      mat.emissiveIntensity = 0.5;
    }
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.y ?? b.h * 0.5, b.z);
    mesh.rotation.y = b.ry ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obstaclesRoot.add(mesh);
    if (b.trampoline) {
      const yTop = (b.y ?? b.h * 0.5) + b.h * 0.5;
      const foot = obbXZExtents(b.x, b.z, b.w, b.d, b.ry ?? 0);
      trampolineVolumes.push({
        ...foot,
        yTop,
        boost: b.boost ?? TRAMPOLINE_LAUNCH_SPEED,
        cx: b.x,
        cz: b.z,
        hw: b.w * 0.5,
        hd: b.d * 0.5,
      });
    }
  }
}

const PILLAR_COLLIDE_HALF = 0.58;
/** Pillar mesh top Y (center 2.7, half-height 2.7). */
const PILLAR_TOP_Y = 5.4;
const ENEMY_COLLIDE_RADIUS = 0.32;
/** XZ footprint + top Y: used for walk snap and height-aware wall collision. */
const levelVolumes = [];
const NAV_CELL_SIZE = 1.6;
const NAV_BLOCK_HEIGHT_MIN = 0.95;
const NAV_INF = 32767;
let navCols = 0;
let navRows = 0;
let navMinX = 0;
let navMinZ = 0;
let navBlocked = new Uint8Array(0);
let navDist = new Int16Array(0);
let navFlowTimer = 0;
let lastNavPlayerCellX = -9999;
let lastNavPlayerCellZ = -9999;

function obbXZExtents(cx, cz, w, d, ry) {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  const extX = hw * c + hd * s;
  const extZ = hw * s + hd * c;
  return {
    minX: cx - extX,
    maxX: cx + extX,
    minZ: cz - extZ,
    maxZ: cz + extZ,
  };
}

/** @param yBottom If set, no XZ wall collision when feet are below this (walk under floating slabs). */
function pushVolume(minX, maxX, minZ, maxZ, yTop, yBottom = undefined) {
  levelVolumes.push({ minX, maxX, minZ, maxZ, yTop, yBottom });
}

function navIndex(cx, cz) {
  return cz * navCols + cx;
}

function worldToNavCell(x, z) {
  const cx = Math.floor((x - navMinX) / NAV_CELL_SIZE);
  const cz = Math.floor((z - navMinZ) / NAV_CELL_SIZE);
  if (cx < 0 || cz < 0 || cx >= navCols || cz >= navRows) return null;
  return { cx, cz };
}

function rebuildNavGrid() {
  navMinX = -ARENA + 0.9;
  navMinZ = -ARENA + 0.9;
  const navMaxX = ARENA - 0.9;
  const navMaxZ = ARENA - 0.9;
  navCols = Math.max(1, Math.floor((navMaxX - navMinX) / NAV_CELL_SIZE));
  navRows = Math.max(1, Math.floor((navMaxZ - navMinZ) / NAV_CELL_SIZE));
  navBlocked = new Uint8Array(navCols * navRows);
  navDist = new Int16Array(navCols * navRows);
  for (let z = 0; z < navRows; z++) {
    const wz = navMinZ + (z + 0.5) * NAV_CELL_SIZE;
    for (let x = 0; x < navCols; x++) {
      const wx = navMinX + (x + 0.5) * NAV_CELL_SIZE;
      let blocked = 0;
      for (const v of levelVolumes) {
        if (v.yTop < NAV_BLOCK_HEIGHT_MIN) continue;
        if (wx >= v.minX && wx <= v.maxX && wz >= v.minZ && wz <= v.maxZ) {
          blocked = 1;
          break;
        }
      }
      navBlocked[navIndex(x, z)] = blocked;
    }
  }
  navFlowTimer = 0;
  lastNavPlayerCellX = -9999;
  lastNavPlayerCellZ = -9999;
}

function rebuildNavFlowToPlayer(px, pz) {
  if (navCols <= 0 || navRows <= 0) return;
  navDist.fill(NAV_INF);
  let start = worldToNavCell(px, pz);
  if (!start) return;
  if (navBlocked[navIndex(start.cx, start.cz)]) {
    let found = null;
    for (let r = 1; r <= 2 && !found; r++) {
      for (let dz = -r; dz <= r && !found; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const cx = start.cx + dx;
          const cz = start.cz + dz;
          if (cx < 0 || cz < 0 || cx >= navCols || cz >= navRows) continue;
          if (!navBlocked[navIndex(cx, cz)]) {
            found = { cx, cz };
            break;
          }
        }
      }
    }
    if (!found) return;
    start = found;
  }
  const qx = new Int16Array(navCols * navRows);
  const qz = new Int16Array(navCols * navRows);
  let head = 0;
  let tail = 0;
  qx[tail] = start.cx;
  qz[tail] = start.cz;
  tail++;
  navDist[navIndex(start.cx, start.cz)] = 0;
  while (head < tail) {
    const cx = qx[head];
    const cz = qz[head];
    head++;
    const base = navDist[navIndex(cx, cz)] + 1;
    const neighbors = [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ];
    for (const [nx, nz] of neighbors) {
      if (nx < 0 || nz < 0 || nx >= navCols || nz >= navRows) continue;
      const ni = navIndex(nx, nz);
      if (navBlocked[ni] || navDist[ni] <= base) continue;
      navDist[ni] = base;
      qx[tail] = nx;
      qz[tail] = nz;
      tail++;
    }
  }
}

function navDirectionTowardPlayer(ex, ez) {
  const c = worldToNavCell(ex, ez);
  if (!c) return null;
  const ci = navIndex(c.cx, c.cz);
  const cd = navDist[ci];
  if (cd >= NAV_INF) return null;
  let bestX = c.cx;
  let bestZ = c.cz;
  let bestD = cd;
  const neighbors = [
    [c.cx + 1, c.cz],
    [c.cx - 1, c.cz],
    [c.cx, c.cz + 1],
    [c.cx, c.cz - 1],
  ];
  for (const [nx, nz] of neighbors) {
    if (nx < 0 || nz < 0 || nx >= navCols || nz >= navRows) continue;
    const nd = navDist[navIndex(nx, nz)];
    if (nd < bestD) {
      bestD = nd;
      bestX = nx;
      bestZ = nz;
    }
  }
  if (bestX === c.cx && bestZ === c.cz) return null;
  const tx = navMinX + (bestX + 0.5) * NAV_CELL_SIZE;
  const tz = navMinZ + (bestZ + 0.5) * NAV_CELL_SIZE;
  const dx = tx - ex;
  const dz = tz - ez;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return null;
  return { x: dx / d, z: dz / d };
}

function clearForestFoliage() {
  while (forestFoliageRoot.children.length) {
    forestFoliageRoot.remove(forestFoliageRoot.children[0]);
  }
}

/** Angled limb cylinders from upper trunk (visual only). */
function buildForestBranches(pillarCoords, barkMat) {
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let t = 0; t < pillarCoords.length; t++) {
    const [px, pz] = pillarCoords[t];
    const seed = px * 2.17 + pz * 1.83 + t * 4.1;
    const nBranch = 6 + Math.floor(Math.abs(Math.sin(seed)) * 3);
    for (let i = 0; i < nBranch; i++) {
      const ang = (i / nBranch) * Math.PI * 2 + seed * 0.37;
      const h = 2.35 + (i % 4) * 0.72 + (Math.abs(Math.sin(seed + i)) * 0.55);
      const dip = 0.32 + (i % 3) * 0.06;
      dir.set(Math.cos(ang) * 0.88, dip, Math.sin(ang) * 0.88).normalize();
      q.setFromUnitVectors(up, dir);
      const br = new THREE.Mesh(forestBranchGeo, barkMat);
      br.position.set(px + Math.cos(ang) * 0.32, h, pz + Math.sin(ang) * 0.32);
      br.setRotationFromQuaternion(q);
      br.castShadow = true;
      br.receiveShadow = true;
      forestFoliageRoot.add(br);
    }
  }
}

/** Layered leaf volumes: mixed icosa / dodeca + larger spread for fuller crowns. */
function buildForestTreeCrowns(pillarCoords) {
  const leafMats = [forestLeafMatDark, forestLeafMatMid, forestLeafMatBright];
  const geos = [forestLeafIcoGeo, forestLeafDodeGeo];
  const crownBaseY = FOREST_TRUNK_H - 0.35;
  for (const [px, pz] of pillarCoords) {
    const crown = new THREE.Group();
    crown.position.set(px, crownBaseY, pz);
    const n = 12 + Math.floor(Math.random() * 7);
    for (let i = 0; i < n; i++) {
      const geo = geos[i % geos.length];
      const m = new THREE.Mesh(geo, leafMats[i % leafMats.length]);
      const s = 0.62 + Math.random() * 0.78;
      m.scale.set(
        s * (0.78 + Math.random() * 0.42),
        s * (0.62 + Math.random() * 0.5),
        s * (0.78 + Math.random() * 0.42)
      );
      m.position.set(
        (Math.random() - 0.5) * 1.95,
        (Math.random() - 0.15) * 1.45,
        (Math.random() - 0.5) * 1.95
      );
      m.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      m.castShadow = true;
      m.receiveShadow = true;
      crown.add(m);
    }
    forestFoliageRoot.add(crown);
  }
}

function rebuildColliders(p) {
  levelVolumes.length = 0;
  const pillarTop = p.pillarTopY ?? PILLAR_TOP_Y;
  const pillarHalf = p.pillarCollideHalf ?? PILLAR_COLLIDE_HALF;
  for (const [px, pz] of p.pillars) {
    pushVolume(
      px - pillarHalf,
      px + pillarHalf,
      pz - pillarHalf,
      pz + pillarHalf,
      pillarTop
    );
  }
  const list = typeof p.blocks === "function" ? p.blocks() : p.blocks || [];
  for (const b of list) {
    const ry = b.ry ?? 0;
    const cy = b.y ?? b.h * 0.5;
    const yTop = cy + b.h * 0.5;
    const yBottom = cy - b.h * 0.5;
    const foot = obbXZExtents(b.x, b.z, b.w, b.d, ry);
    pushVolume(foot.minX, foot.maxX, foot.minZ, foot.maxZ, yTop, yBottom);
  }
  rebuildNavGrid();
}

function circleXZOverlapAABB(cx, cz, radius, minX, maxX, minZ, maxZ) {
  const nx = THREE.MathUtils.clamp(cx, minX, maxX);
  const nz = THREE.MathUtils.clamp(cz, minZ, maxZ);
  const dx = cx - nx;
  const dz = cz - nz;
  return dx * dx + dz * dz < radius * radius;
}

/** Highest support under feet (arena floor or prop top), or -Infinity if none in range. */
function getSupportTopUnderFeet(px, pz, radius, feetY) {
  let best = -Infinity;
  if (activeMapId !== "practice2_obby" && feetY <= 0.35) best = 0;
  for (const s of levelVolumes) {
    if (!circleXZOverlapAABB(px, pz, radius, s.minX, s.maxX, s.minZ, s.maxZ)) continue;
    if (s.yTop <= feetY + 0.5 && feetY <= s.yTop + 0.72) {
      best = Math.max(best, s.yTop);
    }
  }
  return best;
}

/** Snap feet Y when falling / standing on arena floor or prop tops. */
function snapFeetToSupport(px, pz, radius, feetY, vy) {
  if (vy > 0) return { y: feetY, vy };
  const best = getSupportTopUnderFeet(px, pz, radius, feetY);
  if (best === -Infinity) return { y: feetY, vy };
  if (feetY <= best + 0.22) {
    return { y: best, vy: vy < 0 ? 0 : vy };
  }
  return { y: feetY, vy };
}

function canPlayerJump() {
  if (playerVelY > 0.12) return false;
  const feetY = yaw.position.y;
  const best = getSupportTopUnderFeet(
    yaw.position.x,
    yaw.position.z,
    PLAYER_RADIUS,
    feetY
  );
  if (best === -Infinity) return false;
  return feetY <= best + 0.22;
}

function getTrampolineUnderFeet(px, pz, radius, feetY) {
  for (const t of trampolineVolumes) {
    if (!circleXZOverlapAABB(px, pz, radius, t.minX, t.maxX, t.minZ, t.maxZ)) continue;
    if (Math.abs(feetY - t.yTop) <= 0.28) return t;
  }
  return null;
}

function resolveEntityXZ(x, z, radius, feetY) {
  let ox = x;
  let oz = z;
  for (let pass = 0; pass < 10; pass++) {
    for (const box of levelVolumes) {
      if (box.yBottom != null && feetY < box.yBottom) continue;
      if (feetY > box.yTop + COLLIDE_CLEAR_ABOVE_TOP) continue;
      const onTopBand =
        feetY >= box.yTop - COLLIDE_ON_TOP_BAND_BELOW &&
        feetY <= box.yTop + COLLIDE_ON_TOP_BAND_ABOVE;
      if (onTopBand) continue;
      const qx = THREE.MathUtils.clamp(ox, box.minX, box.maxX);
      const qz = THREE.MathUtils.clamp(oz, box.minZ, box.maxZ);
      const dx = ox - qx;
      const dz = oz - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-14) {
        const midX = (box.minX + box.maxX) * 0.5;
        const midZ = (box.minZ + box.maxZ) * 0.5;
        const penX = Math.min(ox - box.minX, box.maxX - ox);
        const penZ = Math.min(oz - box.minZ, box.maxZ - oz);
        if (penX < penZ) {
          ox = ox < midX ? box.minX - radius - 0.02 : box.maxX + radius + 0.02;
        } else {
          oz = oz < midZ ? box.minZ - radius - 0.02 : box.maxZ + radius + 0.02;
        }
        continue;
      }
      const d = Math.sqrt(d2);
      const push = radius - d + 0.004;
      ox += (dx / d) * push;
      oz += (dz / d) * push;
    }
  }
  return { x: ox, z: oz };
}

function resolvePlayerColliders() {
  const r = resolveEntityXZ(yaw.position.x, yaw.position.z, PLAYER_RADIUS, yaw.position.y);
  yaw.position.x = r.x;
  yaw.position.z = r.z;
}

function applyMapPresetLighting(p) {
  sun.intensity = 0.52 * (p.sunMul ?? 1);
  hemi.intensity = 0.42 * (p.hemiMul ?? 1);
  ambientLight.intensity = 0.24 * (p.ambMul ?? 1);
  fill.intensity = 0.1 * (p.fillMul ?? 1);
}

const MAP_PRESETS = {
  courtyard: {
    sunMul: 1.08,
    hemiMul: 1.05,
    ambMul: 1,
    fillMul: 1.1,
    bg: 0x9ab6d0,
    fogColor: 0xa8c0dc,
    fogNear: 24,
    fogFar: 88,
    floorGrid: 1,
    floor: 0xc5d2e0,
    brick: 0xd0dce8,
    pillar: 0xe8f0fa,
    obstacleTints: {
      crate: 0xfff5ea,
      concrete: 0xecf2fa,
      barrier: 0xe2eaf6,
      rail: 0xf2f6fc,
      stripe: 0xfff8f0,
    },
    pillars: [
      [-10, -8],
      [8, -7],
      [-6, 5],
      [11, 6],
      [-3, 12],
      [6, -12],
      [-12, 10],
      [4, 2],
    ],
    blocks: [
      ...crateStack(-12.5, 9.5, 3, 0.12),
      ...crateStack(13, -9, 2, -0.18),
      { x: 0, z: -5.5, w: 16, h: 1.35, d: 0.5, mat: "barrier", ry: 0 },
      { x: -7, z: 7, w: 0.48, h: 1.05, d: 11, mat: "concrete", ry: 0 },
      { x: 10, z: 2, w: 5.5, h: 0.42, d: 7, mat: "concrete", ry: 0.22 },
      { x: -4, z: -11, w: 3.2, h: 0.55, d: 4.2, mat: "stripe", ry: 0.4 },
      { x: 15, z: 12, w: 4.5, h: 0.38, d: 5.5, mat: "concrete", ry: -0.15 },
    ],
  },
  depot: {
    sunMul: 0.92,
    hemiMul: 0.95,
    ambMul: 1.12,
    fillMul: 0.95,
    bg: 0x627892,
    fogColor: 0x5a6a82,
    fogNear: 18,
    fogFar: 64,
    floorGrid: 1.15,
    floor: 0x7a8898,
    brick: 0x8898a8,
    pillar: 0xc8d4e4,
    obstacleTints: {
      crate: 0xf2e6d8,
      concrete: 0xdce4f0,
      barrier: 0xc8d4e4,
      rail: 0xd4dee8,
      stripe: 0xfff0e0,
    },
    pillars: [
      [0, 0],
      [14, 0],
      [-14, 0],
      [0, 14],
      [0, -14],
      [9, 9],
      [-9, -9],
      [10, -10],
      [-11, 8],
    ],
    blocks: [
      ...crateStack(5, 5, 2, 0.08),
      ...crateStack(-6, -5, 3, -0.1),
      { x: 0, z: 6, w: 22, h: 0.55, d: 1.8, mat: "rail", ry: 0 },
      { x: 0, z: -6, w: 22, h: 0.55, d: 1.8, mat: "rail", ry: 0 },
      { x: 6, z: 0, w: 1.8, h: 0.55, d: 14, mat: "rail", ry: 0 },
      { x: -6, z: 0, w: 1.8, h: 0.55, d: 14, mat: "rail", ry: 0 },
      { x: 12, z: -12, w: 3.5, h: 1.1, d: 3.5, mat: "crate", ry: 0.25, y: 0.55 },
      { x: -12, z: 11, w: 4, h: 0.45, d: 5, mat: "concrete", ry: 0 },
    ],
  },
  warehouse: {
    sunMul: 0.88,
    hemiMul: 0.9,
    ambMul: 1.18,
    fillMul: 1.15,
    bg: 0x546878,
    fogColor: 0x485a6a,
    fogNear: 14,
    fogFar: 58,
    floorGrid: 1.35,
    floor: 0x6a7a8c,
    brick: 0x788898,
    pillar: 0xb4c4d4,
    obstacleTints: {
      crate: 0xeee6dc,
      concrete: 0xd0d8e4,
      barrier: 0xb8c4d4,
      rail: 0xc4ccd8,
      stripe: 0xf5eee4,
    },
    pillars: [
      [-10, 0],
      [10, 0],
      [0, -11],
      [0, 11],
      [-6, -6],
      [6, 6],
      [-6, 6],
      [6, -6],
    ],
    blocks() {
      const b = [];
      const lanes = [-16, -8, 0, 8, 16];
      let t = 0;
      for (const z of lanes) {
        for (let i = 0; i < 5; i++) {
          const x = -16 + i * 8;
          if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
          t += 1;
          const pick = ((x * 47 + z * 31 + t * 19) % 100) / 100;
          if (pick > 0.62) continue;
          const levels = 1 + (Math.abs(x + z + t) % 3);
          b.push(...crateStack(x, z, levels, (x + z) * 0.018));
        }
      }
      b.push(
        { x: -20, z: 0, w: 0.55, h: 2.2, d: 24, mat: "barrier", ry: 0 },
        { x: 20, z: 0, w: 0.55, h: 2.2, d: 24, mat: "barrier", ry: 0 },
        { x: 0, z: 20, w: 24, h: 2.2, d: 0.55, mat: "barrier", ry: 0 },
        { x: 0, z: -18, w: 18, h: 1.4, d: 0.5, mat: "concrete", ry: 0 }
      );
      return b;
    },
  },
  crossing: {
    sunMul: 1.02,
    hemiMul: 1,
    ambMul: 1.02,
    fillMul: 1.05,
    bg: 0x88a0b8,
    fogColor: 0x7890a8,
    fogNear: 20,
    fogFar: 76,
    floorGrid: 1,
    floor: 0xb8c8d8,
    brick: 0xc8d8e8,
    pillar: 0xf0f6ff,
    obstacleTints: {
      crate: 0xfff2e8,
      concrete: 0xe8f0fa,
      barrier: 0xd8e4f2,
      rail: 0xe4ecf8,
      stripe: 0xfff8f0,
    },
    pillars: [
      [-14, -14],
      [14, -14],
      [-14, 14],
      [14, 14],
      [0, 12],
      [0, -12],
      [12, 0],
      [-12, 0],
    ],
    blocks: [
      { x: 0, z: 0, w: 5.5, h: 1.6, d: 1.1, mat: "concrete", ry: 0 },
      { x: 0, z: 0, w: 1.1, h: 1.6, d: 5.5, mat: "concrete", ry: 0 },
      { x: 8, z: 8, w: 6, h: 0.5, d: 6, mat: "stripe", ry: 0.785 },
      { x: -8, z: -8, w: 6, h: 0.5, d: 6, mat: "stripe", ry: 0.785 },
      { x: 8, z: -8, w: 5, h: 1.15, d: 0.45, mat: "barrier", ry: 0.55 },
      { x: -8, z: 8, w: 5, h: 1.15, d: 0.45, mat: "barrier", ry: -0.45 },
      ...crateStack(3, 15, 2, 0.1),
      ...crateStack(-15, -4, 2, -0.2),
    ],
  },
  playground: {
    sunMul: 1.1,
    hemiMul: 1.06,
    ambMul: 1,
    fillMul: 1.08,
    bg: 0x8ab4cf,
    fogColor: 0x7fa6c0,
    fogNear: 18,
    fogFar: 82,
    floorGrid: 1.1,
    floor: 0xb8d2e8,
    brick: 0xc9deef,
    pillar: 0xeaf5ff,
    obstacleTints: {
      crate: 0xf6eee4,
      concrete: 0xe9f2fb,
      barrier: 0xd6e4f4,
      rail: 0xdce8f7,
      stripe: 0xfff4d2,
    },
    pillars: [
      [-15, -15],
      [15, -15],
      [-15, 15],
      [15, 15],
      [-6, -10],
      [7, -9],
      [-8, 11],
      [9, 9],
    ],
    blocks: [
      { x: 0, z: -20.5, w: 41, h: 2.3, d: 0.62, mat: "barrier", ry: 0 },
      { x: 0, z: 20.5, w: 41, h: 2.3, d: 0.62, mat: "barrier", ry: 0 },
      { x: -20.5, z: 0, w: 0.62, h: 2.3, d: 41, mat: "barrier", ry: 0 },
      { x: 20.5, z: 0, w: 0.62, h: 2.3, d: 41, mat: "barrier", ry: 0 },
      // Denser maze walls with deliberate openings and dead ends
      { x: -13.5, z: -15, w: 12, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: 5.5, z: -15, w: 25, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -3, z: -11, w: 30, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -11.5, z: -7, w: 13, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: 10.5, z: -7, w: 15, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -6.5, z: -3, w: 21, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: 12, z: 1, w: 16, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -9.5, z: 5, w: 17, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: 2, z: 9, w: 28, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -12, z: 13, w: 16, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: 13.5, z: 13, w: 11, h: 2.1, d: 0.72, mat: "concrete", ry: 0 },
      { x: -16, z: -9, w: 0.72, h: 2.1, d: 18, mat: "rail", ry: 0 },
      { x: -8, z: 4, w: 0.72, h: 2.1, d: 24, mat: "rail", ry: 0 },
      { x: -1.5, z: -10.5, w: 0.72, h: 2.1, d: 11, mat: "rail", ry: 0 },
      { x: 4.5, z: 1.5, w: 0.72, h: 2.1, d: 27, mat: "rail", ry: 0 },
      { x: 11, z: -11, w: 0.72, h: 2.1, d: 18, mat: "rail", ry: 0 },
      { x: 16.5, z: 5.5, w: 0.72, h: 2.1, d: 20, mat: "rail", ry: 0 },
      { x: -4, z: 15.5, w: 8, h: 2.1, d: 0.72, mat: "stripe", ry: 0.22 },
      { x: 7.5, z: -1.5, w: 9, h: 2.1, d: 0.72, mat: "stripe", ry: -0.22 },
      // Trampolines as recessed pads in a few maze pockets
      { x: -17, z: -17, w: 2.7, h: 0.28, d: 2.7, trampoline: true, boost: 19.6, ry: 0 },
      { x: 17, z: -17, w: 2.7, h: 0.28, d: 2.7, trampoline: true, boost: 19.6, ry: 0 },
      { x: -17, z: 17, w: 2.7, h: 0.28, d: 2.7, trampoline: true, boost: 19.6, ry: 0 },
      { x: 17, z: 17, w: 2.7, h: 0.28, d: 2.7, trampoline: true, boost: 19.6, ry: 0 },
      { x: 0, z: 0, w: 3.1, h: 0.3, d: 3.1, trampoline: true, boost: 20.6, ry: 0 },
    ],
  },
  forest: {
    sunMul: 1.05,
    hemiMul: 1.14,
    ambMul: 0.86,
    fillMul: 1.06,
    bg: 0x4a6244,
    fogColor: 0x5a7254,
    fogNear: 26,
    fogFar: 94,
    pillarTopY: FOREST_TRUNK_H,
    pillarCollideHalf: 0.68,
    floorGrid: 0.38,
    floor: 0x66ef92,
    brick: 0x2d7a3e,
    pillar: 0x4a3320,
    obstacleTints: {
      crate: 0x656858,
      concrete: 0x4d5846,
      barrier: 0x424c3c,
      rail: 0x505648,
      stripe: 0x766858,
    },
    pillars: [
      [-14, -10],
      [10, -12],
      [-8, 4],
      [12, 8],
      [-3, -14],
      [6, 14],
      [0, 2],
      [-11, 11],
      [14, -3],
      [-16, 2],
      [8, -6],
      [-6, -6],
      [3, -8],
      [-12, -4],
      [16, 6],
      [-2, 16],
      [-9, -2],
      [11, 1],
    ],
    blocks: [
      { x: -4, z: 3, w: 2.4, h: 0.45, d: 3.4, mat: "concrete", ry: 0.22 },
      { x: 5, z: -5, w: 1.9, h: 0.52, d: 2.5, mat: "crate", ry: -0.14 },
      { x: -9, z: -8, w: 3.6, h: 0.38, d: 2.1, mat: "stripe", ry: 0.48 },
      { x: 11, z: 4, w: 2.5, h: 0.36, d: 2.6, mat: "concrete", ry: 0.85 },
      { x: -1, z: -11, w: 4.2, h: 0.48, d: 1.25, mat: "barrier", ry: 0.08 },
      { x: -15, z: 6, w: 1.25, h: 0.34, d: 2.9, mat: "crate", ry: 0.38 },
      { x: 7, z: 12, w: 2.7, h: 0.4, d: 1.9, mat: "concrete", ry: -0.32 },
      { x: 2, z: -4, w: 1.4, h: 0.32, d: 1.4, mat: "crate", ry: 0.55 },
    ],
  },
  practice2_obby: {
    sunMul: 1.1,
    hemiMul: 1.06,
    ambMul: 1.02,
    fillMul: 1.08,
    bg: 0x8ec8ea,
    fogColor: 0xa8d0ec,
    fogNear: 38,
    fogFar: 220,
    floorGrid: 1,
    floor: 0xc8daf0,
    brick: 0xd4e4f4,
    pillar: 0xe8f2fc,
    obstacleTints: {
      crate: 0xfff5ea,
      concrete: 0xecf2fa,
      barrier: 0xe2eaf6,
      rail: 0xf2f6fc,
      stripe: 0xfff8f0,
    },
    pillars: [],
    blocks() {
      const mats = ["stripe", "concrete", "crate", "barrier", "rail"];
      let mi = 0;
      const pick = () => mats[mi++ % mats.length];
      const b = [];
      const Ht = 0.15;
      const Yt = 0.48;
      b.push({ x: 0, z: 0, w: 4.6, h: 0.55, d: 4.6, y: 0.275, mat: "stripe" });

      const cx = 17.75,
        cz = -10.15;
      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 12; col++) {
          const fx = -7.4 + col * 2.15 + (row % 2) * 1.08;
          const fz = -17.2 + row * 1.98;
          if (fx * fx + fz * fz < 7.2) continue;
          const dSp = Math.hypot(fx - cx, fz - cz);
          if (dSp < 10.6 && fx > 7.2 && fz < -2.2) continue;
          if (fx > 22.5 || fx < -12 || fz > 7 || fz < -18.5) continue;
          b.push({
            x: fx,
            z: fz,
            w: 1.22,
            h: Ht,
            d: 1.22,
            y: Yt,
            mat: pick(),
            ry: (row * 13 + col) * 0.031,
          });
        }
      }

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 6; col++) {
          const fx = 10.5 + col * 2.05 + (row % 2) * 1.02;
          const fz = 1.2 + row * 1.95;
          if (Math.hypot(fx - 25.5, fz - 6.2) < 3.8) continue;
          b.push({
            x: fx,
            z: fz,
            w: 1.18,
            h: Ht,
            d: 1.18,
            y: Yt + 0.04,
            mat: pick(),
            ry: (row + col * 3) * 0.027,
          });
        }
      }

      const intro = [
        [4.05, 0, 0.62],
        [6.45, 0, 0.76],
        [8.75, 0, 0.9],
        [10.95, -0.78, 1.03],
        [12.95, -1.98, 1.14],
        [14.75, -3.35, 1.24],
        [16.05, -5.05, 1.32],
        [17, -6.85, 1.4],
      ];
      for (const [x, z, y] of intro) {
        b.push({ x, z, w: 1.58, h: Ht, d: 1.58, y, mat: pick(), ry: mi * 0.016 });
      }

      let ang = Math.atan2(-6.85 - cz, 17 - cx);
      let rad = Math.hypot(17 - cx, -6.85 - cz);
      for (let i = 0; i < 28; i++) {
        ang += 0.395;
        rad += 0.178;
        b.push({
          x: cx + Math.cos(ang) * rad,
          z: cz + Math.sin(ang) * rad,
          w: 1.45,
          h: Ht,
          d: 1.45,
          y: 1.62 + i * 0.118,
          mat: pick(),
          ry: ang * 0.14,
        });
      }

      let x = b[b.length - 1].x;
      let z = b[b.length - 1].z;
      let y = b[b.length - 1].y;
      const hop = (dx, dz, dy, w = 1.45, d = 1.45) => {
        x += dx;
        z += dz;
        y += dy;
        b.push({ x, z, w, h: Ht, d, y, mat: pick(), ry: mi * 0.018 });
      };
      hop(2, 0.82, 0.02);
      hop(1.88, 1.68, 0.035);

      for (let k = 0; k < 7; k++) {
        x += 1.88;
        z += k % 2 === 0 ? 0.26 : -0.3;
        b.push({
          x,
          z,
          w: 2.95,
          h: 0.14,
          d: 0.46,
          y: y + k * 0.025,
          mat: "rail",
          ry: 0.05 + k * 0.022,
        });
      }

      const weave = [
        [1.72, 2.02, 0.09],
        [1.62, 1.92, 0.1],
        [1.52, 1.82, 0.09],
        [1.42, 1.72, 0.1],
        [1.38, 1.62, 0.09],
        [1.33, 1.52, 0.09],
        [1.3, 1.45, 0.09],
        [1.28, 1.38, 0.09],
        [1.26, 1.32, 0.09],
        [1.28, 1.26, 0.09],
        [1.32, 1.22, 0.09],
        [1.38, 1.18, 0.09],
        [1.45, 1.15, 0.09],
        [1.52, 1.12, 0.09],
      ];
      for (const [dx, dz, dy] of weave) {
        x += dx;
        z += dz;
        y += dy;
        b.push({
          x,
          z,
          w: 1.42,
          h: Ht,
          d: 1.38,
          y,
          mat: pick(),
          ry: mi * 0.02,
        });
      }

      b.push({
        x: x + 1.82,
        z: z + 0.92,
        w: 2.75,
        h: 0.44,
        d: 2.75,
        y: y + 0.06,
        mat: "concrete",
        ry: 0.07,
      });
      x += 3.55;
      z += 1.7;
      y += 0.16;

      const finX = 25.55,
        finZ = 6.15,
        finY = 4.05;
      const nFin = 7;
      for (let i = 1; i <= nFin; i++) {
        const t = i / (nFin + 1);
        b.push({
          x: x + (finX - x) * t,
          z: z + (finZ - z) * t,
          w: 1.42,
          h: Ht,
          d: 1.42,
          y: y + (finY - y) * t,
          mat: pick(),
          ry: i * 0.038,
        });
      }

      b.push({
        x: finX,
        z: finZ,
        w: 2.5,
        h: 0.58,
        d: 2.5,
        y: finY,
        mat: "stripe",
        finish: true,
        ry: 0.05,
      });
      return b;
    },
  },
};

let activeMapId = "courtyard";

function rebuildLevel(mapId) {
  const p = MAP_PRESETS[mapId];
  if (!p) return;
  activeMapId = mapId;
  scene.background = null;
  if (skyShaderMaterial) {
    const fogC = new THREE.Color(p.fogColor);
    const bgC = new THREE.Color(p.bg);
    skyShaderMaterial.uniforms.uHorizon.value.set(fogC.r, fogC.g, fogC.b);
    skyShaderMaterial.uniforms.uZenith.value.set(
      THREE.MathUtils.clamp(bgC.r * 0.55 + 0.18, 0, 1),
      THREE.MathUtils.clamp(bgC.g * 0.55 + 0.28, 0, 1),
      THREE.MathUtils.clamp(bgC.b * 0.6 + 0.32, 0, 1)
    );
  }
  scene.fog.color.setHex(p.fogColor);
  scene.fog.near = p.fogNear;
  scene.fog.far = p.fogFar;
  floorBaseMat.color.setHex(p.floor);
  brickMat.color.setHex(p.brick);
  pillarMat.color.setHex(p.pillar);
  applyObstacleTints(p.obstacleTints);
  applyMapPresetLighting(p);

  const isForest = mapId === "forest";
  if (isForest) {
    ensureGrassFloorTextures();
    floorBaseMat.map = grassFloorMap;
    floorBaseMat.roughnessMap = grassFloorRoughMap;
    floorBaseMat.emissive.setHex(0x224830);
    floorBaseMat.emissiveIntensity = 0.1;
    floorBaseMat.roughness = 0.94;
    brickMat.emissive.setHex(0x0e3018);
    brickMat.emissiveIntensity = 0.065;
    pillarMat.map = null;
    pillarMat.roughnessMap = null;
    pillarMat.roughness = 0.93;
    pillarMat.metalness = 0.02;
  } else {
    floorBaseMat.map = floorGridMap;
    floorBaseMat.roughnessMap = floorRoughMap;
    floorBaseMat.emissive.setHex(0x151a22);
    floorBaseMat.emissiveIntensity = 0.025;
    floorBaseMat.roughness = 1;
    brickMat.emissive.setHex(0x121820);
    brickMat.emissiveIntensity = 0.022;
    pillarMat.map = panelTex.map;
    pillarMat.roughnessMap = panelTex.roughnessMap;
    pillarMat.roughness = 1;
    pillarMat.metalness = 0;
  }

  const fg = (p.floorGrid ?? 1) * ARENA * 2;
  floorGridMap.repeat.set(fg, fg);

  while (pillarsRoot.children.length) pillarsRoot.remove(pillarsRoot.children[0]);
  clearForestFoliage();
  for (const [px, pz] of p.pillars) {
    const geo = isForest ? forestTrunkGeo : pillarGeo;
    const col = new THREE.Mesh(geo, pillarMat);
    const cy = isForest ? FOREST_TRUNK_H * 0.5 : 2.7;
    col.position.set(px, cy, pz);
    col.castShadow = true;
    col.receiveShadow = true;
    pillarsRoot.add(col);
  }
  if (isForest) {
    buildForestBranches(p.pillars, pillarMat);
    buildForestTreeCrowns(p.pillars);
  }

  rebuildObstacles(p);
  rebuildColliders(p);
  const isPractice2Obby = mapId === "practice2_obby";
  floor.visible = !isPractice2Obby;
  wallBricks.visible = !isPractice2Obby;
}

const mapSelectEl = document.getElementById("map-select");
const mapBlurbEl = document.getElementById("map-blurb");

function rebuildLevelForCurrentPracticeState() {
  if (practiceMode2 && MAP_PRESETS.practice2_obby) rebuildLevel("practice2_obby");
  else {
    const v = mapSelectEl?.value;
    if (v && MAP_PRESETS[v]) rebuildLevel(v);
  }
}

const MAP_BLURBS = {
  courtyard: "Open courtyard with pillars, scattered crates, barriers, and hazard-marked slabs.",
  depot: "Central rails and crossing lanes — tight sightlines and symmetrical rotations.",
  warehouse: "Dense crate aisles and long walls — close-quarters flanks.",
  crossing: "Four corners and a raised center cross — control mid or rotate wide.",
  playground:
    "Maze playground: long alternating corridors, dead-ends, and trampoline escape pockets.",
  forest:
    "Wild woods — fast wolves (50 HP, fierce bites) and rare heavy bears (150 HP, slow but brutal). No human hostiles.",
};

function updateMapBlurb() {
  if (!mapBlurbEl || !mapSelectEl) return;
  mapBlurbEl.textContent = MAP_BLURBS[mapSelectEl.value] ?? "";
}

function closeMenuModals() {
  document.querySelectorAll("#overlay .menu-modal").forEach((el) => {
    if (el.id === "menu-modal-input-layout") return;
    el.classList.add("hidden");
  });
}

function openMenuModal(elId) {
  inputLayoutModalOpen = false;
  closeMenuModals();
  document.getElementById(elId)?.classList.remove("hidden");
  updateInputLayoutModalVisibility();
}

overlay?.addEventListener("click", (e) => {
  const t = e.target;
  if (t && "closest" in t && t.closest("[data-close-menu-modal]")) closeMenuModals();
});

document.getElementById("menu-open-controls")?.addEventListener("click", () => {
  openMenuModal("menu-modal-controls");
});
document.getElementById("menu-open-loadout")?.addEventListener("click", () => {
  openMenuModal("menu-modal-loadout");
});
document.getElementById("menu-open-map")?.addEventListener("click", () => {
  openMenuModal("menu-modal-map");
  updateMapBlurb();
});

mapSelectEl?.addEventListener("change", () => {
  const v = mapSelectEl.value;
  if (readPracticeReactionMode() && MAP_PRESETS.practice2_obby) rebuildLevel("practice2_obby");
  else if (MAP_PRESETS[v]) rebuildLevel(v);
  updateMapBlurb();
});

if (readPracticeReactionMode() && MAP_PRESETS.practice2_obby) rebuildLevel("practice2_obby");
else
  rebuildLevel(mapSelectEl?.value && MAP_PRESETS[mapSelectEl.value] ? mapSelectEl.value : "courtyard");
updateMapBlurb();

practiceModeEl?.addEventListener("change", () => {
  enforceExclusivePracticeModes("p1");
  syncMenuObjectiveForPractice();
});
practiceMode2El?.addEventListener("change", () => {
  enforceExclusivePracticeModes("p2");
  syncMenuObjectiveForPractice();
});
syncMenuObjectiveForPractice();

const GUN_HIP_POS = new THREE.Vector3(0.26, -0.335, -0.52);
const GUN_HIP_EULER = new THREE.Euler(0.03, 0.05, 0);
/** ADS: rear ring sits lower + farther forward than front so both stack on screen (E). */
const GUN_ADS_POS = new THREE.Vector3(0, -0.145, -0.355);
const GUN_ADS_EULER = new THREE.Euler(0.02, 0, 0);
const qGunHip = new THREE.Quaternion().setFromEuler(GUN_HIP_EULER);
const qGunAds = new THREE.Quaternion().setFromEuler(GUN_ADS_EULER);
const qGunBlend = new THREE.Quaternion();

const gunGroup = new THREE.Group();
gunGroup.position.copy(GUN_HIP_POS);
gunGroup.rotation.copy(GUN_HIP_EULER);
camera.add(gunGroup);

/** First-person resupply kit (slot 4); follows same sway as gun while utility is active. */
const utilityKitGroup = new THREE.Group();
utilityKitGroup.visible = false;
camera.add(utilityKitGroup);

/** Rifle-class primaries: slight X squash for silhouette. */
const GUN_MODEL_SCALE_X = 0.88;

function addBox(parent, w, h, d, x, y, z, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.95,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const UK_CRATE = 0x8f7358;
const UK_STRAP = 0x4a3d32;
const UK_TAG = 0xc9a545;
const utilityMedkitGroup = new THREE.Group();
utilityKitGroup.add(utilityMedkitGroup);
addBox(utilityMedkitGroup, 0.2, 0.15, 0.17, 0, -0.03, 0.02, UK_CRATE, { roughness: 0.9, metalness: 0 });
addBox(utilityMedkitGroup, 0.048, 0.17, 0.18, 0, -0.03, 0.021, UK_STRAP, { roughness: 0.94, metalness: 0 });
addBox(utilityMedkitGroup, 0.22, 0.048, 0.15, 0, -0.03, 0.022, UK_STRAP, { roughness: 0.94, metalness: 0 });
addBox(utilityMedkitGroup, 0.07, 0.028, 0.09, 0.055, -0.01, 0.088, UK_TAG, {
  roughness: 0.85,
  metalness: 0,
  emissive: 0x6a4810,
  emissiveIntensity: 0.22,
});
const utilityGrenadeGroup = new THREE.Group();
utilityGrenadeGroup.visible = false;
utilityKitGroup.add(utilityGrenadeGroup);
const heldGrenade = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 11, 11),
  new THREE.MeshStandardMaterial({
    color: 0x4b525d,
    roughness: 0.64,
    metalness: 0.2,
    emissive: 0x171a20,
    emissiveIntensity: 0.14,
  })
);
heldGrenade.position.set(0.02, -0.02, 0.045);
heldGrenade.castShadow = true;
utilityGrenadeGroup.add(heldGrenade);
addBox(utilityGrenadeGroup, 0.046, 0.018, 0.032, 0.02, 0.056, 0.04, 0x2a2f38, { roughness: 0.72, metalness: 0.16 });
addBox(utilityGrenadeGroup, 0.012, 0.03, 0.012, 0.056, 0.064, 0.036, 0x4a4f58, { roughness: 0.7, metalness: 0.24 });

function createLeatherGloveHandTextures() {
  const res = 128;
  const c = document.createElement("canvas");
  const r = document.createElement("canvas");
  c.width = c.height = res;
  r.width = r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const n = fbmTile(x * 1.05, y * 1.05, res);
      const grain = Math.sin(x * 0.38 + y * 0.24) * 0.5 + 0.5;
      const lum = THREE.MathUtils.clamp(22 + n * 36 + grain * 20, 0, 255);
      const i = (y * res + x) * 4;
      d[i] = lum * 0.92;
      d[i + 1] = lum * 0.88;
      d[i + 2] = lum * 0.85;
      d[i + 3] = 255;
      const rough = 0.76 + n * 0.22;
      const rv = rough * 255;
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughnessMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1, 1, true);
  finishRepeatTexture(roughnessMap, 1, 1, false);
  return { map, roughnessMap };
}

function knuckleRingMask(px, py, cx, cy, radius, thick) {
  const d = Math.hypot(px - cx, py - cy);
  return THREE.MathUtils.clamp(1 - Math.abs(d - radius) / thick, 0, 1);
}

/** Skin + brass ring detail for primary viewmodel hands when loadout melee is knuckles. */
function createBrassKnuckleFistHandTextures() {
  const res = 256;
  const c = document.createElement("canvas");
  const r = document.createElement("canvas");
  c.width = c.height = res;
  r.width = r.height = res;
  const g = c.getContext("2d");
  const gr = r.getContext("2d");
  const img = g.createImageData(res, res);
  const imgr = gr.createImageData(res, res);
  const d = img.data;
  const dr = imgr.data;
  const rowY = [0.38, 0.38, 0.38, 0.38, 0.55, 0.55];
  const rowX = [0.17, 0.36, 0.55, 0.74, 0.3, 0.62];
  const rowR = [0.034, 0.034, 0.034, 0.034, 0.03, 0.03];
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const n = fbmTile(x * 0.55, y * 0.55, res);
      let R = 218 + n * 32;
      let G = 178 + n * 26;
      let B = 145 + n * 22;
      const fx = x / res;
      const fy = y / res;
      const crease =
        Math.abs(Math.sin(fx * Math.PI * 7 + fy * 1.2)) * (fy > 0.15 && fy < 0.92 ? 0.14 : 0);
      R *= 1 - crease;
      G *= 1 - crease;
      B *= 1 - crease;
      let bw = 0;
      for (let k = 0; k < rowY.length; k++) {
        bw = Math.max(
          bw,
          knuckleRingMask(px, py, rowX[k] * res, rowY[k] * res, rowR[k] * res, res * 0.012)
        );
      }
      bw = Math.min(1, bw * 1.15);
      R = THREE.MathUtils.lerp(R, 218, bw);
      G = THREE.MathUtils.lerp(G, 168, bw);
      B = THREE.MathUtils.lerp(B, 58, bw);
      let rough = THREE.MathUtils.lerp(0.7 + n * 0.22, 0.22 + n * 0.08, bw);
      const i = (y * res + x) * 4;
      d[i] = THREE.MathUtils.clamp(R, 0, 255);
      d[i + 1] = THREE.MathUtils.clamp(G, 0, 255);
      d[i + 2] = THREE.MathUtils.clamp(B, 0, 255);
      d[i + 3] = 255;
      const rv = THREE.MathUtils.clamp(rough * 255, 0, 255);
      dr[i] = dr[i + 1] = dr[i + 2] = rv;
      dr[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  gr.putImageData(imgr, 0, 0);
  const map = new THREE.CanvasTexture(c);
  const roughnessMap = new THREE.CanvasTexture(r);
  finishRepeatTexture(map, 1, 1, true);
  finishRepeatTexture(roughnessMap, 1, 1, false);
  return { map, roughnessMap };
}

const gloveHandTex = createLeatherGloveHandTextures();
const knuckleFistTex = createBrassKnuckleFistHandTextures();
const gloveHandMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: gloveHandTex.map,
  roughnessMap: gloveHandTex.roughnessMap,
  roughness: 1,
  metalness: 0,
});
const knuckleFistHandMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: knuckleFistTex.map,
  roughnessMap: knuckleFistTex.roughnessMap,
  roughness: 1,
  metalness: 0.06,
});

const VIEWMODEL_HAND_GEO = new THREE.BoxGeometry(0.14, 0.1, 0.22);
const viewmodelPrimaryHandMeshes = [];

function updatePrimaryHandMaterials() {
  const mat =
    loadoutChoice[SLOT_MELEE] === MELEE_INDEX_KNUCKLES ? knuckleFistHandMat : gloveHandMat;
  for (const m of viewmodelPrimaryHandMeshes) {
    m.material = mat;
  }
}

function addViewmodelHands(parent) {
  const slots = [
    [-0.14, -0.06, 0.02],
    [0.1, -0.05, 0.02],
  ];
  for (const [x, y, z] of slots) {
    const m = new THREE.Mesh(VIEWMODEL_HAND_GEO, gloveHandMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    viewmodelPrimaryHandMeshes.push(m);
  }
}

function attachPrimaryMuzzle(parent, x, y, z, lightR = 4) {
  const mw = new THREE.Object3D();
  mw.position.set(x, y, z);
  parent.add(mw);
  const light = new THREE.PointLight(0xffccd0, 0, lightR);
  light.position.copy(mw.position);
  parent.add(light);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffaaee,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0,
    })
  );
  flash.position.copy(mw.position);
  parent.add(flash);
  return { muzzle: mw, light, flash };
}

function attachSecondaryMuzzle(parent, x, y, z, lightR = 3.2, rad = 0.045) {
  const mw = new THREE.Object3D();
  mw.position.set(x, y, z);
  parent.add(mw);
  const light = new THREE.PointLight(0xffccd0, 0, lightR);
  light.position.copy(mw.position);
  parent.add(light);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(rad, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffaaee,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0,
    })
  );
  flash.position.copy(mw.position);
  parent.add(flash);
  return { muzzle: mw, light, flash };
}

const primaryModels = [];
const primaryMuzzleWorld = [];
const primaryMuzzleLights = [];
const primaryMuzzleFlashes = [];

const gunModel = new THREE.Group();
gunModel.scale.set(GUN_MODEL_SCALE_X, 1, 1);
gunGroup.add(gunModel);
primaryModels.push(gunModel);

addViewmodelHands(gunModel);

/** Tan / black modular rifle silhouette (SCAR-style reference). */
const arTan = 0xd8a878;
const arTanDeep = 0xb08050;
const arBlack = 0x121418;

addBox(gunModel, 0.09, 0.128, 0.37, 0, 0.018, -0.04, arTan, { roughness: 0.94, metalness: 0 });
addBox(gunModel, 0.082, 0.088, 0.2, 0, -0.048, 0.09, arTanDeep, { roughness: 0.96, metalness: 0 });
addBox(gunModel, 0.048, 0.112, 0.078, 0, -0.14, 0.102, arTan, { roughness: 0.95, metalness: 0 });

addBox(gunModel, 0.074, 0.112, 0.23, 0, 0.022, -0.33, arTan, { roughness: 0.93, metalness: 0 });
for (const sx of [-0.038, 0.038]) {
  addBox(gunModel, 0.024, 0.038, 0.105, sx, 0.02, -0.34, arBlack, { roughness: 0.96, metalness: 0.06 });
}
addBox(gunModel, 0.05, 0.017, 0.12, 0, 0.092, -0.33, arBlack, { roughness: 0.96, metalness: 0.05 });

addBox(gunModel, 0.062, 0.022, 0.37, 0, 0.096, -0.055, 0x252830, { roughness: 0.9, metalness: 0.06 });
for (const sx of [-0.022, 0.022]) {
  addBox(gunModel, 0.012, 0.014, 0.32, sx, 0.112, -0.055, arBlack, { roughness: 0.92, metalness: 0.08 });
}

addBox(gunModel, 0.044, 0.05, 0.065, 0, 0.041, -0.515, arBlack, { roughness: 0.9, metalness: 0.07 });

const barrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.023, 0.33, 10),
  new THREE.MeshStandardMaterial({
    color: arBlack,
    metalness: 0.1,
    roughness: 0.86,
  })
);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.042, -0.625);
barrel.castShadow = true;
gunModel.add(barrel);

addBox(gunModel, 0.03, 0.03, 0.045, 0, 0.042, -0.772, arBlack, { roughness: 0.88, metalness: 0.12 });

addBox(gunModel, 0.052, 0.098, 0.088, 0, -0.11, 0.065, arBlack, { roughness: 0.94, metalness: 0.04 });
addBox(gunModel, 0.048, 0.078, 0.068, 0, -0.178, 0.048, arBlack, { roughness: 0.95, metalness: 0.04 });

addBox(gunModel, 0.072, 0.078, 0.2, 0, 0.012, 0.31, arTanDeep, { roughness: 0.95, metalness: 0 });
addBox(gunModel, 0.064, 0.096, 0.09, 0, 0.018, 0.212, arTan, { roughness: 0.93, metalness: 0 });
addBox(gunModel, 0.068, 0.038, 0.058, 0, 0.036, 0.418, arBlack, { roughness: 0.96, metalness: 0.05 });

const ringSide = THREE.DoubleSide;
const ringMatRear = new THREE.MeshStandardMaterial({
  color: 0x1e2026,
  metalness: 0.04,
  roughness: 0.98,
  side: ringSide,
});
const ringMatFront = new THREE.MeshStandardMaterial({
  color: 0x181a20,
  metalness: 0.04,
  roughness: 0.98,
  side: ringSide,
});

/** Open rings (no solid center) — XY plane, perpendicular to barrel (-Z). */
const ringSegs = 64;
const rearRing = new THREE.Mesh(new THREE.RingGeometry(0.017, 0.025, ringSegs), ringMatRear);
rearRing.position.set(0, 0.056, 0.092);
rearRing.scale.set(1 / GUN_MODEL_SCALE_X, 1, 1);
gunModel.add(rearRing);


const frontSightRing = new THREE.Mesh(new THREE.RingGeometry(0.034, 0.046, ringSegs), ringMatFront);
frontSightRing.position.set(0, 0.108, -0.445);
frontSightRing.scale.set(1 / GUN_MODEL_SCALE_X, 1, 1);
gunModel.add(frontSightRing);

const muzzleWorld = new THREE.Object3D();
muzzleWorld.position.set(0, 0.042, -0.798);
gunModel.add(muzzleWorld);

const muzzleLight = new THREE.PointLight(0xffccd0, 0, 4);
muzzleLight.position.copy(muzzleWorld.position);
gunModel.add(muzzleLight);

const muzzleFlashMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 8, 8),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffaaee,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0,
  })
);
muzzleFlashMesh.position.copy(muzzleWorld.position);
gunModel.add(muzzleFlashMesh);

primaryMuzzleWorld.push(muzzleWorld);
primaryMuzzleLights.push(muzzleLight);
primaryMuzzleFlashes.push(muzzleFlashMesh);

/** --- Primary variant: battle rifle (long barrel + optic) --- */
const primaryBattleGroup = new THREE.Group();
primaryBattleGroup.scale.set(GUN_MODEL_SCALE_X, 1, 1);
primaryBattleGroup.visible = false;
gunGroup.add(primaryBattleGroup);
primaryModels.push(primaryBattleGroup);
addViewmodelHands(primaryBattleGroup);
addBox(primaryBattleGroup, 0.096, 0.152, 0.46, 0, 0.02, -0.06, COLORS.tan);
addBox(primaryBattleGroup, 0.088, 0.108, 0.24, 0, -0.038, 0.08, COLORS.tanDark);
const brBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.024, 0.028, 0.52, 10),
  new THREE.MeshStandardMaterial({
    color: COLORS.black,
    metalness: 0,
    roughness: 0.96,
  })
);
brBarrel.rotation.x = Math.PI / 2;
brBarrel.position.set(0, 0.042, -0.46);
brBarrel.castShadow = true;
primaryBattleGroup.add(brBarrel);
addBox(primaryBattleGroup, 0.044, 0.034, 0.22, 0, 0.118, -0.02, 0x2a3038, {
  metalness: 0,
  roughness: 1,
});
addBox(primaryBattleGroup, 0.056, 0.018, 0.08, 0, 0.1, 0.12, 0xd4a84b, { roughness: 1, metalness: 0 });
const brM = attachPrimaryMuzzle(primaryBattleGroup, 0, 0.042, -0.74);
primaryMuzzleWorld.push(brM.muzzle);
primaryMuzzleLights.push(brM.light);
primaryMuzzleFlashes.push(brM.flash);

/** --- Primary variant: SMG (compact + foregrip) --- */
const primarySmgGroup = new THREE.Group();
primarySmgGroup.scale.set(GUN_MODEL_SCALE_X, 1, 1);
primarySmgGroup.visible = false;
gunGroup.add(primarySmgGroup);
primaryModels.push(primarySmgGroup);
addViewmodelHands(primarySmgGroup);
addBox(primarySmgGroup, 0.08, 0.115, 0.26, 0, 0.02, -0.04, 0x8b7355);
addBox(primarySmgGroup, 0.072, 0.088, 0.16, 0, -0.03, 0.06, 0x6a5540);
const smgBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.016, 0.02, 0.2, 8),
  new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0, roughness: 0.96 })
);
smgBarrel.rotation.x = Math.PI / 2;
smgBarrel.position.set(0, 0.038, -0.32);
smgBarrel.castShadow = true;
primarySmgGroup.add(smgBarrel);
addBox(primarySmgGroup, 0.038, 0.11, 0.055, 0, -0.055, 0.05, COLORS.black, { roughness: 0.96, metalness: 0 });
addBox(primarySmgGroup, 0.034, 0.08, 0.05, 0, -0.04, -0.16, 0x3d4a36, { roughness: 0.95, metalness: 0 });
addBox(primarySmgGroup, 0.05, 0.02, 0.2, 0, 0.09, -0.08, 0xc9a86c, { roughness: 1, metalness: 0 });
const smgM = attachPrimaryMuzzle(primarySmgGroup, 0, 0.038, -0.44);
primaryMuzzleWorld.push(smgM.muzzle);
primaryMuzzleLights.push(smgM.light);
primaryMuzzleFlashes.push(smgM.flash);

/** --- Primary variant: shotgun (twin barrels + pump) --- */
const primaryShotgunGroup = new THREE.Group();
primaryShotgunGroup.scale.set(GUN_MODEL_SCALE_X, 1, 1);
primaryShotgunGroup.visible = false;
gunGroup.add(primaryShotgunGroup);
primaryModels.push(primaryShotgunGroup);
addViewmodelHands(primaryShotgunGroup);
addBox(primaryShotgunGroup, 0.11, 0.138, 0.3, 0, 0.018, -0.05, 0x7a6048);
addBox(primaryShotgunGroup, 0.09, 0.095, 0.06, 0, -0.02, 0.14, 0x5c4a38);
for (const ox of [-0.02, 0.02]) {
  const bc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.36, 8),
    new THREE.MeshStandardMaterial({ color: 0x252830, metalness: 0, roughness: 0.96 })
  );
  bc.rotation.x = Math.PI / 2;
  bc.position.set(ox, 0.04, -0.38);
  bc.castShadow = true;
  primaryShotgunGroup.add(bc);
}
addBox(primaryShotgunGroup, 0.1, 0.085, 0.07, 0, 0.02, -0.22, 0x4a5648, { roughness: 0.95, metalness: 0 });
addBox(primaryShotgunGroup, 0.06, 0.08, 0.16, 0, 0.02, 0.12, 0x3d2e22, { roughness: 1, metalness: 0 });
const sgM = attachPrimaryMuzzle(primaryShotgunGroup, 0, 0.04, -0.58, 4.5);
primaryMuzzleWorld.push(sgM.muzzle);
primaryMuzzleLights.push(sgM.light);
primaryMuzzleFlashes.push(sgM.flash);

/** --- Primary variant: sniper (long barrel + scope) --- */
const primarySniperGroup = new THREE.Group();
primarySniperGroup.scale.set(GUN_MODEL_SCALE_X, 1, 1);
primarySniperGroup.visible = false;
gunGroup.add(primarySniperGroup);
primaryModels.push(primarySniperGroup);
addViewmodelHands(primarySniperGroup);
addBox(primarySniperGroup, 0.1, 0.14, 0.58, 0, 0.03, -0.12, 0x6f5e4a);
addBox(primarySniperGroup, 0.088, 0.11, 0.22, 0, -0.04, 0.15, 0x463b2e);
const snBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.015, 0.018, 0.9, 10),
  new THREE.MeshStandardMaterial({ color: 0x1f2329, metalness: 0, roughness: 0.94 })
);
snBarrel.rotation.x = Math.PI / 2;
snBarrel.position.set(0, 0.05, -0.64);
snBarrel.castShadow = true;
primarySniperGroup.add(snBarrel);
addBox(primarySniperGroup, 0.04, 0.022, 0.44, 0, 0.11, -0.2, 0x20242b, { roughness: 0.92, metalness: 0 });
const snScopeBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 0.38, 12),
  new THREE.MeshStandardMaterial({ color: 0x272b31, roughness: 0.88, metalness: 0 })
);
snScopeBody.rotation.x = Math.PI / 2;
snScopeBody.position.set(0, 0.13, -0.19);
snScopeBody.castShadow = true;
primarySniperGroup.add(snScopeBody);
addBox(primarySniperGroup, 0.036, 0.034, 0.032, 0, 0.086, -0.08, 0x1b1f24, { roughness: 0.9, metalness: 0 });
addBox(primarySniperGroup, 0.036, 0.034, 0.032, 0, 0.086, -0.3, 0x1b1f24, { roughness: 0.9, metalness: 0 });
const snM = attachPrimaryMuzzle(primarySniperGroup, 0, 0.05, -1.02, 5.2, 0.048);
primaryMuzzleWorld.push(snM.muzzle);
primaryMuzzleLights.push(snM.light);
primaryMuzzleFlashes.push(snM.flash);

/** Glock-style pistol — blocky slide, stippled rear, polymer grip, rail, squared guard (FP silhouette). */
const handgunModel = new THREE.Group();
handgunModel.visible = false;
handgunModel.scale.set(0.74, 0.74, 0.74);
gunGroup.add(handgunModel);

const hgGrip = 0x19191d;
const hgFrame = 0x1e1e22;
const hgSlide = 0x303036;

addBox(handgunModel, 0.074, 0.15, 0.092, 0, -0.062, 0.118, hgGrip, { roughness: 0.92, metalness: 0 });
addBox(handgunModel, 0.046, 0.1, 0.044, 0.01, -0.04, 0.172, hgGrip, { roughness: 0.9, metalness: 0 });
addBox(handgunModel, 0.068, 0.058, 0.12, 0, 0.008, 0.025, hgFrame, { roughness: 0.88, metalness: 0 });
addBox(handgunModel, 0.058, 0.044, 0.36, 0, 0.026, -0.095, hgSlide, { metalness: 0, roughness: 0.92 });
const hgSlideTopMat = new THREE.MeshStandardMaterial({
  color: 0x4d525c,
  roughness: 0.9,
  metalness: 0,
  emissive: 0x101418,
  emissiveIntensity: 0.02,
});
const hgSlideTop = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.014, 0.33), hgSlideTopMat);
hgSlideTop.position.set(0, 0.054, -0.095);
hgSlideTop.castShadow = true;
handgunModel.add(hgSlideTop);
for (let i = 0; i < 6; i++) {
  addBox(
    handgunModel,
    0.005,
    0.032,
    0.02,
    -0.031,
    0.028,
    0.052 + i * 0.026,
    0x232328,
    { metalness: 0, roughness: 0.94 }
  );
}
addBox(handgunModel, 0.024, 0.018, 0.08, 0.028, 0.022, -0.04, 0x222226, { metalness: 0, roughness: 0.95 });
addBox(handgunModel, 0.036, 0.016, 0.06, 0, -0.028, -0.22, 0x2a2a30, { metalness: 0, roughness: 0.93 });
addBox(handgunModel, 0.062, 0.014, 0.072, 0, -0.046, -0.015, hgFrame, { roughness: 0.9, metalness: 0 });
addBox(handgunModel, 0.014, 0.036, 0.014, -0.03, -0.058, -0.04, hgFrame, { roughness: 0.9, metalness: 0 });
addBox(handgunModel, 0.012, 0.028, 0.022, -0.022, -0.052, 0.01, 0x151518, { metalness: 0, roughness: 0.94 });

const hgBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.011, 0.0135, 0.12, 8),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    metalness: 0,
    roughness: 0.96,
  })
);
hgBarrel.rotation.x = Math.PI / 2;
hgBarrel.position.set(0, 0.022, -0.268);
hgBarrel.castShadow = true;
handgunModel.add(hgBarrel);

const hgFrontSight = new THREE.Mesh(
  new THREE.BoxGeometry(0.016, 0.028, 0.012),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    metalness: 0,
    roughness: 0.95,
  })
);
hgFrontSight.position.set(0, 0.048, -0.268);
hgFrontSight.castShadow = true;
handgunModel.add(hgFrontSight);

const hgRearSight = new THREE.Mesh(
  new THREE.BoxGeometry(0.022, 0.018, 0.014),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    metalness: 0,
    roughness: 0.95,
  })
);
hgRearSight.position.set(0, 0.045, 0.02);
hgRearSight.castShadow = true;
handgunModel.add(hgRearSight);

const muzzleWorldHG = new THREE.Object3D();
muzzleWorldHG.position.set(0, 0.022, -0.318);
handgunModel.add(muzzleWorldHG);

const muzzleLightHG = new THREE.PointLight(0xffccd0, 0, 3.2);
muzzleLightHG.position.copy(muzzleWorldHG.position);
handgunModel.add(muzzleLightHG);

const muzzleFlashMeshHG = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 8, 8),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffaaee,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0,
  })
);
muzzleFlashMeshHG.position.copy(muzzleWorldHG.position);
handgunModel.add(muzzleFlashMeshHG);

const secondaryModels = [handgunModel];
const secondaryMuzzleWorld = [muzzleWorldHG];
const secondaryMuzzleLights = [muzzleLightHG];
const secondaryMuzzleFlashes = [muzzleFlashMeshHG];

const hgHeavyGrip = 0x2a2420;
const hgHeavyFrame = 0x222428;
const hgHeavySlide = 0x3a3e48;

const handgunHeavyModel = new THREE.Group();
handgunHeavyModel.visible = false;
handgunHeavyModel.scale.set(0.74, 0.74, 0.74);
gunGroup.add(handgunHeavyModel);
secondaryModels.push(handgunHeavyModel);

addBox(handgunHeavyModel, 0.08, 0.162, 0.098, 0, -0.064, 0.122, hgHeavyGrip, {
  roughness: 0.92,
  metalness: 0,
});
addBox(handgunHeavyModel, 0.048, 0.102, 0.048, 0.012, -0.042, 0.178, hgHeavyGrip, {
  roughness: 0.9,
  metalness: 0,
});
addBox(handgunHeavyModel, 0.074, 0.062, 0.125, 0, 0.01, 0.028, hgHeavyFrame, {
  roughness: 0.88,
  metalness: 0,
});
addBox(handgunHeavyModel, 0.066, 0.052, 0.4, 0, 0.028, -0.098, hgHeavySlide, {
  metalness: 0,
  roughness: 0.92,
});
addBox(handgunHeavyModel, 0.052, 0.018, 0.34, 0, 0.056, -0.098, 0x5a606c, {
  roughness: 0.9,
  metalness: 0,
});
const hhBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.013, 0.0155, 0.15, 8),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a1e,
    metalness: 0,
    roughness: 0.96,
  })
);
hhBarrel.rotation.x = Math.PI / 2;
hhBarrel.position.set(0, 0.024, -0.286);
hhBarrel.castShadow = true;
handgunHeavyModel.add(hhBarrel);
addBox(handgunHeavyModel, 0.02, 0.034, 0.088, 0.034, 0.024, -0.045, 0x222226, {
  metalness: 0,
  roughness: 0.95,
});
const hhMZ = attachSecondaryMuzzle(handgunHeavyModel, 0, 0.024, -0.352, 3.5, 0.055);
secondaryMuzzleWorld.push(hhMZ.muzzle);
secondaryMuzzleLights.push(hhMZ.light);
secondaryMuzzleFlashes.push(hhMZ.flash);

const revolverModel = new THREE.Group();
revolverModel.visible = false;
revolverModel.scale.set(0.74, 0.74, 0.74);
gunGroup.add(revolverModel);
secondaryModels.push(revolverModel);

addBox(revolverModel, 0.076, 0.148, 0.086, 0, -0.06, 0.12, 0x3e2e22, { roughness: 0.92, metalness: 0 });
addBox(revolverModel, 0.062, 0.052, 0.1, 0, -0.015, 0.025, 0x2a221c, { roughness: 0.88, metalness: 0 });
const revCyl = new THREE.Mesh(
  new THREE.CylinderGeometry(0.049, 0.049, 0.09, 6),
  new THREE.MeshStandardMaterial({
    color: 0x5a6270,
    metalness: 0,
    roughness: 0.88,
  })
);
revCyl.rotation.z = Math.PI / 2;
revCyl.position.set(0, 0.018, 0.032);
revCyl.castShadow = true;
revolverModel.add(revCyl);
const revBarrel = new THREE.Mesh(
  new THREE.CylinderGeometry(0.013, 0.015, 0.158, 8),
  new THREE.MeshStandardMaterial({
    color: 0x222428,
    metalness: 0,
    roughness: 0.96,
  })
);
revBarrel.rotation.x = Math.PI / 2;
revBarrel.position.set(0, 0.026, -0.206);
revBarrel.castShadow = true;
revolverModel.add(revBarrel);
addBox(revolverModel, 0.03, 0.024, 0.045, 0, 0.05, -0.226, 0x1a1a1e, { roughness: 0.95, metalness: 0 });
const revM = attachSecondaryMuzzle(revolverModel, 0, 0.026, -0.302, 3.2, 0.048);
secondaryMuzzleWorld.push(revM.muzzle);
secondaryMuzzleLights.push(revM.light);
secondaryMuzzleFlashes.push(revM.flash);

const knifeModel = new THREE.Group();
knifeModel.visible = false;
knifeModel.position.set(0.13, -0.19, -0.44);
knifeModel.scale.set(1.12, 1.12, 1.12);
gunGroup.add(knifeModel);
knifeSwingPivot = new THREE.Group();
knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
knifeModel.add(knifeSwingPivot);

const knifeMaps = createKnifeProceduralTextures();

const bladeSteelMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: knifeMaps.bladeColorMap,
  roughnessMap: knifeMaps.bladeRoughnessMap,
  metalness: 0,
  roughness: 1,
});
const bladeDarkMat = new THREE.MeshStandardMaterial({
  color: 0x1c1e24,
  metalness: 0,
  roughness: 1,
});
const handleRubberMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: knifeMaps.handleColorMap,
  roughnessMap: knifeMaps.handleRoughnessMap,
  metalness: 0,
  roughness: 1,
});
const pinMat = new THREE.MeshStandardMaterial({
  color: 0xf0f4fa,
  metalness: 0,
  roughness: 1,
});

function addKnifeMesh(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const meleeVariantRoots = [];
const meleeKnifeRoot = new THREE.Group();
meleeVariantRoots.push(meleeKnifeRoot);
knifeSwingPivot.add(meleeKnifeRoot);
const bladeGroup = new THREE.Group();
meleeKnifeRoot.add(bladeGroup);

const bladeProfile = new THREE.Shape();
{
  const sb = 0.0188;
  const se = 0.0202;
  bladeProfile.moveTo(-sb, 0.022);
  bladeProfile.lineTo(-sb * 0.97, 0.2);
  bladeProfile.quadraticCurveTo(-sb * 0.94, 0.34, -sb * 0.82, 0.44);
  bladeProfile.quadraticCurveTo(-0.005, 0.535, 0, 0.568);
  bladeProfile.quadraticCurveTo(0.008, 0.528, se * 0.88, 0.445);
  bladeProfile.lineTo(se, 0.16);
  bladeProfile.quadraticCurveTo(se * 0.98, 0.08, se * 0.94, 0.03);
  bladeProfile.lineTo(-sb, 0.022);
}
const bladeGeo = new THREE.ExtrudeGeometry(bladeProfile, {
  steps: 1,
  depth: 0.0105,
  bevelEnabled: true,
  bevelThickness: 0.00125,
  bevelSize: 0.0009,
  bevelSegments: 4,
  curveSegments: 20,
});
bladeGeo.translate(0, 0, -0.0105 / 2 - 0.0009);
bladeGeo.computeVertexNormals();
const bladeBody = new THREE.Mesh(bladeGeo, bladeSteelMat);
bladeBody.castShadow = true;
bladeGroup.add(bladeBody);

const guardGeo = new THREE.BoxGeometry(0.046, 0.016, 0.011);
const guardMesh = new THREE.Mesh(guardGeo, bladeSteelMat);
guardMesh.position.set(0, 0.03, 0);
guardMesh.castShadow = true;
bladeGroup.add(guardMesh);

const logoPad = new THREE.Mesh(
  new THREE.BoxGeometry(0.012, 0.018, 0.0035),
  bladeDarkMat
);
logoPad.position.set(-0.0095, 0.14, 0.0068);
logoPad.castShadow = true;
bladeGroup.add(logoPad);

const lathePts = [];
const hn = 28;
for (let i = 0; i <= hn; i++) {
  const t = i / hn;
  const y = 0.024 - t * 0.138;
  const finger = Math.sin(t * Math.PI * 3.15) * 0.0024;
  const taper = t * 0.0018;
  const pommelFlare = t > 0.88 ? (t - 0.88) * 0.028 : 0;
  lathePts.push(new THREE.Vector2(0.0218 + finger + pommelFlare - taper, y));
}
const handleGeo = new THREE.LatheGeometry(lathePts, 36);
handleGeo.computeVertexNormals();
const handleBody = new THREE.Mesh(handleGeo, handleRubberMat);
handleBody.castShadow = true;
bladeGroup.add(handleBody);

const pinGeo = new THREE.CylinderGeometry(0.0082, 0.0082, 0.045, 20);
pinGeo.rotateZ(Math.PI / 2);
addKnifeMesh(bladeGroup, pinGeo, pinMat, -0.0225, -0.035, 0.018);
addKnifeMesh(bladeGroup, pinGeo, pinMat, -0.0225, -0.095, 0.018);

const pommelGeo = new THREE.CylinderGeometry(0.014, 0.019, 0.038, 12);
pommelGeo.rotateZ(Math.PI / 2);
addKnifeMesh(bladeGroup, pommelGeo, bladeSteelMat, 0, -0.168, 0.02, 0.18, 0, 0);

bladeGroup.rotation.y = Math.PI / 2;

const meleeAxeRoot = new THREE.Group();
meleeAxeRoot.visible = false;
meleeVariantRoots.push(meleeAxeRoot);
knifeSwingPivot.add(meleeAxeRoot);
const axeHead = new THREE.Mesh(
  new THREE.BoxGeometry(0.14, 0.22, 0.04),
  new THREE.MeshStandardMaterial({
    color: 0xb0b8c0,
    metalness: 0,
    roughness: 0.85,
  })
);
axeHead.position.set(0.04, 0.382, 0.02);
axeHead.rotation.z = -0.35;
axeHead.castShadow = true;
meleeAxeRoot.add(axeHead);
const axeEdge = new THREE.Mesh(
  new THREE.BoxGeometry(0.148, 0.084, 0.034),
  new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    metalness: 0,
    roughness: 0.75,
  })
);
axeEdge.position.set(0.058, 0.338, 0.02);
axeEdge.rotation.z = -0.35;
axeEdge.castShadow = true;
meleeAxeRoot.add(axeEdge);
const axeHandle = new THREE.Mesh(
  new THREE.CylinderGeometry(0.027, 0.031, 0.448, 10),
  new THREE.MeshStandardMaterial({
    color: 0x5c4030,
    metalness: 0,
    roughness: 1,
  })
);
axeHandle.rotation.x = Math.PI / 2;
axeHandle.position.set(0, -0.016, 0.02);
axeHandle.castShadow = true;
meleeAxeRoot.add(axeHandle);
meleeAxeRoot.rotation.y = Math.PI / 2;

const meleeKnuckleRoot = new THREE.Group();
meleeKnuckleRoot.visible = false;
meleeVariantRoots.push(meleeKnuckleRoot);
knifeSwingPivot.add(meleeKnuckleRoot);
const knMat = new THREE.MeshStandardMaterial({
  color: 0xc4b4a4,
  metalness: 0,
  roughness: 0.88,
});
const knStrap = new THREE.Mesh(
  new THREE.BoxGeometry(0.14, 0.04, 0.1),
  new THREE.MeshStandardMaterial({
    color: 0x3a3028,
    roughness: 1,
    metalness: 0,
  })
);
knStrap.position.set(0, -0.02, 0.04);
knStrap.castShadow = true;
meleeKnuckleRoot.add(knStrap);
for (let ix = 0; ix < 2; ix++) {
  for (let iy = 0; iy < 2; iy++) {
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.014, 8, 16),
      knMat
    );
    tor.rotation.x = Math.PI / 2;
    tor.position.set(-0.036 + ix * 0.072, 0.06, -0.022 + iy * 0.044);
    tor.castShadow = true;
    meleeKnuckleRoot.add(tor);
  }
}
meleeKnuckleRoot.rotation.y = Math.PI / 2;

function syncLoadoutViewmodels() {
  const showGun = gunGroup.visible;
  const pi = loadoutChoice[SLOT_PRIMARY];
  for (let i = 0; i < primaryModels.length; i++) {
    primaryModels[i].visible =
      showGun && activeWeapon === SLOT_PRIMARY && i === pi;
  }
  const si = loadoutChoice[SLOT_SECONDARY];
  for (let i = 0; i < secondaryModels.length; i++) {
    secondaryModels[i].visible =
      showGun && activeWeapon === SLOT_SECONDARY && i === si;
  }
  const mi = loadoutChoice[SLOT_MELEE];
  for (let i = 0; i < meleeVariantRoots.length; i++) {
    meleeVariantRoots[i].visible = activeWeapon === SLOT_MELEE && i === mi;
  }
  updatePrimaryHandMaterials();
}

const enemySkinTex = createEnemySkinTextures();

let triPlanarMatId = 0;
/** Removes UV seams on boxy meshes by sampling albedo + roughness in world space. */
function attachTriplanarToStandardMat(mat, worldScale) {
  if (!mat.map) return;
  const id = ++triPlanarMatId;
  const scl = worldScale;
  mat.customProgramCacheKey = function () {
    return `triplanar_${id}_${scl}`;
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTriPlanarScale = { value: scl };
    shader.vertexShader =
      `varying vec3 vTriPlanarPos;\nvarying vec3 vTriPlanarNrm;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>
      vec4 _triW = modelMatrix * vec4( transformed, 1.0 );
      vTriPlanarPos = _triW.xyz;
      vTriPlanarNrm = normalize( mat3( modelMatrix ) * normal );`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      /^#define STANDARD/m,
      `#define STANDARD
varying vec3 vTriPlanarPos;
varying vec3 vTriPlanarNrm;
uniform float uTriPlanarScale;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#ifdef USE_MAP
      vec3 _tpN = normalize( vTriPlanarNrm );
      vec3 _tpP = vTriPlanarPos * uTriPlanarScale;
      vec3 _tpW = pow( abs( _tpN ), vec3( 4.5 ) );
      _tpW /= max( _tpW.x + _tpW.y + _tpW.z, 1e-5 );
      vec4 _tpCx = texture2D( map, _tpP.yz );
      vec4 _tpCy = texture2D( map, _tpP.xz );
      vec4 _tpCz = texture2D( map, _tpP.xy );
      vec4 sampledDiffuseColor = _tpCx * _tpW.x + _tpCy * _tpW.y + _tpCz * _tpW.z;
      #ifdef DECODE_VIDEO_TEXTURE
      sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
      #endif
      diffuseColor *= sampledDiffuseColor;
      #endif`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
      vec3 _tpN2 = normalize( vTriPlanarNrm );
      vec3 _tpP2 = vTriPlanarPos * uTriPlanarScale;
      vec3 _tpW2 = pow( abs( _tpN2 ), vec3( 4.5 ) );
      _tpW2 /= max( _tpW2.x + _tpW2.y + _tpW2.z, 1e-5 );
      vec4 _tpRx = texture2D( roughnessMap, _tpP2.yz );
      vec4 _tpRy = texture2D( roughnessMap, _tpP2.xz );
      vec4 _tpRz = texture2D( roughnessMap, _tpP2.xy );
      vec4 texelRoughness = _tpRx * _tpW2.x + _tpRy * _tpW2.y + _tpRz * _tpW2.z;
      roughnessFactor *= texelRoughness.g;
      #endif`
    );
  };
}

function buildEnemy() {
  const root = new THREE.Group();
  const mats = [];
  const matBases = [];

  function registerMat(mat, emissiveHex, emissiveIntensity) {
    mats.push(mat);
    matBases.push({ emissive: emissiveHex, intensity: emissiveIntensity });
  }

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: enemySkinTex.map,
    roughnessMap: enemySkinTex.roughnessMap,
    roughness: 1,
    metalness: 0,
    emissive: 0xd02048,
    emissiveIntensity: 0.62,
  });
  registerMat(suitMat, 0xd02048, 0.62);
  attachTriplanarToStandardMat(suitMat, 0.62);

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x3a1828,
    roughness: 0.98,
    metalness: 0.04,
    emissive: 0x301020,
    emissiveIntensity: 0.22,
  });
  registerMat(armorMat, 0x301020, 0.22);

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x061820,
    roughness: 0.75,
    metalness: 0.06,
    emissive: 0x40ffe8,
    emissiveIntensity: 0.44,
  });
  registerMat(visorMat, 0x40ffe8, 0.44);

  const egBodyMat = new THREE.MeshStandardMaterial({
    color: 0xaeb8c4,
    map: concSurf.map,
    roughnessMap: concSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
    emissive: 0x060c12,
    emissiveIntensity: 0.05,
  });
  registerMat(egBodyMat, 0x060c12, 0.05);

  const egDarkMat = new THREE.MeshStandardMaterial({
    color: 0x181c22,
    map: barrierSurf.map,
    roughnessMap: barrierSurf.roughnessMap,
    roughness: 1,
    metalness: 0,
    emissive: 0x08060c,
    emissiveIntensity: 0.035,
  });
  registerMat(egDarkMat, 0x08060c, 0.035);
  attachTriplanarToStandardMat(egBodyMat, 0.92);
  attachTriplanarToStandardMat(egDarkMat, 0.86);

  function limbBox(w, h, d, mat, x, y, z, hitZone) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (hitZone) m.userData.hitZone = hitZone;
    m.castShadow = true;
    root.add(m);
    return m;
  }

  limbBox(0.2, 0.48, 0.22, armorMat, -0.11, 0.24, 0);
  limbBox(0.2, 0.48, 0.22, armorMat, 0.11, 0.24, 0);
  limbBox(0.36, 0.592, 0.28, suitMat, 0, 0.772, 0);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.11), armorMat);
  pack.position.set(0, 0.8, -0.19);
  pack.castShadow = true;
  root.add(pack);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.35, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.26), suitMat);
  skull.userData.hitZone = "head";
  skull.castShadow = true;
  headGroup.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.058, 0.13), visorMat);
  visor.position.set(0, 0.025, 0.165);
  visor.userData.hitZone = "head";
  visor.castShadow = true;
  headGroup.add(visor);
  root.add(headGroup);

  limbBox(0.13, 0.58, 0.16, armorMat, -0.228, 0.88, 0.08);
  limbBox(0.13, 0.58, 0.16, armorMat, 0.228, 0.88, 0.08);

  const gunGrp = new THREE.Group();
  gunGrp.position.set(0.3, 0.72, 0.26);
  gunGrp.rotation.y = -0.2;

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.13, 0.36), egBodyMat);
  receiver.castShadow = true;
  gunGrp.add(receiver);

  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.102, 0.228), egDarkMat);
  handguard.position.set(0, -0.03, -0.236);
  handguard.castShadow = true;
  gunGrp.add(handguard);

  const egBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.026, 0.34, 10),
    egDarkMat
  );
  egBarrel.rotation.x = Math.PI / 2;
  egBarrel.position.set(0, 0.02, -0.48);
  egBarrel.castShadow = true;
  gunGrp.add(egBarrel);

  const egMag = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.22, 0.072), egDarkMat);
  egMag.position.set(0, -0.12, 0.02);
  egMag.castShadow = true;
  gunGrp.add(egMag);

  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.14), egDarkMat);
  stockPad.position.set(0, -0.02, 0.24);
  stockPad.castShadow = true;
  gunGrp.add(stockPad);

  root.add(gunGrp);

  return { root, mats, matBases };
}

/** Lean wolf: tapered torso, neck, cranium + snout, cone ears, bushy tail. */
function buildWolf() {
  const root = new THREE.Group();
  const mats = [];
  const matBases = [];

  function registerMat(mat, emissiveHex, emissiveIntensity) {
    mats.push(mat);
    matBases.push({ emissive: emissiveHex, intensity: emissiveIntensity });
  }

  const fur = new THREE.MeshStandardMaterial({
    color: 0x6e6158,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x7a3220,
    emissiveIntensity: 0.34,
  });
  registerMat(fur, 0x7a3220, 0.34);
  const furLight = new THREE.MeshStandardMaterial({
    color: 0x9c948a,
    roughness: 0.93,
    metalness: 0,
    emissive: 0x5a3828,
    emissiveIntensity: 0.16,
  });
  registerMat(furLight, 0x5a3828, 0.16);
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a3228,
    roughness: 0.96,
    metalness: 0,
    emissive: 0x3a1810,
    emissiveIntensity: 0.18,
  });
  registerMat(dark, 0x3a1810, 0.18);
  const nose = new THREE.MeshStandardMaterial({
    color: 0x141210,
    roughness: 0.55,
    metalness: 0,
    emissive: 0x201818,
    emissiveIntensity: 0.04,
  });
  registerMat(nose, 0x201818, 0.04);
  const eye = new THREE.MeshStandardMaterial({
    color: 0x1a120c,
    roughness: 0.42,
    metalness: 0.02,
    emissive: 0xffaa55,
    emissiveIntensity: 0.48,
  });
  registerMat(eye, 0xffaa55, 0.48);

  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0, hitZone) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    if (hitZone) m.userData.hitZone = hitZone;
    m.castShadow = true;
    root.add(m);
  }

  box(0.5, 0.22, 0.68, fur, 0, 0.33, -0.02);
  box(0.44, 0.18, 0.36, furLight, 0, 0.3, 0.14);
  box(0.52, 0.16, 0.3, fur, 0, 0.41, 0.1);
  box(0.46, 0.2, 0.42, fur, 0, 0.35, -0.4);
  box(0.17, 0.15, 0.24, fur, 0, 0.44, 0.34, -0.12, 0, 0);
  box(0.22, 0.19, 0.25, fur, 0, 0.52, 0.46, 0.06, 0.05, 0, "head");
  box(0.13, 0.11, 0.2, dark, 0, 0.48, 0.62);
  box(0.1, 0.09, 0.16, dark, 0, 0.45, 0.76);
  box(0.055, 0.048, 0.055, nose, 0, 0.43, 0.86);
  box(0.05, 0.05, 0.05, eye, -0.09, 0.54, 0.58);
  box(0.05, 0.05, 0.05, eye, 0.09, 0.54, 0.58);

  function ear(px, py, pz, ry, rz) {
    const m = new THREE.Mesh(WOLF_EAR_GEO, dark);
    m.position.set(px, py, pz);
    m.rotation.set(0.42, ry, rz);
    m.castShadow = true;
    root.add(m);
  }
  ear(-0.13, 0.62, 0.4, -0.35, -0.28);
  ear(0.13, 0.62, 0.41, 0.35, 0.28);

  const ly = 0.13;
  box(0.1, 0.24, 0.11, dark, -0.18, ly, 0.26, 0.12, 0, 0);
  box(0.1, 0.24, 0.11, dark, 0.18, ly, 0.26, 0.12, 0, 0);
  box(0.1, 0.26, 0.11, dark, -0.18, ly, -0.28, -0.08, 0, 0);
  box(0.1, 0.26, 0.11, dark, 0.18, ly, -0.28, -0.08, 0, 0);
  box(0.065, 0.055, 0.09, dark, -0.18, 0.02, 0.32);
  box(0.065, 0.055, 0.09, dark, 0.18, 0.02, 0.32);
  box(0.065, 0.055, 0.09, dark, -0.18, 0.02, -0.34);
  box(0.065, 0.055, 0.09, dark, 0.18, 0.02, -0.34);

  box(0.08, 0.1, 0.26, fur, 0, 0.39, -0.54);
  box(0.09, 0.11, 0.22, fur, 0, 0.43, -0.68, 0.15, 0, 0);
  box(0.07, 0.09, 0.14, dark, 0, 0.47, -0.82, 0.22, 0, 0);

  root.scale.setScalar(1.92);
  return { root, mats, matBases };
}

/** Stocky bear: shoulder hump, heavy torso, short powerful limbs, rounded ears. */
function buildBear() {
  const root = new THREE.Group();
  const mats = [];
  const matBases = [];

  function registerMat(mat, emissiveHex, emissiveIntensity) {
    mats.push(mat);
    matBases.push({ emissive: emissiveHex, intensity: emissiveIntensity });
  }

  const fur = new THREE.MeshStandardMaterial({
    color: 0x5a4336,
    roughness: 0.88,
    metalness: 0,
    emissive: 0x5c2418,
    emissiveIntensity: 0.26,
  });
  registerMat(fur, 0x5c2418, 0.26);
  const furLight = new THREE.MeshStandardMaterial({
    color: 0x7a6a58,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x4a2818,
    emissiveIntensity: 0.12,
  });
  registerMat(furLight, 0x4a2818, 0.12);
  const dark = new THREE.MeshStandardMaterial({
    color: 0x342820,
    roughness: 0.94,
    metalness: 0,
    emissive: 0x281810,
    emissiveIntensity: 0.14,
  });
  registerMat(dark, 0x281810, 0.14);
  const nose = new THREE.MeshStandardMaterial({
    color: 0x100c08,
    roughness: 0.5,
    metalness: 0,
    emissive: 0x181008,
    emissiveIntensity: 0.03,
  });
  registerMat(nose, 0x181008, 0.03);
  const eye = new THREE.MeshStandardMaterial({
    color: 0x0f0a06,
    roughness: 0.48,
    metalness: 0.02,
    emissive: 0xd47228,
    emissiveIntensity: 0.36,
  });
  registerMat(eye, 0xd47228, 0.36);

  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0, hitZone) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    if (hitZone) m.userData.hitZone = hitZone;
    m.castShadow = true;
    root.add(m);
  }

  box(0.76, 0.42, 0.84, fur, 0, 0.45, 0.02);
  box(0.52, 0.26, 0.42, furLight, 0, 0.38, 0.18);
  box(0.58, 0.24, 0.48, fur, 0, 0.68, -0.14, 0.12, 0, 0);
  box(0.28, 0.24, 0.34, fur, 0, 0.66, 0.4, -0.08, 0, 0);
  box(0.34, 0.28, 0.32, fur, 0, 0.74, 0.56, 0, 0.06, 0, "head");
  box(0.22, 0.19, 0.24, dark, 0, 0.64, 0.76);
  box(0.16, 0.14, 0.18, dark, 0, 0.58, 0.9);
  box(0.1, 0.08, 0.1, nose, 0, 0.54, 0.98);
  box(0.06, 0.06, 0.06, eye, -0.12, 0.78, 0.68);
  box(0.06, 0.06, 0.06, eye, 0.12, 0.78, 0.68);

  function earB(x, y, z) {
    const m = new THREE.Mesh(BEAR_EAR_GEO, dark);
    m.position.set(x, y, z);
    m.scale.set(1, 1.15, 0.85);
    m.castShadow = true;
    root.add(m);
  }
  earB(-0.2, 0.88, 0.52);
  earB(0.2, 0.88, 0.52);

  const ly = 0.19;
  box(0.15, 0.38, 0.15, dark, -0.28, ly, 0.3, 0.05, 0, 0);
  box(0.15, 0.38, 0.15, dark, 0.28, ly, 0.3, 0.05, 0, 0);
  box(0.15, 0.38, 0.15, dark, -0.28, ly, -0.32, -0.06, 0, 0);
  box(0.15, 0.38, 0.15, dark, 0.28, ly, -0.32, -0.06, 0, 0);
  box(0.1, 0.08, 0.14, dark, -0.28, 0.02, 0.34);
  box(0.1, 0.08, 0.14, dark, 0.28, 0.02, 0.34);
  box(0.1, 0.08, 0.14, dark, -0.28, 0.02, -0.36);
  box(0.1, 0.08, 0.14, dark, 0.28, 0.02, -0.36);

  box(0.14, 0.14, 0.22, dark, 0, 0.52, -0.58);

  root.scale.setScalar(2.52);
  return { root, mats, matBases };
}

const enemies = [];
const tracers = [];
const sparks = [];

function randomSpawnPoint() {
  const edge = Math.floor(Math.random() * 4);
  const t = (Math.random() - 0.5) * (ARENA - 4) * 2;
  switch (edge) {
    case 0:
      return new THREE.Vector3(t, 0, -ARENA + 2.5);
    case 1:
      return new THREE.Vector3(t, 0, ARENA - 2.5);
    case 2:
      return new THREE.Vector3(-ARENA + 2.5, 0, t);
    default:
      return new THREE.Vector3(ARENA - 2.5, 0, t);
  }
}

function getEnemyFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.enemy) return o.userData.enemy;
    o = o.parent;
  }
  return null;
}

const practiceTargets = [];
let practiceTargetSharedGeo = null;
let practiceTargetSharedMat = null;
let practiceTargetBlueMat = null;

function getPracticeTargetFromObject(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.practiceTgt) return o.userData.practiceTgt;
    o = o.parent;
  }
  return null;
}

function shootRaycastRoots() {
  const roots = enemies.map((e) => e.root);
  if (practiceMovingTargets) {
    for (const t of practiceTargets) roots.push(t.root);
  }
  return roots;
}

function clearPracticeTargets() {
  for (const t of practiceTargets) {
    scene.remove(t.root);
  }
  practiceTargets.length = 0;
}

function ensurePracticeTargetSharedAssets() {
  if (!practiceTargetSharedGeo) {
    practiceTargetSharedGeo = new THREE.SphereGeometry(0.38, 26, 18);
  }
  if (!practiceTargetSharedMat) {
    practiceTargetSharedMat = new THREE.MeshStandardMaterial({
      color: 0xff9933,
      emissive: 0x331800,
      emissiveIntensity: 0.42,
      roughness: 0.42,
      metalness: 0.12,
    });
  }
  if (!practiceTargetBlueMat) {
    practiceTargetBlueMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x0a2844,
      emissiveIntensity: 0.58,
      roughness: 0.38,
      metalness: 0.18,
    });
  }
}

function spawnPracticeGallery() {
  clearPracticeTargets();
  ensurePracticeTargetSharedAssets();
  const geo = practiceTargetSharedGeo;
  const matOrange = practiceTargetSharedMat;
  const matBlue = practiceTargetBlueMat;
  const rows = 4;
  const cols = 6;
  const total = rows * cols;
  const bonusSlot = Math.floor(Math.random() * total);
  const lim = ARENA - 3.4;
  const spread = lim - 2.2;
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBonus = idx === bonusSlot;
      const root = new THREE.Group();
      const mesh = new THREE.Mesh(geo, isBonus ? matBlue : matOrange);
      mesh.castShadow = true;
      if (isBonus) mesh.scale.setScalar(1.14);
      root.add(mesh);
      const cx = (c / Math.max(1, cols - 1) - 0.5) * 2 * spread * 0.92 + (Math.random() - 0.5) * 2.4;
      const cz =
        (r / Math.max(1, rows - 1) - 0.5) * 2 * spread * 0.88 + (Math.random() - 0.5) * 2.8;
      const ax = 5.5 + Math.random() * 9.5;
      const az = 5.2 + Math.random() * 9.2;
      const fx = 0.32 + Math.random() * 0.95;
      const fz = 0.38 + Math.random() * 0.88;
      const px = Math.random() * Math.PI * 2;
      const pz = Math.random() * Math.PI * 2;
      const px2 = Math.random() * Math.PI * 2;
      const pz2 = Math.random() * Math.PI * 2;
      const fy = 0.55 + Math.random() * 0.75;
      const py = Math.random() * Math.PI * 2;
      const baseY = 0.88 + Math.random() * 1.35;
      const t = {
        root,
        mesh,
        isBonus,
        cx,
        cz,
        ax,
        az,
        fx,
        fz,
        px,
        pz,
        px2,
        pz2,
        fy,
        py,
        baseY,
        dead: false,
        respawnT: 0,
      };
      root.userData.practiceTgt = t;
      scene.add(root);
      practiceTargets.push(t);
      idx += 1;
    }
  }
}

function updatePracticeTargets(dt) {
  const w = performance.now() * 0.001;
  const lim = ARENA - 3.4;
  const px = yaw.position.x;
  const pz = yaw.position.z;
  for (const t of practiceTargets) {
    if (t.dead) {
      t.respawnT -= dt;
      if (t.respawnT <= 0) {
        t.dead = false;
        t.mesh.visible = true;
        t.px += Math.PI * (0.35 + Math.random() * 0.5);
        t.pz += Math.PI * (0.35 + Math.random() * 0.5);
        t.py += Math.PI * (0.25 + Math.random() * 0.4);
      }
    }
    const sx =
      Math.sin(w * t.fx + t.px) * t.ax +
      Math.sin(w * t.fx * 0.51 + t.px2) * t.ax * 0.38;
    const sz =
      Math.sin(w * t.fz + t.pz) * t.az +
      Math.cos(w * t.fz * 0.47 + t.pz2) * t.az * 0.36;
    let x = THREE.MathUtils.clamp(t.cx + sx, -lim, lim);
    let z = THREE.MathUtils.clamp(t.cz + sz, -lim, lim);
    /** Homing toward player (XZ) so drills stay engaging; bonus drifts slower. */
    const homing = t.isBonus ? 0.085 : 0.16;
    const k = 1 - Math.exp(-4.2 * dt);
    x = THREE.MathUtils.lerp(x, px, homing * k);
    z = THREE.MathUtils.lerp(z, pz, homing * k);
    x = THREE.MathUtils.clamp(x, -lim, lim);
    z = THREE.MathUtils.clamp(z, -lim, lim);
    const y = t.baseY + Math.sin(w * t.fy + t.py) * 0.42;
    t.root.position.set(x, y, z);
  }
}

function hitPracticeTarget(t, pt, opts) {
  if (!practiceMovingTargets || t.dead) return false;
  t.dead = true;
  t.mesh.visible = false;
  t.respawnT = 0.75 + Math.random() * 0.65;
  burstAt(pt);
  const pts = t.isBonus ? 180 : 26;
  score += pts;
  scoreEl.textContent = `Score: ${score}`;
  if (!opts?.suppressFeedback) {
    showHitmarker();
    if (t.isBonus) playHeadshot();
    else playHit();
  }
  return true;
}

function syncMenuObjectiveForPractice() {
  if (!menuObjectiveEl) return;
  if (practiceMode2El?.checked) {
    menuObjectiveEl.textContent =
      "Practice 2: obby to the glowing green finish (+420 score each clear). Fall in the void and you restart at the start. No weapons. Random color flashes every 1–15 s + sound; when you see CLICK RIGHT NOW, left-click within one second for +55.";
  } else if (practiceModeEl?.checked) {
    menuObjectiveEl.textContent =
      "Practice: spheres weave across the arena. Hunt the blue bonus ball; orange balls are extra tracking practice. Assault rifle with infinite ammo. (Reaction flashes are in Practice 2.)";
  } else {
    menuObjectiveEl.textContent =
      "Eliminate glowing red enemies before they reach you.";
  }
}

function isHeadshotFromHit(obj) {
  let o = obj;
  while (o) {
    if (o.userData?.hitZone === "head") return true;
    o = o.parent;
  }
  return false;
}

function spawnEnemy() {
  if (practiceMode) return;
  let built;
  let hp = 100;
  let speedMul = 1;
  let damage = ENEMY_DAMAGE;
  let collideRadius = ENEMY_COLLIDE_RADIUS;
  let meleeAimY = 0.86;
  let meleeReach = 1.05;
  let canJump = true;
  let bobAmp = 0.04;
  /** 1 = human, 2 = wolf, 3 = bear — scales ammo drop size. */
  let ammoDropTier = 1;

  /** Forest: wolves & bears only. Every other map: human hostiles. */
  if (activeMapId === "forest") {
    if (Math.random() < FOREST_BEAR_SPAWN_CHANCE) {
      built = buildBear();
      hp = BEAR_HP;
      speedMul = BEAR_SPEED_MUL;
      damage = Math.round(ENEMY_DAMAGE * BEAR_DAMAGE_MUL);
      collideRadius = 1.11;
      meleeAimY = 2.57;
      meleeReach = 2.88;
      canJump = false;
      bobAmp = 0.026;
      ammoDropTier = 3;
    } else {
      built = buildWolf();
      hp = WOLF_HP;
      speedMul = WOLF_SPEED_MUL;
      damage = Math.round(ENEMY_DAMAGE * WOLF_DAMAGE_MUL);
      collideRadius = 0.54;
      meleeAimY = 1.04;
      meleeReach = 1.98;
      canJump = false;
      bobAmp = 0.058;
      ammoDropTier = 2;
    }
  } else {
    built = buildEnemy();
  }

  const { root, mats, matBases } = built;
  const pos = randomSpawnPoint();
  root.position.copy(pos);
  scene.add(root);

  const enemy = {
    root,
    hp,
    speedMul,
    damage,
    collideRadius,
    meleeAimY,
    meleeReach,
    canJump,
    bobAmp,
    ammoDropTier,
    phase: Math.random() * Math.PI * 2,
    mats,
    matBases,
    flash: 0,
    velY: 0,
    baseY: pos.y,
    jumpCd: 0,
    kx: 0,
    kz: 0,
    aiDirX: 0,
    aiDirZ: 1,
  };
  root.userData.enemy = enemy;
  enemies.push(enemy);
}

function addTracer(start, end) {
  const dir = tmpTracerDir.subVectors(end, start);
  const len = dir.length();
  if (len < 1e-5) return;
  const rad = 0.018;
  const geom = new THREE.CylinderGeometry(rad, rad, len, 6, 1, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff6a10,
    emissive: 0xff4500,
    emissiveIntensity: 2.1,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.96,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  tmpV.copy(start).add(end).multiplyScalar(0.5);
  mesh.position.copy(tmpV);
  mesh.quaternion.setFromUnitVectors(tracerYAxis, dir.normalize());
  scene.add(mesh);
  tracers.push({ mesh, t: 0.09, geom });
}

function burstAt(point) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.035 + Math.random() * 0.03, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffc8f0,
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    s.position.copy(point);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      0.4 + Math.random(),
      (Math.random() - 0.5) * 2
    ).normalize();
    scene.add(s);
    sparks.push({ mesh: s, vel: dir.multiplyScalar(5 + Math.random() * 5), t: 0.32 });
  }
}

function burstDeathAt(point) {
  const n = 24;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.045, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfff4cc,
        emissive: 0xffb66a,
        emissiveIntensity: 1.6,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    s.position.copy(point);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      0.35 + Math.random() * 1.1,
      (Math.random() - 0.5) * 2.2
    ).normalize();
    scene.add(s);
    sparks.push({ mesh: s, vel: dir.multiplyScalar(7 + Math.random() * 7), t: 0.42 });
  }
}

function applyEnemyKnockback(enemy, fromPoint, power) {
  tmpV.subVectors(enemy.root.position, fromPoint);
  tmpV.y = 0;
  const d = tmpV.length();
  if (d < 1e-5) return;
  tmpV.multiplyScalar(1 / d);
  enemy.kx = (enemy.kx ?? 0) + tmpV.x * power;
  enemy.kz = (enemy.kz ?? 0) + tmpV.z * power;
}

function flashEnemy(enemy) {
  enemy.flash = 0.14;
  for (const m of enemy.mats) {
    m.emissiveIntensity = 1.15;
    m.emissive.setHex(0xffffff);
  }
}

function updateWeaponHud() {
  document.querySelectorAll(".weapon-slot[data-slot]").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.slot) === activeWeapon);
  });
}

function switchWeapon(idx) {
  if (idx < SLOT_PRIMARY || idx > SLOT_UTILITY) return;
  if (idx === activeWeapon) return;
  if (switchingWeapon) return;
  if (!playing || health <= 0) return;
  if (practiceMode2) return;
  if (activeWeapon === SLOT_MELEE && idx !== SLOT_MELEE) resetKnifeSwing();
  clearReloadSoundTimers();
  reloading = false;
  reloadTimer = 0;
  switchDuration = getWeaponSwapTime(idx);
  switchTimer = switchDuration;
  switchingWeapon = true;
  fireTimer = Math.max(fireTimer, switchDuration);
  activeWeapon = idx;
  gunGroup.visible = idx !== SLOT_UTILITY;
  knifeModel.visible = idx === SLOT_MELEE;
  for (const L of primaryMuzzleLights) L.intensity = 0;
  for (const F of primaryMuzzleFlashes) F.material.opacity = 0;
  for (const L of secondaryMuzzleLights) L.intensity = 0;
  for (const F of secondaryMuzzleFlashes) F.material.opacity = 0;
  syncLoadoutViewmodels();
  updateWeaponHud();
  updateAmmoHud();
}

function updateAmmoHud() {
  if (!ammoEl) return;
  if (practiceMode2) {
    ammoEl.textContent = "No weapons — click when the screen flashes";
    return;
  }
  if (switchingWeapon && switchTimer > 0) {
    ammoEl.textContent = `Switching… ${Math.max(0, switchTimer).toFixed(2)}s`;
    return;
  }
  if (activeWeapon === SLOT_MELEE) {
    ammoEl.textContent = `${getMeleeDef().label} — melee (stay close)`;
    return;
  }
  if (activeWeapon === SLOT_UTILITY) {
    const u = getUtilityDef();
    if (medkitUseTimer > 0) {
      ammoEl.textContent = `${u.label}: healing… ${medkitUseTimer.toFixed(1)}s`;
    } else if (utilityCdRemain > 0) {
      ammoEl.textContent = `${u.label}: ${utilityCdRemain.toFixed(1)}s`;
    } else {
      ammoEl.textContent = `${u.label}: ready — click to use`;
    }
    return;
  }
  if (practicePrimaryInfiniteAmmo()) {
    const w = getPrimaryDef();
    ammoEl.textContent = reloading
      ? `${w.label}: Reloading… ${Math.max(0, reloadTimer).toFixed(1)}s`
      : `${w.label}: ∞`;
    return;
  }
  const w =
    activeWeapon === SLOT_PRIMARY ? getPrimaryDef() : getSecondaryDef();
  const ammoIdx = ammoIdxForGunSlot(activeWeapon);
  const magStore = magAmmoStoreForSlot(activeWeapon);
  const reserveStore = reserveAmmoStoreForSlot(activeWeapon);
  if (reloading) {
    ammoEl.textContent = `${w.label}: Reloading… ${Math.max(0, reloadTimer).toFixed(1)}s`;
  } else {
    ammoEl.textContent = `${w.label}: ${magStore[ammoIdx]} / ${reserveStore[ammoIdx]}`;
  }
}

function startReload() {
  if (reloading) return;
  if (activeWeapon !== SLOT_PRIMARY && activeWeapon !== SLOT_SECONDARY) return;
  if (practicePrimaryInfiniteAmmo()) return;
  const w =
    activeWeapon === SLOT_PRIMARY ? getPrimaryDef() : getSecondaryDef();
  const ammoIdx = ammoIdxForGunSlot(activeWeapon);
  const magStore = magAmmoStoreForSlot(activeWeapon);
  const reserveStore = reserveAmmoStoreForSlot(activeWeapon);
  if (reserveStore[ammoIdx] <= 0) return;
  if (magStore[ammoIdx] >= w.magSize) return;
  reloading = true;
  reloadTimer = w.reloadTime;
  updateAmmoHud();
  void resumeAudio();
  clearReloadSoundTimers();
  playReloadStart();
  const rMs = w.reloadTime * 1000;
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadPouchTap();
    }, rMs * 0.1)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadGrab();
    }, rMs * 0.2)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadVestShift();
    }, rMs * 0.3)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadInsert();
    }, rMs * 0.4)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadMagTick();
    }, rMs * 0.5)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadMid();
    }, rMs * 0.58)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadRoundRattle();
    }, rMs * 0.67)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadBrass();
    }, rMs * 0.76)
  );
  reloadSoundTimers.push(
    setTimeout(() => {
      if (reloading) playReloadShoulderNudge();
    }, rMs * 0.88)
  );
}

function finishReload() {
  clearReloadSoundTimers();
  const w =
    activeWeapon === SLOT_PRIMARY ? getPrimaryDef() : getSecondaryDef();
  const ammoIdx = ammoIdxForGunSlot(activeWeapon);
  const magStore = magAmmoStoreForSlot(activeWeapon);
  const reserveStore = reserveAmmoStoreForSlot(activeWeapon);
  const need = w.magSize - magStore[ammoIdx];
  const take = Math.min(need, reserveStore[ammoIdx]);
  magStore[ammoIdx] += take;
  reserveStore[ammoIdx] -= take;
  reloading = false;
  reloadTimer = 0;
  updateAmmoHud();
  playReloadDone();
}

function resetAmmoToLoadout() {
  primaryMagAmmo = PRIMARY_OPTIONS.map((w) => w.magSize);
  primaryReserveAmmo = PRIMARY_OPTIONS.map((w) => w.reserveMax);
  secondaryMagAmmo = SECONDARY_OPTIONS.map((w) => w.magSize);
  secondaryReserveAmmo = SECONDARY_OPTIONS.map((w) => w.reserveMax);
}

const AMMO_PICKUP_LIFETIME = 75;
const AMMO_PICKUP_COLLECT_R = 1.38;
const ammoPickups = [];

function ammoPackAmountsForTier(tier) {
  if (tier >= 3) return { addP: 42, addS: 32 };
  if (tier >= 2) return { addP: 28, addS: 20 };
  return { addP: 22, addS: 15 };
}

function clearAmmoPickups() {
  for (const pk of ammoPickups) {
    scene.remove(pk.mesh);
    pk.mesh.geometry?.dispose?.();
    pk.mesh.material?.dispose?.();
  }
  ammoPickups.length = 0;
}

function spawnAmmoPickupAt(pos, tier) {
  if (practiceMode) return;
  const { addP, addS } = ammoPackAmountsForTier(tier);
  const geom = new THREE.BoxGeometry(0.24, 0.14, 0.32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc9a045,
    emissive: 0x6a4a0a,
    emissiveIntensity: 0.55,
    metalness: 0.35,
    roughness: 0.45,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(pos.x, pos.y + 0.12, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.castShadow = true;
  scene.add(mesh);
  ammoPickups.push({
    mesh,
    addP,
    addS,
    tRemain: AMMO_PICKUP_LIFETIME,
    baseY: mesh.position.y,
    phase: Math.random() * Math.PI * 2,
  });
}

function dropAmmoFromEnemy(enemy, hitPoint) {
  if (practiceMode || !enemy) return;
  if (Math.random() >= 0.1) return;
  const feet = enemy.root.position;
  const x = hitPoint != null ? hitPoint.x : feet.x;
  const z = hitPoint != null ? hitPoint.z : feet.z;
  const y = Math.max(0.2, feet.y);
  tmpV.set(x, y, z);
  spawnAmmoPickupAt(tmpV, enemy.ammoDropTier ?? 1);
}

function updateAmmoPickups(dt) {
  if (!playing || practiceMode || health <= 0) return;
  const px = yaw.position.x;
  const pz = yaw.position.z;
  const py = yaw.position.y;
  const now = performance.now();

  for (let i = ammoPickups.length - 1; i >= 0; i--) {
    const pk = ammoPickups[i];
    pk.tRemain -= dt;
    const bob = Math.sin(now * 0.0032 + pk.phase) * 0.05;
    pk.mesh.position.y = pk.baseY + bob;
    pk.mesh.rotation.y += dt * 1.4;

    if (pk.tRemain <= 0) {
      scene.remove(pk.mesh);
      pk.mesh.geometry.dispose();
      pk.mesh.material.dispose();
      ammoPickups.splice(i, 1);
      continue;
    }

    const dx = pk.mesh.position.x - px;
    const dz = pk.mesh.position.z - pz;
    const dy = pk.mesh.position.y - py;
    if (
      Math.hypot(dx, dz) < AMMO_PICKUP_COLLECT_R &&
      Math.abs(dy) < 1.85
    ) {
      const pIdx = loadoutChoice[SLOT_PRIMARY];
      const sIdx = loadoutChoice[SLOT_SECONDARY];
      const pDef = getPrimaryDef();
      const sDef = getSecondaryDef();
      primaryReserveAmmo[pIdx] = Math.min(
        pDef.reserveMax,
        primaryReserveAmmo[pIdx] + pk.addP
      );
      secondaryReserveAmmo[sIdx] = Math.min(
        sDef.reserveMax,
        secondaryReserveAmmo[sIdx] + pk.addS
      );
      void resumeAudio();
      playReloadGrab();
      updateAmmoHud();
      scene.remove(pk.mesh);
      pk.mesh.geometry.dispose();
      pk.mesh.material.dispose();
      ammoPickups.splice(i, 1);
    }
  }
}

function showHitmarker() {
  if (!hitmarkerEl) return;
  hitmarkerEl.classList.remove("hidden");
  clearTimeout(hitmarkerHideTimer);
  hitmarkerHideTimer = setTimeout(() => {
    hitmarkerEl.classList.add("hidden");
  }, 135);
}

function clearEnemyDamagePopup(enemy) {
  const dp = enemy.dmgPopup;
  if (!dp) return;
  clearTimeout(dp.hideT);
  dp.el?.remove();
  delete enemy.dmgPopup;
}

function formatDamageFloaterText(total) {
  return (Math.round(total * 10) / 10).toFixed(1);
}

/** Floating damage: merges hits on same target within DAMAGE_POPUP_MERGE_MS; red if any headshot in combo. */
function showMergedEnemyDamage(enemy, dmg, headshot) {
  if (!damageFloaterRoot) return;
  const now = performance.now();
  if (!enemy.dmgPopup) {
    enemy.dmgPopup = { acc: 0, lastAt: 0, hasHead: false, el: null, hideT: 0 };
  }
  const dp = enemy.dmgPopup;
  clearTimeout(dp.hideT);

  if (now - dp.lastAt > DAMAGE_POPUP_MERGE_MS) {
    dp.el?.remove();
    dp.el = null;
    dp.acc = 0;
    dp.hasHead = false;
  }

  dp.acc += dmg;
  if (headshot) dp.hasHead = true;
  dp.lastAt = now;

  if (!dp.el) {
    dp.el = document.createElement("div");
    dp.el.className = "dmg-float";
    damageFloaterRoot.appendChild(dp.el);
  }
  dp.el.textContent = formatDamageFloaterText(dp.acc);
  dp.el.classList.toggle("dmg-head", dp.hasHead);
  dp.el.classList.toggle("dmg-body", !dp.hasHead);

  dp.hideT = window.setTimeout(() => {
    if (!dp.el) return;
    dp.el.classList.add("dmg-float-out");
    const el = dp.el;
    window.setTimeout(() => {
      el.remove();
      if (dp.el === el) {
        dp.el = null;
        dp.acc = 0;
        dp.hasHead = false;
      }
    }, 320);
  }, 700);
}

function updateDamageFloaters() {
  if (!damageFloaterRoot) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const e of enemies) {
    const dp = e.dmgPopup;
    if (!dp?.el) continue;
    tmpDmgProj.copy(e.root.position);
    tmpDmgProj.y += 2.08;
    tmpDmgProj.project(camera);
    const vis = Math.abs(tmpDmgProj.x) < 1.25 && Math.abs(tmpDmgProj.y) < 1.25;
    if (!vis) {
      dp.el.style.visibility = "hidden";
      continue;
    }
    dp.el.style.visibility = "visible";
    const x = (tmpDmgProj.x * 0.5 + 0.5) * w;
    const y = (-tmpDmgProj.y * 0.5 + 0.5) * h;
    dp.el.style.left = `${x}px`;
    dp.el.style.top = `${y}px`;
  }
}

function tryFire() {
  if (!playing || health <= 0) return;
  if (practiceMode2) return;
  if (practicePrimaryInfiniteAmmo() && reloading) {
    clearReloadSoundTimers();
    reloading = false;
    reloadTimer = 0;
  }
  if (reloading || fireTimer > 0 || (switchingWeapon && switchTimer > 0)) return;
  void resumeAudio();
  if (activeWeapon === SLOT_UTILITY) {
    fireTimer = 0.35;
    tryUseUtility();
    return;
  }
  if (activeWeapon === SLOT_MELEE) {
    fireTimer = getMeleeDef().fireCooldown;
    tryMeleeAttack();
    return;
  }
  const w =
    activeWeapon === SLOT_PRIMARY ? getPrimaryDef() : getSecondaryDef();
  const ammoIdx = ammoIdxForGunSlot(activeWeapon);
  const magStore = magAmmoStoreForSlot(activeWeapon);
  const reserveStore = reserveAmmoStoreForSlot(activeWeapon);
  if (!practicePrimaryInfiniteAmmo()) {
    if (magStore[ammoIdx] <= 0) {
      if (reserveStore[ammoIdx] > 0) startReload();
      else playEmpty();
      return;
    }
  }
  fireTimer = w.fireCooldown;
  shoot();
  if (!practicePrimaryInfiniteAmmo()) magStore[ammoIdx] -= 1;
  updateAmmoHud();
}

function updateKnifeSwing(dt) {
  if (!knifeSwingPivot) return;
  if (activeWeapon !== SLOT_MELEE) {
    knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
    knifeSwingPivot.position.set(0, 0, 0);
    return;
  }
  const knuckleMelee = loadoutChoice[SLOT_MELEE] === MELEE_INDEX_KNUCKLES;
  if (knifeSwingT <= 0) {
    knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
    knifeSwingPivot.position.set(0, 0, 0);
    return;
  }
  knifeSwingT += dt;
  if (knuckleMelee) {
    const t = Math.min(1, knifeSwingT / KNUCKLE_PUNCH_DUR);
    const u = THREE.MathUtils.smootherstep(0, 1, t);
    const wave = Math.sin(Math.PI * u);
    knifeSwingPivot.position.z = 0.16 * wave;
    knifeSwingPivot.position.y = -0.055 * wave;
    knifeSwingPivot.rotation.x = KNIFE_REST_ROT.x + 0.55 * wave;
    knifeSwingPivot.rotation.y = KNIFE_REST_ROT.y + 0.06 * wave;
    knifeSwingPivot.rotation.z = KNIFE_REST_ROT.z;
    if (t >= 1) {
      knifeSwingT = 0;
      knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
      knifeSwingPivot.position.set(0, 0, 0);
    }
    return;
  }

  const t = Math.min(1, knifeSwingT / KNIFE_SWING_DUR);
  const u = THREE.MathUtils.smootherstep(0, 1, t);

  let sx;
  let sy;
  let sz;
  let ex;
  let ey;
  let ez;
  if (knifeSwingRtl) {
    sx = 0.72;
    sy = -0.58;
    sz = -0.38;
    ex = -0.76;
    ey = 0.52;
    ez = 0.34;
  } else {
    sx = -0.72;
    sy = 0.58;
    sz = -0.38;
    ex = 0.76;
    ey = -0.52;
    ez = 0.34;
  }
  const dRx = THREE.MathUtils.lerp(sx, ex, u);
  const dRy = THREE.MathUtils.lerp(sy, ey, u);
  const dRz = THREE.MathUtils.lerp(sz, ez, u);
  knifeSwingPivot.position.set(0, 0, 0);
  knifeSwingPivot.rotation.set(
    KNIFE_REST_ROT.x + dRx,
    KNIFE_REST_ROT.y + dRy,
    KNIFE_REST_ROT.z + dRz
  );

  if (t >= 1) {
    knifeSwingRtl = !knifeSwingRtl;
    knifeSwingT = 0;
    knifeSwingPivot.rotation.copy(KNIFE_REST_ROT);
    knifeSwingPivot.position.set(0, 0, 0);
  }
}

function tryUseUtility() {
  if (utilityCdRemain > 0 || medkitUseTimer > 0) {
    playEmpty();
    return;
  }
  const u = getUtilityDef();
  void resumeAudio();
  if (u.kind === "medkit") {
    if (health >= PLAYER_MAX_HEALTH) {
      playEmpty();
      return;
    }
    medkitUseTimer = MEDKIT_USE_TIME;
    medkitPendingHeal = u.heal;
    medkitCooldownAfter = u.cooldown;
    playReloadStart();
  } else if (u.kind === "resupply") {
    const p = getPrimaryDef();
    const s = getSecondaryDef();
    const pIdx = loadoutChoice[SLOT_PRIMARY];
    const sIdx = loadoutChoice[SLOT_SECONDARY];
    primaryReserveAmmo[pIdx] = Math.min(p.reserveMax, primaryReserveAmmo[pIdx] + u.addP);
    secondaryReserveAmmo[sIdx] = Math.min(s.reserveMax, secondaryReserveAmmo[sIdx] + u.addS);
    playReloadGrab();
    utilityCdRemain = u.cooldown;
  } else if (u.kind === "grenade") {
    getInteractionEyeWorld(tmpEyeWorld);
    camera.getWorldDirection(tmpV);
    const dir = tmpV.clone();
    dir.y = Math.max(-0.08, dir.y);
    dir.normalize();
    const spawnPos = tmpEyeWorld.clone().addScaledVector(dir, 0.95);
    const gMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 9, 9),
      new THREE.MeshStandardMaterial({
        color: 0x46505a,
        roughness: 0.72,
        metalness: 0.18,
        emissive: 0x181a1f,
        emissiveIntensity: 0.12,
      })
    );
    gMesh.castShadow = true;
    gMesh.position.copy(spawnPos);
    scene.add(gMesh);
    grenades.push({
      mesh: gMesh,
      vel: dir.multiplyScalar(u.speed),
      t: u.fuse,
      damage: u.damage,
      radius: u.radius,
    });
    utilityCdRemain = u.cooldown;
    addCameraShake(0.06, 0.005, 0.45);
    playReloadInsert();
  }
  updateAmmoHud();
}

function explodeGrenadeAt(pos, dmg, radius) {
  burstDeathAt(pos);
  playGrenadeExplosion();
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 6, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffd9a0,
        emissive: 0xff8c2b,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
    );
    s.position.copy(pos);
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2.8,
      0.25 + Math.random() * 1.3,
      (Math.random() - 0.5) * 2.8
    ).normalize();
    scene.add(s);
    sparks.push({ mesh: s, vel: dir.multiplyScalar(8 + Math.random() * 9), t: 0.5 });
  }
  addCameraShake(0.14, 0.011, 0.35);
  const dead = [];
  let hitAny = false;
  for (const e of enemies) {
    const hitPt = e.root.position;
    const dist = Math.hypot(hitPt.x - pos.x, hitPt.z - pos.z);
    if (dist > radius) continue;
    const mul = THREE.MathUtils.clamp(1 - dist / radius, 0.22, 1);
    const dealt = Math.round(dmg * mul * 10) / 10;
    if (dealt <= 0) continue;
    hitAny = true;
    showMergedEnemyDamage(e, dealt, false);
    e.hp -= dealt;
    applyEnemyKnockback(e, pos, 2.8 * mul);
    flashEnemy(e);
    if (e.hp <= 0) {
      dropAmmoFromEnemy(e, hitPt);
      playKill();
      clearEnemyDamagePopup(e);
      scene.remove(e.root);
      dead.push(e);
      score += scoreForKill();
    }
  }
  for (const e of dead) {
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
  }
  if (hitAny) {
    showHitmarker();
    playHit();
    scoreEl.textContent = `Score: ${score}`;
  }
}

function clearGrenades() {
  for (const g of grenades) {
    scene.remove(g.mesh);
    g.mesh.geometry.dispose();
    g.mesh.material.dispose();
  }
  grenades.length = 0;
}

function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t -= dt;
    g.vel.y -= GRENADE_GRAVITY * dt;
    g.mesh.position.addScaledVector(g.vel, dt);

    const r = resolveEntityXZ(g.mesh.position.x, g.mesh.position.z, 0.16, g.mesh.position.y);
    if (Math.abs(r.x - g.mesh.position.x) > 0.001) g.vel.x *= -0.48;
    if (Math.abs(r.z - g.mesh.position.z) > 0.001) g.vel.z *= -0.48;
    g.mesh.position.x = r.x;
    g.mesh.position.z = r.z;

    if (g.mesh.position.y < 0.12) {
      g.mesh.position.y = 0.12;
      if (Math.abs(g.vel.y) > 0.75) g.vel.y = Math.abs(g.vel.y) * GRENADE_BOUNCE_DAMPING;
      else g.vel.y = 0;
      g.vel.x *= 0.86;
      g.vel.z *= 0.86;
    }

    if (g.t <= 0) {
      const p = g.mesh.position.clone();
      scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      g.mesh.material.dispose();
      grenades.splice(i, 1);
      explodeGrenadeAt(p, g.damage, g.radius);
    }
  }
}

function tryMeleeAttack() {
  const cfg = getMeleeDef();
  knifeSwingT = 0.001;
  getInteractionEyeWorld(tmpEyeWorld);
  camera.getWorldDirection(tmpV);
  const meleeCos = Math.cos(THREE.MathUtils.degToRad(cfg.meleeConeDeg));

  const hits = [];
  for (const e of enemies) {
    const aimY = e.meleeAimY ?? 0.86;
    tmpV2.set(e.root.position.x, e.root.position.y + aimY, e.root.position.z);
    tmpV2.sub(tmpEyeWorld);
    const dist = tmpV2.length();
    if (dist > cfg.meleeRange || dist < 0.012) continue;
    tmpV2.normalize();
    if (tmpV.dot(tmpV2) < meleeCos) continue;

    raycaster.ray.origin.copy(tmpEyeWorld);
    raycaster.ray.direction.copy(tmpV2);
    raycaster.near = 0.03;
    raycaster.far = cfg.meleeRange + 0.4;
    const inter = raycaster.intersectObject(e.root, true);
    if (inter.length === 0) continue;
    const rec = inter[0];
    if (rec.distance > cfg.meleeRange) continue;
    hits.push({ kind: "enemy", e, rec, d: rec.distance });
  }
  if (practiceMovingTargets) {
    for (const t of practiceTargets) {
      if (t.dead) continue;
      tmpV2.set(t.root.position.x, t.root.position.y, t.root.position.z);
      tmpV2.sub(tmpEyeWorld);
      const dist = tmpV2.length();
      if (dist > cfg.meleeRange || dist < 0.012) continue;
      tmpV2.normalize();
      if (tmpV.dot(tmpV2) < meleeCos) continue;
      raycaster.ray.origin.copy(tmpEyeWorld);
      raycaster.ray.direction.copy(tmpV2);
      raycaster.near = 0.03;
      raycaster.far = cfg.meleeRange + 0.4;
      const inter = raycaster.intersectObject(t.root, true);
      if (inter.length === 0) continue;
      const rec = inter[0];
      if (rec.distance > cfg.meleeRange) continue;
      hits.push({ kind: "practice", t, rec, d: rec.distance });
    }
  }
  hits.sort((a, b) => a.d - b.d);

  gunRecoilZ = Math.max(gunRecoilZ, 0.016);
  if (hits.length === 0) return;

  let anyHead = false;
  let anyPractice = false;
  let anyBonusPractice = false;
  const dead = [];
  for (const h of hits) {
    if (h.kind === "practice") {
      if (hitPracticeTarget(h.t, h.rec.point, { suppressFeedback: true })) {
        anyPractice = true;
        if (h.t.isBonus) anyBonusPractice = true;
      }
      continue;
    }
    const { e, rec } = h;
    const headshot = isHeadshotFromHit(rec.object);
    if (headshot) anyHead = true;
    const base = cfg.damage;
    const dmg = headshot ? base * 2 : base;
    showMergedEnemyDamage(e, dmg, headshot);
    e.hp -= dmg;
    burstAt(rec.point);
    applyEnemyKnockback(e, tmpEyeWorld, 1.15);
    flashEnemy(e);
    if (e.hp <= 0) {
      dropAmmoFromEnemy(e, rec.point);
      playKill();
      clearEnemyDamagePopup(e);
      burstDeathAt(rec.point);
      scene.remove(e.root);
      dead.push(e);
      score += scoreForKill();
    }
  }
  for (const e of dead) {
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
  }
  scoreEl.textContent = `Score: ${score}`;
  if (anyPractice || anyHead || dead.length) {
    showHitmarker();
    if (anyHead || anyBonusPractice) playHeadshot();
    else playHit();
  }
}

const SHOTGUN_PELLET_AXES = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 0.92],
  [0, -0.92],
  [0.78, 0.78],
  [-0.78, 0.78],
  [0.78, -0.78],
  [-0.78, -0.78],
  [0.52, -0.42],
];
const SHOTGUN_SPREAD_DEG = 3.6;

function isThirdPersonForView() {
  if (!thirdPersonMode) return false;
  if (!playing || health <= 0) return false;
  if (
    (activeWeapon === SLOT_PRIMARY || activeWeapon === SLOT_SECONDARY) &&
    adsBlend > 0.52
  )
    return false;
  return true;
}

/** Melee / grenade spawn: eye height, not the offset third-person camera. */
function getInteractionEyeWorld(out) {
  if (isThirdPersonForView()) eyeAimAnchor.getWorldPosition(out);
  else camera.getWorldPosition(out);
  return out;
}

/** Tracer and hitscan origin: muzzle in first person; forward from eye in third person. */
function getTracerRayStart(out) {
  if (isThirdPersonForView()) {
    eyeAimAnchor.getWorldPosition(out);
    const dir = tmpTracerDir;
    camera.getWorldDirection(dir);
    out.addScaledVector(dir, THIRD_PERSON_FIRE_FORWARD_OF_EYE);
    return out;
  }
  const pIdx = loadoutChoice[SLOT_PRIMARY];
  const sIdx = loadoutChoice[SLOT_SECONDARY];
  const muzzleObj =
    activeWeapon === SLOT_PRIMARY
      ? primaryMuzzleWorld[pIdx]
      : secondaryMuzzleWorld[sIdx];
  muzzleObj.getWorldPosition(out);
  return out;
}

function shootShotgunPellets(start) {
  updateAimNdc();
  const camDir = tmpTracerDir;
  camera.getWorldDirection(camDir);
  const worldUp = tmpEyeWorld;
  worldUp.set(0, 1, 0);
  const right = tmpV2;
  right.crossVectors(camDir, worldUp);
  if (right.lengthSq() < 1e-10) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }
  const up = tmpV;
  up.crossVectors(right, camDir).normalize();
  const spread = THREE.MathUtils.degToRad(SHOTGUN_SPREAD_DEG);
  const pelletDir = tmpShotPelletDir;
  const dmgByEnemy = new Map();
  const practiceByTarget = new Map();

  for (const [sx, sy] of SHOTGUN_PELLET_AXES) {
    pelletDir.copy(camDir);
    pelletDir.addScaledVector(right, sx * spread);
    pelletDir.addScaledVector(up, sy * spread);
    pelletDir.normalize();
    raycaster.set(start, pelletDir);
    raycaster.near = 0;
    raycaster.far = 120;
    const hits = raycaster.intersectObjects(shootRaycastRoots(), true);
    if (hits.length === 0) continue;
    const rec = hits[0];
    const pt = getPracticeTargetFromObject(rec.object);
    if (pt) {
      if (!pt.dead && !practiceByTarget.has(pt))
        practiceByTarget.set(pt, rec.point.clone());
      continue;
    }
    const e = getEnemyFromObject(rec.object);
    if (!e) continue;
    const dist = start.distanceTo(rec.point);
    const basePellet = shotgunPelletDamageAtDistance(dist);
    const head = isHeadshotFromHit(rec.object);
    const dmg = head ? Math.round(basePellet * 2 * 10) / 10 : basePellet;
    let row = dmgByEnemy.get(e);
    if (!row) {
      row = { acc: 0, head: false, pt: rec.point.clone() };
      dmgByEnemy.set(e, row);
    }
    row.acc += dmg;
    row.head = row.head || head;
    row.pt.copy(rec.point);
  }

  camera.getWorldDirection(tmpTracerDir);
  tmpDmgProj.copy(tmpTracerDir).multiplyScalar(22).add(start);
  addTracer(start, tmpDmgProj);

  let anyHead = false;
  const dead = [];
  for (const [e, row] of dmgByEnemy) {
    if (row.acc <= 0) continue;
    anyHead = anyHead || row.head;
    showMergedEnemyDamage(e, row.acc, row.head);
    e.hp -= row.acc;
    burstAt(row.pt);
    applyEnemyKnockback(e, start, 1.95);
    flashEnemy(e);
    if (e.hp <= 0) {
      dropAmmoFromEnemy(e, row.pt);
      playKill();
      clearEnemyDamagePopup(e);
      burstDeathAt(row.pt);
      scene.remove(e.root);
      dead.push(e);
      score += scoreForKill();
    }
  }
  for (const e of dead) {
    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
  }
  let anyPractice = false;
  let anyBonusPractice = false;
  for (const [pt, p] of practiceByTarget) {
    if (hitPracticeTarget(pt, p, { suppressFeedback: true })) {
      anyPractice = true;
      if (pt.isBonus) anyBonusPractice = true;
    }
  }
  if (dmgByEnemy.size > 0 || anyPractice) {
    scoreEl.textContent = `Score: ${score}`;
    showHitmarker();
    if (anyHead || anyBonusPractice) playHeadshot();
    else playHit();
  }
}

function shoot() {
  const pIdx = loadoutChoice[SLOT_PRIMARY];
  const sIdx = loadoutChoice[SLOT_SECONDARY];

  if (activeWeapon === SLOT_PRIMARY && pIdx === PRIMARY_INDEX_SHOTGUN) {
    playShoot("shotgun");
    recoilPulseTimer = RECOIL_PULSE_TIME;
    const sh = fireShakeForCurrentWeapon(pIdx);
    addCameraShake(sh.t, sh.a, 0.72);
    const ix = pIdx;
    const pLight = primaryMuzzleLights[ix];
    const pFlash = primaryMuzzleFlashes[ix];
    pLight.intensity = 3.5;
    pFlash.material.opacity = 1;
    setTimeout(() => {
      pLight.intensity = 0;
      pFlash.material.opacity = 0;
    }, 48);
    gunRecoilZ = Math.max(gunRecoilZ, 0.062);
    getTracerRayStart(tmpV);
    const start = tmpV.clone();
    shootShotgunPellets(start);
    return;
  }

  const shootKind =
    activeWeapon === SLOT_PRIMARY
      ? pIdx === PRIMARY_INDEX_SMG
        ? "smg"
        : "rifle"
      : "pistol";
  playShoot(shootKind);
  recoilPulseTimer = RECOIL_PULSE_TIME;
  const sh = fireShakeForCurrentWeapon(pIdx);
  addCameraShake(sh.t, sh.a, 0.72);

  getTracerRayStart(tmpV);
  const start = tmpV.clone();

  updateAimNdc();
  raycaster.setFromCamera(aimNdc, camera);
  raycaster.near = 0;
  raycaster.far = Infinity;
  const hitList = raycaster.intersectObjects(shootRaycastRoots(), true);

  let end;
  let hitEnemy = null;
  let firstPractice = null;
  if (hitList.length > 0) {
    const hit = hitList[0];
    if (activeWeapon === SLOT_PRIMARY && pIdx === PRIMARY_INDEX_SNIPER) {
      raycaster.ray.at(75, tmpV2);
      end = tmpV2.clone();
    } else {
      end = hit.point.clone();
    }
    hitEnemy = getEnemyFromObject(hit.object);
    firstPractice = getPracticeTargetFromObject(hit.object);
  } else {
    raycaster.ray.at(55, tmpV2);
    end = tmpV2.clone();
  }

  addTracer(start, end);

  if (activeWeapon === SLOT_PRIMARY) {
    const ix = pIdx;
    const pLight = primaryMuzzleLights[ix];
    const pFlash = primaryMuzzleFlashes[ix];
    pLight.intensity = 3.5;
    pFlash.material.opacity = 1;
    setTimeout(() => {
      pLight.intensity = 0;
      pFlash.material.opacity = 0;
    }, 48);
  } else {
    const jx = sIdx;
    const sLight = secondaryMuzzleLights[jx];
    const sFlash = secondaryMuzzleFlashes[jx];
    sLight.intensity = 2.8;
    sFlash.material.opacity = 1;
    setTimeout(() => {
      sLight.intensity = 0;
      sFlash.material.opacity = 0;
    }, 42);
  }

  gunRecoilZ = Math.max(
    gunRecoilZ,
    activeWeapon === SLOT_PRIMARY
      ? pIdx === PRIMARY_INDEX_SNIPER
        ? 0.094
        : pIdx === PRIMARY_INDEX_ASSAULT
          ? 0.034
          : 0.052
      : 0.034
  );

  if (activeWeapon === SLOT_PRIMARY && pIdx === PRIMARY_INDEX_SNIPER) {
    if (hitList.length === 0) return;
    let anyHead = false;
    const dead = [];
    const seen = new Set();
    const seenPractice = new Set();
    let anyPracticeHit = false;
    let anyBonusSniperPractice = false;
    for (const h of hitList) {
      const pt = getPracticeTargetFromObject(h.object);
      if (pt) {
        if (seenPractice.has(pt) || pt.dead) continue;
        seenPractice.add(pt);
        const wasBonus = pt.isBonus;
        hitPracticeTarget(pt, h.point, { suppressFeedback: true });
        anyPracticeHit = true;
        if (wasBonus) anyBonusSniperPractice = true;
        continue;
      }
      const e = getEnemyFromObject(h.object);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const headshot = isHeadshotFromHit(h.object);
      const dmg = headshot ? 100 : 50;
      anyHead = anyHead || headshot;
      showMergedEnemyDamage(e, dmg, headshot);
      e.hp -= dmg;
      burstAt(h.point);
      applyEnemyKnockback(e, start, 1.8);
      flashEnemy(e);
      if (e.hp <= 0) {
        dropAmmoFromEnemy(e, h.point);
        playKill();
        clearEnemyDamagePopup(e);
        burstDeathAt(h.point);
        scene.remove(e.root);
        dead.push(e);
        score += scoreForKill();
      }
    }
    for (const e of dead) {
      const idx = enemies.indexOf(e);
      if (idx !== -1) enemies.splice(idx, 1);
    }
    if (seen.size > 0 || anyPracticeHit) {
      showHitmarker();
      if (anyHead || anyBonusSniperPractice) playHeadshot();
      else playHit();
      scoreEl.textContent = `Score: ${score}`;
    }
    return;
  }

  if (firstPractice && !firstPractice.dead) {
    hitPracticeTarget(firstPractice, hitList[0].point);
    return;
  }

  if (!hitEnemy) return;
  const headshot = isHeadshotFromHit(hitList[0].object);
  const hitDist = start.distanceTo(hitList[0].point);
  let base;
  if (activeWeapon === SLOT_PRIMARY) {
    base =
      Math.round(
        assaultRifleBodyDamageAtDistance(hitDist) *
          getPrimaryDef().arDamageMul *
          10
      ) / 10;
  } else {
    base =
      Math.round(
        handgunBodyDamageAtDistance(hitDist) *
          getSecondaryDef().hgDamageMul *
          10
      ) / 10;
  }
  const dmg = headshot ? Math.round(base * 2 * 10) / 10 : base;
  showHitmarker();
  if (headshot) playHeadshot();
  else playHit();
  showMergedEnemyDamage(hitEnemy, dmg, headshot);
  hitEnemy.hp -= dmg;
  burstAt(hitList[0]?.point ?? end);
  applyEnemyKnockback(hitEnemy, start, activeWeapon === SLOT_SECONDARY ? 1.45 : 1.8);
  flashEnemy(hitEnemy);
  if (hitEnemy.hp <= 0) {
    dropAmmoFromEnemy(hitEnemy, hitList[0]?.point);
    playKill();
    clearEnemyDamagePopup(hitEnemy);
    burstDeathAt(hitList[0]?.point ?? hitEnemy.root.position);
    scene.remove(hitEnemy.root);
    const idx = enemies.indexOf(hitEnemy);
    if (idx !== -1) enemies.splice(idx, 1);
    score += scoreForKill();
    scoreEl.textContent = `Score: ${score}`;
  }
}

function clampPlayer() {
  if (activeMapId === "practice2_obby" || practiceMode2) return;
  const p = yaw.position;
  const max = ARENA - PLAYER_RADIUS - 0.5;
  p.x = THREE.MathUtils.clamp(p.x, -max, max);
  p.z = THREE.MathUtils.clamp(p.z, -max, max);
}

function tryDamagePlayer() {
  const pxz = new THREE.Vector2(yaw.position.x, yaw.position.z);
  for (const e of enemies) {
    const exz = new THREE.Vector2(e.root.position.x, e.root.position.z);
    const reach = e.meleeReach ?? 1.05;
    if (pxz.distanceTo(exz) < reach) {
      if (damageCooldown <= 0) {
        void resumeAudio();
        playEnemyAttack();
        playHurt();
        addCameraShake(0.14, 0.026, 0.36);
        health -= e.damage ?? ENEMY_DAMAGE;
        damageCooldown = DAMAGE_COOLDOWN;
        hurtFlash = Math.min(0.82, hurtFlash + 0.48);
        updateHealthHud();
        if (health <= 0) endGame();
      }
      return;
    }
  }
}

function updateHurtVignette(dt) {
  if (!damageVignetteEl) return;
  hurtFlash = Math.max(0, hurtFlash - dt * 1.95);
  healFlash = Math.max(0, healFlash - dt * 1.65);
  if (!playing || health <= 0) {
    damageVignetteEl.style.setProperty("--hurt-edge", "0");
    damageVignetteEl.style.setProperty("--heal-edge", "0");
    return;
  }
  const h = THREE.MathUtils.clamp(health, 0, PLAYER_MAX_HEALTH);
  const lost = 1 - h / PLAYER_MAX_HEALTH;
  const edge = Math.min(0.88, lost * lost * 0.5 + hurtFlash * 1.35);
  const healEdge = Math.min(0.48, healFlash);
  damageVignetteEl.style.setProperty("--hurt-edge", edge.toFixed(4));
  damageVignetteEl.style.setProperty("--heal-edge", healEdge.toFixed(4));
}

function updateHealthHud() {
  const h = THREE.MathUtils.clamp(health, 0, PLAYER_MAX_HEALTH);
  healthEl.textContent = `Health: ${Math.max(0, Math.round(h))}`;
  if (healthBarFillEl) {
    const t = h / PLAYER_MAX_HEALTH;
    healthBarFillEl.style.width = `${(t * 100).toFixed(1)}%`;
    healthBarFillEl.style.background = `hsl(${Math.round(6 + t * 112)} 84% 54%)`;
  }
}

function addCameraShake(timeSec, amp, jitter = 0.2) {
  camShakeTime = Math.max(camShakeTime, timeSec);
  camShakeAmp = Math.max(camShakeAmp, amp);
  camShakeJitter = Math.max(camShakeJitter, jitter);
}

function fireShakeForCurrentWeapon(primaryIdx) {
  if (activeWeapon === SLOT_PRIMARY) {
    if (primaryIdx === PRIMARY_INDEX_SNIPER) return { t: 0.2, a: 0.038 };
    if (primaryIdx === PRIMARY_INDEX_SHOTGUN) return { t: 0.17, a: 0.031 };
    if (primaryIdx === PRIMARY_INDEX_ASSAULT) return { t: 0.13, a: 0.016 };
    if (primaryIdx === PRIMARY_INDEX_SMG) return { t: 0.1, a: 0.013 };
    return { t: 0.145, a: 0.02 };
  }
  const sIdx = loadoutChoice[SLOT_SECONDARY];
  if (sIdx === 0) return { t: 0.095, a: 0.011 };
  if (sIdx === 1) return { t: 0.12, a: 0.015 };
  return { t: 0.14, a: 0.019 };
}

function enterGame() {
  void resumeAudio();
  overlay.classList.add("hidden");
  if (health > 0) {
    syncPracticeSessionIfNeeded();
    playing = true;
    crosshair.classList.add("active");
  }
}

/** Pause and show main overlay (pointer lock release or drag mode). */
function pauseToMenu() {
  if (!playing || health <= 0) return;
  if (gameoverEl && !gameoverEl.classList.contains("hidden")) return;

  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
    return;
  }
  if (!useDragLook) return;

  fireHeld = false;
  draggingView = false;
  resetMobileInput();
  adsBlend = 0;
  crouchBlend = 0;
  resetGunSway();
  gunGroup.position.copy(GUN_HIP_POS);
  gunGroup.quaternion.copy(qGunHip);
  camera.position.y = EYE_STAND;
  crosshair.classList.remove("ads");
  if (hitmarkerEl) hitmarkerEl.classList.add("hidden");
  clearTimeout(hitmarkerHideTimer);
  playing = false;
  crosshair.classList.remove("active");
  closeMenuModals();
  overlay.classList.remove("hidden");
  startBtn.textContent = "Resume";
}

menuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  pauseToMenu();
});

function endGame() {
  playing = false;
  fireHeld = false;
  resetMobileInput();
  clearAmmoPickups();
  reloading = false;
  clearReloadSoundTimers();
  adsBlend = 0;
  crouchBlend = 0;
  resetGunSway();
  gunGroup.position.copy(GUN_HIP_POS);
  gunGroup.quaternion.copy(qGunHip);
  camera.position.y = EYE_STAND;
  crosshair.classList.remove("ads");
  if (hitmarkerEl) hitmarkerEl.classList.add("hidden");
  clearTimeout(hitmarkerHideTimer);
  draggingView = false;
  useDragLook = false;
  slideVelX = 0;
  slideVelZ = 0;
  slideCamOffsetX = 0;
  slideCamRoll = 0;
  slideBurstTimer = 0;
  switchingWeapon = false;
  switchTimer = 0;
  switchDuration = 0;
  footstepTimer = 0;
  camShakeTime = 0;
  camShakeAmp = 0;
  camShakeJitter = 0;
  camShakePhase = 0;
  clearTimeout(lockFallbackTimer);
  document.exitPointerLock?.();
  crosshair.classList.remove("active");
  resetAmmoToLoadout();
  startBtn.textContent = "Start";
  gameoverEl.classList.remove("hidden");
  finalScoreEl.textContent = `Final score: ${score}`;
  resetKillChain();
  clearGrenades();
  for (const e of enemies) clearEnemyDamagePopup(e);
}

function resetGame() {
  score = 0;
  resetKillChain();
  health = PLAYER_MAX_HEALTH;
  hurtFlash = 0;
  healFlash = 0;
  medkitUseTimer = 0;
  medkitPendingHeal = 0;
  medkitCooldownAfter = 0;
  fireTimer = 0;
  spawnTimer = 0;
  damageCooldown = 0;
  readLoadoutFromMenu();
  practiceMovingTargets = readPracticeMovingTargets();
  practiceMode2 = readPracticeReactionMode();
  practiceMode = practiceMovingTargets || practiceMode2;
  rebuildLevelForCurrentPracticeState();
  if (practiceMode) loadoutChoice[SLOT_PRIMARY] = PRIMARY_INDEX_ASSAULT;
  refreshWeaponBarFromLoadout();
  activeWeapon = SLOT_PRIMARY;
  resetAmmoToLoadout();
  utilityCdRemain = 0;
  gunGroup.visible = !practiceMode2;
  knifeModel.visible = false;
  syncLoadoutViewmodels();
  dashRemain = 0;
  dashCd = 0;
  dashFovBlend = 0;
  slideBurstTimer = 0;
  switchingWeapon = false;
  switchTimer = 0;
  switchDuration = 0;
  knifeSwingRtl = true;
  resetKnifeSwing();
  updateWeaponHud();
  reloading = false;
  reloadTimer = 0;
  clearReloadSoundTimers();
  fireHeld = false;
  resetMobileInput();
  slideVelX = 0;
  slideVelZ = 0;
  slideCamOffsetX = 0;
  slideCamRoll = 0;
  slideBurstTimer = 0;
  switchingWeapon = false;
  switchTimer = 0;
  switchDuration = 0;
  footstepTimer = 0;
  camShakeTime = 0;
  camShakeAmp = 0;
  camShakeJitter = 0;
  camShakePhase = 0;
  playerVelY = 0;
  adsBlend = 0;
  crouchBlend = 0;
  resetGunSway();
  gunGroup.position.copy(GUN_HIP_POS);
  gunGroup.quaternion.copy(qGunHip);
  camera.position.y = EYE_STAND;
  crosshair.classList.remove("ads");
  if (hitmarkerEl) hitmarkerEl.classList.add("hidden");
  clearTimeout(hitmarkerHideTimer);
  scoreEl.textContent = "Score: 0";
  updateHealthHud();
  updateAmmoHud();
  yaw.position.set(0, 0, 0);
  yaw.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  if (practiceMode2) resetPractice2SpawnToStart();
  else {
    resolvePlayerColliders();
    clampPlayer();
  }
  for (const e of enemies) {
    clearEnemyDamagePopup(e);
    scene.remove(e.root);
  }
  clearGrenades();
  clearAmmoPickups();
  enemies.length = 0;
  for (const sp of sparks) {
    scene.remove(sp.mesh);
    sp.mesh.geometry.dispose();
    sp.mesh.material.dispose();
  }
  sparks.length = 0;
  for (const tr of tracers) {
    scene.remove(tr.mesh);
    tr.geom.dispose();
    tr.mesh.material.dispose();
  }
  tracers.length = 0;
  gameoverEl.classList.add("hidden");
  if (practiceMovingTargets) {
    spawnPracticeGallery();
  } else {
    clearPracticeTargets();
  }
  if (practiceMode2) {
    schedulePracticeReactNext(performance.now());
  } else {
    teardownPracticeReactChallenge();
  }
  if (practiceHintEl) {
    if (practiceMode2) {
      practiceHintEl.textContent =
        "Practice 2: reach the glowing green finish for +420 · void = restart · flash every 1–15 s — CLICK RIGHT NOW within 1s · +55";
    } else if (practiceMovingTargets) {
      practiceHintEl.textContent =
        "Practice: blue ball = big bonus · orange balls roam the map · infinite AR";
    } else {
      practiceHintEl.textContent = "";
    }
  }
}

function requestPlay() {
  if (inputLayoutMobile === null) return;
  if (startBtn.textContent === "Start") {
    resetGame();
    useDragLook = false;
  }
  clearTimeout(lockFallbackTimer);
  if (useMobileFriendlyUi()) {
    useDragLook = true;
    enterGame();
    return;
  }
  if (typeof canvas.requestPointerLock !== "function") {
    useDragLook = true;
    enterGame();
    return;
  }
  canvas.requestPointerLock();
  lockFallbackTimer = setTimeout(() => {
    if (document.pointerLockElement === canvas || health <= 0) return;
    useDragLook = true;
    enterGame();
  }, 400);
}

startBtn.addEventListener("click", requestPlay);
restartBtn.addEventListener("click", () => {
  resetGame();
  gameoverEl.classList.add("hidden");
  useDragLook = false;
  clearTimeout(lockFallbackTimer);
  fireHeld = false;
  resetMobileInput();
  if (useMobileFriendlyUi()) {
    useDragLook = true;
    enterGame();
    return;
  }
  if (typeof canvas.requestPointerLock !== "function") {
    useDragLook = true;
    enterGame();
  } else {
    canvas.requestPointerLock();
    lockFallbackTimer = setTimeout(() => {
      if (document.pointerLockElement === canvas || health <= 0) return;
      useDragLook = true;
      enterGame();
    }, 400);
  }
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    clearTimeout(lockFallbackTimer);
    useDragLook = false;
    void resumeAudio();
    if (health > 0) {
      syncPracticeSessionIfNeeded();
      playing = true;
      crosshair.classList.add("active");
    }
    overlay.classList.add("hidden");
  } else {
    if (useDragLook && playing) return;
    fireHeld = false;
    resetMobileInput();
    draggingView = false;
    adsBlend = 0;
    crouchBlend = 0;
    resetGunSway();
    gunGroup.position.copy(GUN_HIP_POS);
    gunGroup.quaternion.copy(qGunHip);
    camera.position.y = EYE_STAND;
    crosshair.classList.remove("ads");
    if (hitmarkerEl) hitmarkerEl.classList.add("hidden");
    clearTimeout(hitmarkerHideTimer);
    playing = false;
    crosshair.classList.remove("active");
    if (health > 0 && gameoverEl.classList.contains("hidden")) {
      closeMenuModals();
      overlay.classList.remove("hidden");
      startBtn.textContent = "Resume";
    }
  }
});

document.addEventListener("pointerlockerror", () => {
  clearTimeout(lockFallbackTimer);
  useDragLook = true;
  enterGame();
});

document.addEventListener("keydown", (e) => {
  if (
    e.code === "Escape" &&
    !e.repeat &&
    inputLayoutModalOpen &&
    inputLayoutMobile !== null
  ) {
    e.preventDefault();
    inputLayoutModalOpen = false;
    updateInputLayoutModalVisibility();
    return;
  }
  if (e.code === "Escape" && !e.repeat && overlay && !overlay.classList.contains("hidden")) {
    const openModal = document.querySelector("#overlay .menu-modal:not(.hidden)");
    if (openModal) {
      e.preventDefault();
      closeMenuModals();
      return;
    }
  }
  keys.add(e.code);
  if (!e.repeat) {
    const now = performance.now();
    if (e.code === "KeyC") lastCrouchTapAt = now;
    if (isMoveKey(e.code)) lastMoveTapAt = now;
  }
  if (
    e.code === "KeyM" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    pauseToMenu();
  }
  if (
    e.code === "Digit1" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    switchWeapon(SLOT_PRIMARY);
  }
  if (
    e.code === "Digit2" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    switchWeapon(SLOT_SECONDARY);
  }
  if (
    e.code === "Digit3" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    switchWeapon(SLOT_MELEE);
  }
  if (
    e.code === "Digit4" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    switchWeapon(SLOT_UTILITY);
  }
  if (
    e.code === "KeyQ" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    if (dashCd <= 0 && dashRemain <= 0) {
      e.preventDefault();
      forward.set(0, 0, -1).applyQuaternion(yaw.quaternion);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, worldUp).normalize();
      dashDir.set(0, 0, 0);
      if (keys.has("KeyW")) dashDir.add(forward);
      if (keys.has("KeyS")) dashDir.sub(forward);
      if (keys.has("KeyA")) dashDir.sub(right);
      if (keys.has("KeyD")) dashDir.add(right);
      if (dashDir.lengthSq() < 1e-8) dashDir.copy(forward);
      else dashDir.normalize();
      dashRemain = DASH_DURATION;
      dashCd = DASH_COOLDOWN;
    }
  }
  if (e.code === "Escape" && useDragLook && playing && health > 0) {
    e.preventDefault();
    pauseToMenu();
  }
  if (e.code === "Space" && playing && health > 0 && !keys.has("KeyC")) {
    e.preventDefault();
  }
  if (
    e.code === "KeyR" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    activeWeapon !== SLOT_MELEE &&
    activeWeapon !== SLOT_UTILITY
  ) {
    startReload();
  }
  if (
    e.code === "KeyV" &&
    !e.repeat &&
    playing &&
    health > 0 &&
    gameoverEl?.classList.contains("hidden")
  ) {
    e.preventDefault();
    thirdPersonMode = !thirdPersonMode;
    try {
      localStorage.setItem("havoc_tp", thirdPersonMode ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));

document.addEventListener("pointermove", (e) => {
  if (!playing) return;
  const touchMul = e.pointerType === "touch" ? TOUCH_LOOK_SENS_MUL : 1;
  const aimSens =
    MOUSE_SENS * THREE.MathUtils.lerp(1, 0.74, adsBlend) * touchMul;
  if (pointerLocked) {
    yaw.rotation.y -= e.movementX * aimSens;
    pitch.rotation.x -= e.movementY * aimSens;
    pitch.rotation.x = THREE.MathUtils.clamp(pitch.rotation.x, -PITCH_LIMIT, PITCH_LIMIT);
  } else if (useDragLook && draggingView) {
    yaw.rotation.y -= (e.clientX - lastDragX) * aimSens;
    pitch.rotation.x -= (e.clientY - lastDragY) * aimSens;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    pitch.rotation.x = THREE.MathUtils.clamp(pitch.rotation.x, -PITCH_LIMIT, PITCH_LIMIT);
  }
});

canvas.addEventListener("click", () => {
  if (!pointerLocked && !useDragLook && health > 0 && gameoverEl.classList.contains("hidden")) {
    canvas.requestPointerLock?.();
  }
});

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !playing || !useDragLook) return;
  draggingView = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {
    /* ignore */
  }
});

canvas.addEventListener("pointerup", (e) => {
  if (e.button !== 0) return;
  draggingView = false;
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch (_) {
    /* ignore */
  }
});

canvas.addEventListener("pointercancel", () => {
  draggingView = false;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !playing) return;
  if (!useDragLook) fireHeld = true;
});

window.addEventListener("mouseup", (e) => {
  if (e.button === 0) fireHeld = false;
});

window.addEventListener("blur", () => {
  fireHeld = false;
  resetMobileInput();
  draggingView = false;
  adsBlend = 0;
  crouchBlend = 0;
  slideCamOffsetX = 0;
  slideCamRoll = 0;
  camShakeJitter = 0;
  resetGunSway();
  gunGroup.position.copy(GUN_HIP_POS);
  gunGroup.quaternion.copy(qGunHip);
  camera.position.y = EYE_STAND;
  camera.fov = CAMERA_FOV_HIP;
  dashFovBlend = 0;
  for (const L of primaryMuzzleLights) L.intensity = 0;
  for (const F of primaryMuzzleFlashes) F.material.opacity = 0;
  for (const L of secondaryMuzzleLights) L.intensity = 0;
  for (const F of secondaryMuzzleFlashes) F.material.opacity = 0;
  camera.updateProjectionMatrix();
  crosshair.classList.remove("ads");
  if (hitmarkerEl) hitmarkerEl.classList.add("hidden");
  clearTimeout(hitmarkerHideTimer);
});

function applyViewportSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h <= 0) return;
  const pr = Math.min(window.devicePixelRatio, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
}

applyViewportSize();
window.addEventListener("resize", applyViewportSize);

const clock = new THREE.Clock();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateHurtVignette(dt);
  const now = performance.now();
  let showSniperScope = false;

  updatePracticeReactChallenge(now);

  const inLiveGame =
    playing && health > 0 && gameoverEl?.classList.contains("hidden");
  const showMobileHud = useMobileFriendlyUi() && inLiveGame;
  const mobileRoot = document.getElementById("mobile-controls");
  const mobileCombat = document.getElementById("mobile-combat-btns");
  if (mobileRoot) {
    mobileRoot.classList.toggle("hidden", !showMobileHud);
    mobileRoot.setAttribute("aria-hidden", showMobileHud ? "false" : "true");
  }
  if (mobileCombat) {
    mobileCombat.classList.toggle("hidden", !showMobileHud || practiceMode2);
  }
  if (!showMobileHud) {
    resetMobileInput();
  }

  if (weaponBarEl) {
    weaponBarEl.classList.toggle(
      "allow-touch",
      useMobileFriendlyUi() && inLiveGame && !practiceMode2
    );
    weaponBarEl.classList.toggle(
      "hidden",
      !(playing && health > 0) || practiceMode2
    );
  }
  if (practiceHintEl)
    practiceHintEl.classList.toggle(
      "hidden",
      !(playing && health > 0 && practiceMode)
    );

  crosshair.classList.toggle(
    "knife-mode",
    playing && health > 0 && activeWeapon === SLOT_MELEE
  );

  if (playing && health > 0) {
    const wantAds =
      !practiceMode2 &&
      (keys.has("KeyE") || mobileAdsHeld) &&
      (activeWeapon === SLOT_PRIMARY || activeWeapon === SLOT_SECONDARY);
    const sniperAds = activeWeapon === SLOT_PRIMARY && loadoutChoice[SLOT_PRIMARY] === PRIMARY_INDEX_SNIPER;
    if (sniperAds && wantAds) {
      adsBlend = Math.min(1, adsBlend + dt / 0.5);
    } else {
      const activeAdsSmooth = sniperAds ? ADS_SMOOTH_SNIPER : ADS_SMOOTH;
      const adsK = 1 - Math.exp(-activeAdsSmooth * dt);
      adsBlend = THREE.MathUtils.lerp(adsBlend, wantAds ? 1 : 0, adsK);
    }
    const crK = 1 - Math.exp(-CROUCH_SMOOTH * dt);
    crouchBlend = THREE.MathUtils.lerp(crouchBlend, keys.has("KeyC") ? 1 : 0, crK);

    const eyeY = THREE.MathUtils.lerp(EYE_STAND, EYE_CROUCH, crouchBlend);
    eyeAimAnchor.position.set(0, eyeY, 0);

    const thirdPersonActive = isThirdPersonForView();
    if (thirdPersonActive) {
      camera.near = THIRD_PERSON_NEAR;
      camera.position.set(0, eyeY + THIRD_PERSON_CAMERA_Y_OFST, THIRD_PERSON_CAMERA_Z);
    } else {
      camera.near = FIRST_PERSON_NEAR;
      camera.position.set(0, eyeY, 0);
    }
    camera.rotation.x = 0;
    camera.rotation.y = 0;
    camera.rotation.z = 0;

    if (camShakeTime > 0) {
      const t = camShakeTime;
      camShakePhase += dt * 34;
      const jitter = camShakeJitter;
      const rx = (Math.random() - 0.5) * camShakeAmp * jitter;
      const ry = (Math.random() - 0.5) * camShakeAmp * jitter;
      const rz = (Math.random() - 0.5) * camShakeAmp * jitter * 0.8;
      camera.position.x += Math.sin(camShakePhase * 1.7) * camShakeAmp * 0.46 + rx;
      camera.position.y += Math.sin(camShakePhase * 2.3 + 0.7) * camShakeAmp * 0.31 + ry * 0.7;
      camera.position.z += Math.sin(camShakePhase * 1.1 + 1.4) * camShakeAmp * 0.2 + rz * 0.55;
      camera.rotation.x += Math.sin(camShakePhase * 2.05 + 0.55) * camShakeAmp * 0.16 + rx * 0.35;
      camera.rotation.y += Math.sin(camShakePhase * 1.48 + 1.2) * camShakeAmp * 0.13 + ry * 0.28;
      camera.rotation.z += Math.sin(camShakePhase * 1.8 + 2.1) * camShakeAmp * 0.11 + rz * 0.22;
      camShakeTime = Math.max(0, camShakeTime - dt);
      camShakeAmp *= Math.exp(-8.8 * dt);
      camShakeJitter *= Math.exp(-10.5 * dt);
      if (t <= dt) camShakeAmp = 0;
    }

    if (adsBlend > 0.55) crosshair.classList.add("ads");
    else crosshair.classList.remove("ads");

    showSniperScope =
      activeWeapon === SLOT_PRIMARY &&
      loadoutChoice[SLOT_PRIMARY] === PRIMARY_INDEX_SNIPER &&
      adsBlend > 0.55;
    sniperScopeEl?.classList.toggle("hidden", !showSniperScope);
    crosshair.classList.toggle("hidden", showSniperScope);

    const dashFovTarget = dashRemain > 0 ? 1 : 0;
    const dfk = 1 - Math.exp(-DASH_FOV_SMOOTH * dt);
    dashFovBlend = THREE.MathUtils.lerp(dashFovBlend, dashFovTarget, dfk);
    const baseFov = THREE.MathUtils.lerp(CAMERA_FOV_HIP, CAMERA_FOV_ADS, adsBlend);
    camera.fov =
      baseFov +
      DASH_FOV_BOOST * dashFovBlend +
      (thirdPersonActive ? THIRD_PERSON_FOV_EXTRA : 0);
    camera.updateProjectionMatrix();

    const moveMul = THREE.MathUtils.lerp(1, CROUCH_SPEED_MUL, crouchBlend);

    forward.set(0, 0, -1).applyQuaternion(yaw.quaternion);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, worldUp).normalize();
    const rightSlide = right.x * slideVelX + right.z * slideVelZ;
    const slideMag = THREE.MathUtils.clamp(Math.hypot(slideVelX, slideVelZ) / (MOVE_SPEED * 1.9), 0, 1);
    let slideNorm = THREE.MathUtils.clamp(rightSlide / (MOVE_SPEED * 1.8), -1, 1);
    if (slideBurstTimer > 0 && Math.abs(slideNorm) < 0.1) {
      // Forward slide still gets a readable side lean.
      slideNorm = slideSideSign * slideMag * 0.75;
    }
    const slideTargetX = slideNorm * 0.13;
    const slideTargetRoll = -slideNorm * 0.08;
    const slideCamK = 1 - Math.exp(-9 * dt);
    slideCamOffsetX = THREE.MathUtils.lerp(slideCamOffsetX, slideTargetX, slideCamK);
    slideCamRoll = THREE.MathUtils.lerp(slideCamRoll, slideTargetRoll, slideCamK);
    camera.position.x +=
      slideCamOffsetX * (thirdPersonActive ? 0.35 : 1);
    camera.rotation.z += slideCamRoll * (thirdPersonActive ? 0.45 : 1);

    dashCd = Math.max(0, dashCd - dt);
    if (dashRemain > 0) {
      const step = Math.min(dt, dashRemain);
      yaw.position.addScaledVector(dashDir, DASH_SPEED * step);
      dashRemain -= step;
      resolvePlayerColliders();
      clampPlayer();
    } else {
      let mx = 0;
      let mz = 0;
      if (keys.has("KeyW")) {
        mx += forward.x;
        mz += forward.z;
      }
      if (keys.has("KeyS")) {
        mx -= forward.x;
        mz -= forward.z;
      }
      if (keys.has("KeyA")) {
        mx -= right.x;
        mz -= right.z;
      }
      if (keys.has("KeyD")) {
        mx += right.x;
        mz += right.z;
      }
      mx += forward.x * mobileFwd + right.x * mobileStrafe;
      mz += forward.z * mobileFwd + right.z * mobileStrafe;
      const len = Math.hypot(mx, mz);
      const weaponMoveMul = moveMulForActiveSlot();
      const crouchHeld = keys.has("KeyC");
      if (len > 0) {
        const dirX = mx / len;
        const dirZ = mz / len;
        const baseStep = MOVE_SPEED * moveMul * weaponMoveMul * dt;
        const nowMs = performance.now();
        const windowOk =
          crouchHeld &&
          nowMs - Math.max(lastCrouchTapAt, lastMoveTapAt) <= SLIDE_INPUT_WINDOW_MS &&
          Math.abs(lastCrouchTapAt - lastMoveTapAt) <= SLIDE_INPUT_WINDOW_MS;
        if (windowOk && slideBurstTimer <= 0) {
          slideBurstTimer = SLIDE_BURST_TIME;
          slideDirX = dirX;
          slideDirZ = dirZ;
          const lateral = right.x * dirX + right.z * dirZ;
          if (Math.abs(lateral) < 0.22) slideSideSign = Math.sin(nowMs * 0.013) >= 0 ? 1 : -1;
          else slideSideSign = lateral >= 0 ? 1 : -1;
          slideVelX = slideDirX * MOVE_SPEED * 1.85 * weaponMoveMul;
          slideVelZ = slideDirZ * MOVE_SPEED * 1.85 * weaponMoveMul;
          addCameraShake(0.06, 0.007, 0.25);
        }
        if (slideBurstTimer > 0) {
          yaw.position.x += slideVelX * dt;
          yaw.position.z += slideVelZ * dt;
          slideBurstTimer = Math.max(0, slideBurstTimer - dt);
          slideVelX = THREE.MathUtils.lerp(slideVelX, slideDirX * MOVE_SPEED * 0.96 * weaponMoveMul, 1 - Math.exp(-9 * dt));
          slideVelZ = THREE.MathUtils.lerp(slideVelZ, slideDirZ * MOVE_SPEED * 0.96 * weaponMoveMul, 1 - Math.exp(-9 * dt));
        } else {
          mx = dirX * baseStep;
          mz = dirZ * baseStep;
          yaw.position.x += mx;
          yaw.position.z += mz;
          slideVelX = THREE.MathUtils.lerp(slideVelX, 0, 1 - Math.exp(-14 * dt));
          slideVelZ = THREE.MathUtils.lerp(slideVelZ, 0, 1 - Math.exp(-14 * dt));
        }
      } else if (slideBurstTimer > 0) {
        yaw.position.x += slideVelX * dt;
        yaw.position.z += slideVelZ * dt;
        slideBurstTimer = Math.max(0, slideBurstTimer - dt);
        slideVelX = THREE.MathUtils.lerp(slideVelX, 0, 1 - Math.exp(-4.8 * dt));
        slideVelZ = THREE.MathUtils.lerp(slideVelZ, 0, 1 - Math.exp(-4.8 * dt));
      } else {
        slideVelX = THREE.MathUtils.lerp(slideVelX, 0, 1 - Math.exp(-16 * dt));
        slideVelZ = THREE.MathUtils.lerp(slideVelZ, 0, 1 - Math.exp(-16 * dt));
      }
      resolvePlayerColliders();
      clampPlayer();
    }

    updateDamageFloaters();

    playerVelY -= GRAVITY * dt;
    yaw.position.y += playerVelY * dt;
    const vyBeforeSupport = playerVelY;
    const pSnap = snapFeetToSupport(
      yaw.position.x,
      yaw.position.z,
      PLAYER_RADIUS,
      yaw.position.y,
      playerVelY
    );
    yaw.position.y = pSnap.y;
    playerVelY = pSnap.vy;
    if (practiceMode2 && yaw.position.y < PRACTICE2_VOID_Y) {
      resetPractice2SpawnToStart();
    }
    if (
      practiceMode2 &&
      activeMapId === "practice2_obby" &&
      playing &&
      health > 0 &&
      gameoverEl.classList.contains("hidden") &&
      pSnap.vy === 0
    ) {
      const onF = isPlayerOnPractice2Finish(
        yaw.position.x,
        yaw.position.z,
        yaw.position.y
      );
      if (onF && !practice2ObbyWasOnFinish) triggerPractice2ObbyFinish();
      practice2ObbyWasOnFinish = onF;
    }
    if (pSnap.vy === 0 && vyBeforeSupport < -1.15) {
      const landInt = Math.min(1, (-vyBeforeSupport - 1.15) / 11);
      void resumeAudio();
      playLandThud(landInt);
    }
    if (pSnap.vy === 0 && vyBeforeSupport < -0.45) {
      const tramp = getTrampolineUnderFeet(
        yaw.position.x,
        yaw.position.z,
        PLAYER_RADIUS,
        yaw.position.y
      );
      if (tramp) {
        const nx = (yaw.position.x - tramp.cx) / Math.max(0.001, tramp.hw);
        const nz = (yaw.position.z - tramp.cz) / Math.max(0.001, tramp.hd);
        const centerFalloff = THREE.MathUtils.clamp(1 - Math.hypot(nx, nz), 0.72, 1.08);
        const incoming = Math.max(0, -vyBeforeSupport);
        const launch = tramp.boost * centerFalloff + incoming * 0.52;
        playerVelY = Math.max(playerVelY, launch);
        addCameraShake(0.08, 0.006, 0.15);
      }
    }

    if (
      keys.has("Space") &&
      playing &&
      health > 0 &&
      gameoverEl.classList.contains("hidden") &&
      !keys.has("KeyC") &&
      canPlayerJump()
    ) {
      void resumeAudio();
      playJump();
      playerVelY = JUMP_SPEED;
    }

    const stepSpeed = Math.hypot(slideVelX, slideVelZ);
    const anyWasd =
      keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD");
    const mobileWalkStick = Math.hypot(mobileFwd, mobileStrafe) > 0.12;
    const movingOnFoot = pSnap.vy === 0 && (stepSpeed > 1.2 || anyWasd || mobileWalkStick);
    if (movingOnFoot) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        playFootstep(keys.has("KeyC") ? "crouch" : "run");
        footstepTimer = keys.has("KeyC") ? 0.36 : 0.26;
      }
    } else {
      footstepTimer = 0;
    }

    fireTimer -= dt;
    if (switchingWeapon) {
      switchTimer = Math.max(0, switchTimer - dt);
      if (switchTimer <= 0) switchingWeapon = false;
      updateAmmoHud();
    }
    utilityCdRemain = Math.max(0, utilityCdRemain - dt);
    if (medkitUseTimer > 0) {
      medkitUseTimer = Math.max(0, medkitUseTimer - dt);
      if (medkitUseTimer <= 0 && medkitPendingHeal > 0) {
        health = Math.min(PLAYER_MAX_HEALTH, health + medkitPendingHeal);
        medkitPendingHeal = 0;
        utilityCdRemain = Math.max(utilityCdRemain, medkitCooldownAfter);
        medkitCooldownAfter = 0;
        healFlash = Math.min(0.52, healFlash + 0.45);
        updateHealthHud();
        playReloadDone();
      }
      updateAmmoHud();
    } else if (activeWeapon === SLOT_UTILITY) {
      updateAmmoHud();
    }
    if (reloading) {
      if (practicePrimaryInfiniteAmmo()) {
        clearReloadSoundTimers();
        reloading = false;
        reloadTimer = 0;
        updateAmmoHud();
      } else {
        reloadTimer -= dt;
        updateAmmoHud();
        if (reloadTimer <= 0) finishReload();
      }
    }

    const wantsFire =
      (!useDragLook && fireHeld) ||
      (useDragLook && keys.has("KeyF")) ||
      mobileFireHeld;
    if (wantsFire) tryFire();

    if (practiceMovingTargets) {
      updatePracticeTargets(dt);
    } else {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = SPAWN_INTERVAL;
      }
    }
    updateGrenades(dt);
    updateAmmoPickups(dt);

    const playerPos = yaw.position;
    navFlowTimer -= dt;
    const playerCell = worldToNavCell(playerPos.x, playerPos.z);
    const playerCellChanged =
      !!playerCell &&
      (playerCell.cx !== lastNavPlayerCellX || playerCell.cz !== lastNavPlayerCellZ);
    if (
      !practiceMode &&
      (playerCellChanged || navFlowTimer <= 0)
    ) {
      rebuildNavFlowToPlayer(playerPos.x, playerPos.z);
      navFlowTimer = 0.18;
      if (playerCell) {
        lastNavPlayerCellX = playerCell.cx;
        lastNavPlayerCellZ = playerCell.cz;
      }
    }
    if (!practiceMode) {
    for (const e of enemies) {
      e.jumpCd = Math.max(0, (e.jumpCd ?? 0) - dt);
      const dx = playerPos.x - e.root.position.x;
      const dz = playerPos.z - e.root.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const navDir = navDirectionTowardPlayer(e.root.position.x, e.root.position.z);
      const directX = dx / dist;
      const directZ = dz / dist;
      const attackUrgency = THREE.MathUtils.clamp((12 - dist) / 12, 0, 1);
      /** Bias toward line-of-sight chase so hostiles reliably pressure the player; nav only assists around props. */
      const navWeight = navDir ? THREE.MathUtils.lerp(0.38, 0.1, attackUrgency) : 0;
      const directWeight = 1 - navWeight;
      let steerX = navDir ? navDir.x * navWeight + directX * directWeight : directX;
      let steerZ = navDir ? navDir.z * navWeight + directZ * directWeight : directZ;
      const sLen = Math.hypot(steerX, steerZ) || 1;
      steerX /= sLen;
      steerZ /= sLen;
      const sideX = -steerZ;
      const sideZ = steerX;
      const weave = Math.sin(now * 0.003 + e.phase * 1.7) * (1 - attackUrgency) * 0.07;
      steerX += sideX * weave;
      steerZ += sideZ * weave;
      const steerLen = Math.hypot(steerX, steerZ) || 1;
      steerX /= steerLen;
      steerZ /= steerLen;
      const aiK = 1 - Math.exp(-7.2 * dt);
      e.aiDirX = THREE.MathUtils.lerp(e.aiDirX ?? steerX, steerX, aiK);
      e.aiDirZ = THREE.MathUtils.lerp(e.aiDirZ ?? steerZ, steerZ, aiK);
      const aiLen = Math.hypot(e.aiDirX, e.aiDirZ) || 1;
      e.aiDirX /= aiLen;
      e.aiDirZ /= aiLen;
      const rad = e.collideRadius ?? ENEMY_COLLIDE_RADIUS;
      let sp = ENEMY_SPEED * (e.speedMul ?? 1);
      if (dist < 2.4) sp *= 1.16;
      if (
        e.canJump !== false &&
        playerPos.y > e.baseY + 0.28 &&
        dist < 8.5 &&
        e.jumpCd <= 0 &&
        e.velY <= 0.1
      ) {
        e.velY = JUMP_SPEED * 0.88;
        e.jumpCd = 1.65;
      }
      e.velY -= GRAVITY * dt;
      e.baseY += e.velY * dt;
      const targetYaw = Math.atan2(e.aiDirX, e.aiDirZ);
      const yawDelta = Math.atan2(
        Math.sin(targetYaw - e.root.rotation.y),
        Math.cos(targetYaw - e.root.rotation.y)
      );
      e.root.rotation.y += yawDelta * (1 - Math.exp(-8.4 * dt));
      const kx = e.kx ?? 0;
      const kz = e.kz ?? 0;
      const vx = e.aiDirX * sp + kx;
      const vz = e.aiDirZ * sp + kz;
      const sub = ENEMY_MOVE_SUBSTEPS;
      const h = dt / sub;
      for (let si = 0; si < sub; si++) {
        e.root.position.x += vx * h;
        e.root.position.z += vz * h;
        const er = resolveEntityXZ(e.root.position.x, e.root.position.z, rad, e.baseY);
        e.root.position.x = er.x;
        e.root.position.z = er.z;
      }
      e.kx = THREE.MathUtils.lerp(kx, 0, 1 - Math.exp(-5.8 * dt));
      e.kz = THREE.MathUtils.lerp(kz, 0, 1 - Math.exp(-5.8 * dt));
      const eSnap = snapFeetToSupport(e.root.position.x, e.root.position.z, rad, e.baseY, e.velY);
      e.baseY = eSnap.y;
      e.velY = eSnap.vy;
      const bob = e.bobAmp ?? 0.04;
      e.root.position.y = e.baseY + Math.sin(now * 0.005 + e.phase) * bob;

      if (e.flash > 0) {
        e.flash -= dt;
        if (e.flash <= 0 && e.matBases) {
          for (let i = 0; i < e.mats.length; i++) {
            const m = e.mats[i];
            const b = e.matBases[i];
            m.emissive.setHex(b.emissive);
            m.emissiveIntensity = b.intensity;
          }
        }
      }
    }
    }

    damageCooldown -= dt;
    if (!practiceMode) tryDamagePlayer();

    qGunBlend.copy(qGunHip).slerp(qGunAds, adsBlend);

    tmpSwayTarget.set(0, 0, 0);
    if (keys.has("KeyA")) tmpSwayTarget.x += GUN_SWAY_POS_MAX;
    if (keys.has("KeyD")) tmpSwayTarget.x -= GUN_SWAY_POS_MAX;
    if (keys.has("KeyW")) tmpSwayTarget.z += GUN_SWAY_POS_MAX * 0.42;
    if (keys.has("KeyS")) tmpSwayTarget.z -= GUN_SWAY_POS_MAX * 0.42;
    tmpSwayTarget.y = THREE.MathUtils.clamp(
      -playerVelY * GUN_SWAY_VY_SCALE,
      -GUN_SWAY_POS_MAX * 1.25,
      GUN_SWAY_POS_MAX * 1.4
    );

    const sk = 1 - Math.exp(-GUN_SWAY_SMOOTH * dt);
    gunSwayPos.lerp(tmpSwayTarget, sk);

    tmpRotTgt.set(
      tmpSwayTarget.z * 0.52 + gunSwayPos.y * 0.58,
      gunSwayPos.x * 0.44,
      -gunSwayPos.x * 1.12 - tmpSwayTarget.x * 0.14
    );
    tmpRotTgt.x = THREE.MathUtils.clamp(tmpRotTgt.x, -0.095, 0.095);
    tmpRotTgt.y = THREE.MathUtils.clamp(tmpRotTgt.y, -0.075, 0.075);
    tmpRotTgt.z = THREE.MathUtils.clamp(tmpRotTgt.z, -0.085, 0.085);
    gunSwayRot.lerp(tmpRotTgt, sk * 0.9);

    eulerSway.set(gunSwayRot.x, gunSwayRot.y, gunSwayRot.z);
    quatSway.setFromEuler(eulerSway);

    if (switchingWeapon && switchDuration > 0) {
      const ph = 1 - THREE.MathUtils.clamp(switchTimer / switchDuration, 0, 1);
      const dip = THREE.MathUtils.smoothstep(ph, 0, 0.42);
      const rise = THREE.MathUtils.smoothstep(ph, 0.42, 1);
      // Gun-Game style swap: quick drop out of view then snap back in.
      eulerReload.set(-dip * 1.08 + rise * 0.08, dip * 0.34 - rise * 0.2, -dip * 0.54 + rise * 0.16, "YXZ");
      quatReload.setFromEuler(eulerReload);
      switchPosOfs.set(dip * 0.24 - rise * 0.05, -dip * 0.39 + rise * 0.12, dip * 0.22 - rise * 0.08);
    } else if (
      reloading &&
      (activeWeapon === SLOT_PRIMARY || activeWeapon === SLOT_SECONDARY)
    ) {
      const w =
        activeWeapon === SLOT_PRIMARY ? getPrimaryDef() : getSecondaryDef();
      const ph = 1 - THREE.MathUtils.clamp(reloadTimer / w.reloadTime, 0, 1);
      const s = Math.sin(ph * Math.PI);
      const k = activeWeapon === SLOT_SECONDARY ? 0.76 : 1;
      const bolt = THREE.MathUtils.smoothstep(ph, 0.74, 0.95);
      eulerReload.set(
        -s * 0.41 * k + bolt * 0.24 * k,
        s * 0.12 * k * Math.cos(ph * Math.PI),
        -s * 0.068 * k,
        "YXZ"
      );
      quatReload.setFromEuler(eulerReload);
      reloadPosOfs.set(
        s * 0.058 * k,
        -s * 0.068 * k,
        s * 0.052 * k + bolt * 0.048 * k
      );
      switchPosOfs.set(0, 0, 0);
    } else if (medkitUseTimer > 0) {
      // Medkit uses a slower reload-like pose and settles back at end.
      const ph = 1 - THREE.MathUtils.clamp(medkitUseTimer / MEDKIT_USE_TIME, 0, 1);
      const s = Math.sin(ph * Math.PI);
      const settle = THREE.MathUtils.smoothstep(ph, 0.82, 1);
      eulerReload.set(
        -s * 0.34 + settle * 0.1,
        s * 0.08 * Math.cos(ph * Math.PI * 1.1),
        -s * 0.12,
        "YXZ"
      );
      quatReload.setFromEuler(eulerReload);
      reloadPosOfs.set(
        -s * 0.032,
        -s * 0.056,
        s * 0.078
      );
      switchPosOfs.set(0, 0, 0);
    } else {
      quatReload.identity();
      reloadPosOfs.set(0, 0, 0);
      switchPosOfs.set(0, 0, 0);
    }

    quatSwitch.identity();
    gunGroup.quaternion.copy(qGunBlend).multiply(quatSway).multiply(quatReload).multiply(quatSwitch);

    gunRecoilZ = THREE.MathUtils.lerp(gunRecoilZ, 0, 1 - Math.exp(-GUN_RECOIL_DECAY * dt));
    recoilPulseTimer = Math.max(0, recoilPulseTimer - dt);
    let recoilPulse = 0;
    if (recoilPulseTimer > 0) {
      const tPulse = 1 - recoilPulseTimer / RECOIL_PULSE_TIME;
      const env = Math.sin(THREE.MathUtils.smoothstep(tPulse, 0, 1) * Math.PI);
      recoilPulse = env * 0.038;
    }
    tmpGunBase.lerpVectors(GUN_HIP_POS, GUN_ADS_POS, adsBlend);
    gunGroup.position.copy(tmpGunBase).add(gunSwayPos).add(reloadPosOfs).add(switchPosOfs);
    gunGroup.position.z += gunRecoilZ + recoilPulse;
    gunGroup.visible = !showSniperScope && !practiceMode2 && !thirdPersonActive;

    utilityKitGroup.visible =
      !practiceMode2 &&
      !thirdPersonActive &&
      (activeWeapon === SLOT_UTILITY || medkitUseTimer > 0);
    if (utilityKitGroup.visible) {
      const utilDef = getUtilityDef();
      utilityGrenadeGroup.visible = activeWeapon === SLOT_UTILITY && utilDef.kind === "grenade";
      utilityMedkitGroup.visible = !utilityGrenadeGroup.visible || medkitUseTimer > 0;
      utilityKitGroup.position.copy(gunGroup.position);
      utilityKitGroup.quaternion.copy(gunGroup.quaternion);
      if (medkitUseTimer > 0) {
        const t = 1 - medkitUseTimer / MEDKIT_USE_TIME;
        const pulse = Math.sin(t * Math.PI * 10) * 0.012;
        utilityKitGroup.position.y += 0.02 + pulse;
        utilityKitGroup.position.z += 0.025;
      }
    }

    updateKnifeSwing(dt);
  } else {
    utilityKitGroup.visible = false;
  }

  if (!playing || health <= 0) {
    camShakeTime = 0;
    camShakeAmp = 0;
    camShakeJitter = 0;
    camShakePhase = 0;
    dashFovBlend = 0;
    if (Math.abs(camera.fov - CAMERA_FOV_HIP) > 0.02) {
      camera.fov = CAMERA_FOV_HIP;
      camera.updateProjectionMatrix();
    }
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t -= dt;
    tr.mesh.material.opacity = Math.max(0, tr.t / 0.09);
    if (tr.t <= 0) {
      scene.remove(tr.mesh);
      tr.geom.dispose();
      tr.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i];
    sp.t -= dt;
    sp.mesh.position.addScaledVector(sp.vel, dt);
    sp.mesh.material.opacity = Math.max(0, sp.t / 0.32);
    if (sp.t <= 0) {
      scene.remove(sp.mesh);
      sp.mesh.geometry.dispose();
      sp.mesh.material.dispose();
      sparks.splice(i, 1);
    }
  }

  if (skyShaderMaterial && skyFollowGroup) {
    skyFollowGroup.position.copy(yaw.position);
    camera.getWorldPosition(tmpEyeWorld);
    skyShaderMaterial.uniforms.uCamPos.value.copy(tmpEyeWorld);
    skyShaderMaterial.uniforms.uTime.value += dt;
  }

  composer.render();
}

for (const el of [loadoutPrimaryEl, loadoutSecondaryEl, loadoutMeleeEl, loadoutUtilityEl]) {
  el?.addEventListener("change", () => {
    readLoadoutFromMenu();
    refreshWeaponBarFromLoadout();
    syncLoadoutViewmodels();
  });
}

applyStoredLoadoutToMenu();
readLoadoutFromMenu();
refreshWeaponBarFromLoadout();
resetAmmoToLoadout();
syncLoadoutViewmodels();

syncCrosshairHudCssVars();
updateWeaponHud();
updateHealthHud();
updateAmmoHud();

weaponBarEl?.addEventListener("click", (e) => {
  const row = e.target.closest?.(".weapon-slot[data-slot]");
  if (!row || !weaponBarEl.classList.contains("allow-touch")) return;
  e.preventDefault();
  switchWeapon(Number(row.dataset.slot));
});

function initMobileControls() {
  const zone = document.getElementById("mobile-joystick");
  const stick = document.getElementById("mobile-joystick-stick");
  const fireBtn = document.getElementById("mobile-btn-fire");
  const aimBtn = document.getElementById("mobile-btn-aim");
  if (!zone || !stick) return;

  const maxDist = 44;
  let originX = 0;
  let originY = 0;

  function applyStick(clientX, clientY) {
    const dx = clientX - originX;
    const dy = clientY - originY;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(len, maxDist) / len;
    const kx = dx * t;
    const ky = dy * t;
    stick.style.transform = `translate(${kx}px, ${ky}px)`;
    mobileStrafe = kx / maxDist;
    mobileFwd = -ky / maxDist;
  }

  zone.addEventListener("pointerdown", (e) => {
    if (!useMobileFriendlyUi() || !playing) return;
    e.preventDefault();
    const r = zone.getBoundingClientRect();
    originX = r.left + r.width / 2;
    originY = r.top + r.height / 2;
    mobileJoyPointerId = e.pointerId;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    applyStick(e.clientX, e.clientY);
  });

  zone.addEventListener("pointermove", (e) => {
    if (mobileJoyPointerId == null || e.pointerId !== mobileJoyPointerId) return;
    applyStick(e.clientX, e.clientY);
  });

  function endJoy(e) {
    if (mobileJoyPointerId == null || e.pointerId !== mobileJoyPointerId) return;
    mobileJoyPointerId = null;
    try {
      zone.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    mobileFwd = 0;
    mobileStrafe = 0;
    stick.style.transform = "translate(0, 0)";
  }

  zone.addEventListener("pointerup", endJoy);
  zone.addEventListener("pointercancel", endJoy);

  fireBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mobileFireHeld = true;
    try {
      fireBtn.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  fireBtn?.addEventListener("pointerup", (e) => {
    mobileFireHeld = false;
    try {
      fireBtn.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  fireBtn?.addEventListener("pointercancel", () => {
    mobileFireHeld = false;
  });

  aimBtn?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    mobileAdsHeld = true;
    try {
      aimBtn.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  aimBtn?.addEventListener("pointerup", (e) => {
    mobileAdsHeld = false;
    try {
      aimBtn.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  });
  aimBtn?.addEventListener("pointercancel", () => {
    mobileAdsHeld = false;
  });
}

initMobileControls();

document.getElementById("input-layout-mobile-btn")?.addEventListener("click", () =>
  setInputLayoutMobile(true)
);
document.getElementById("input-layout-desktop-btn")?.addEventListener("click", () =>
  setInputLayoutMobile(false)
);
document.getElementById("menu-open-input-layout")?.addEventListener("click", () =>
  openInputLayoutChoiceModal()
);

updateInputLayoutModalVisibility();
syncStartButtonForLayout();
syncInputLayoutMenuLabel();

tick();
