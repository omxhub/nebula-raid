import { useEffect, useRef, useState } from 'react';
import './App.css';
import { SHIPS, UPGRADES, SECTORS, MEDAL_META, getUpgradeCost } from './gameData.js';
import {
  renderEnvironment,
  renderClouds,
  renderPlayer,
  renderEnemy,
  renderBoss,
  renderProjectilesAndFX,
} from './renderer.js';
import { sfx } from './sound.js';

const W = 480;
const H = 760;

const STORAGE_KEYS = {
  stars: 'nebulaStars_v2',
  legacyStars: 'nebulaStars',
  upgrades: 'nebulaUpgrades_v2',
  medals: 'nebulaMedals_v2',
  unlockedShips: 'nebulaShips_v2',
  selectedShip: 'nebulaSelectedShip_v2',
  highScore: 'nebulaHighScore_v2',
};

function loadStars() {
  try {
    const v2 = localStorage.getItem(STORAGE_KEYS.stars);
    if (v2 !== null) return parseInt(v2, 10) || 0;
    const leg = localStorage.getItem(STORAGE_KEYS.legacyStars);
    return parseInt(leg || '140', 10) || 140;
  } catch {
    return 140;
  }
}

function saveStars(n) {
  try {
    localStorage.setItem(STORAGE_KEYS.stars, String(Math.max(0, Math.floor(n))));
  } catch {
    // ignore storage errors
  }
}

function loadUpgrades() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.upgrades) || '{}');
  } catch {
    return {};
  }
}

function saveUpgrades(u) {
  try {
    localStorage.setItem(STORAGE_KEYS.upgrades, JSON.stringify(u));
  } catch {
    // ignore
  }
}

function loadMedals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.medals) || '{}');
  } catch {
    return {};
  }
}

function saveMedals(m) {
  try {
    localStorage.setItem(STORAGE_KEYS.medals, JSON.stringify(m));
  } catch {
    // ignore
  }
}

function loadUnlockedShips() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.unlockedShips) || '["valkyrie"]');
    return Array.isArray(arr) && arr.length ? arr : ['valkyrie'];
  } catch {
    return ['valkyrie'];
  }
}

function saveUnlockedShips(arr) {
  try {
    localStorage.setItem(STORAGE_KEYS.unlockedShips, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function createMissionState(sector, ship, upgrades) {
  const cannonLvl = upgrades.mainCannon || 0;
  const wingLvl = upgrades.wingCannons || 0;
  const shieldLvl = upgrades.hullShield || 0;
  const magnetLvl = upgrades.starMagnet || 0;
  const overdriveLvl = upgrades.overdrive || 0;

  const maxHp = 100 + shieldLvl * 30 + ship.hpBonus;
  const maxShield = shieldLvl * 20;

  return {
    state: 'playing',
    sector,
    ship,
    player: {
      x: W / 2,
      y: H - 105,
      r: 17,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      shieldRegenDelay: 0,
      cannonLvl,
      wingLevel: wingLvl,
      magnetRadius: 78 + magnetLvl * 42,
      starValueMult: (1 + magnetLvl * 0.12) * sector.starMultiplier,
      fireCd: 0,
      wingCd: 0,
      fireInterval: Math.max(0.085, (0.19 - cannonLvl * 0.015) / ship.fireRateMult),
      dmg: (10 + cannonLvl * 3.8) * ship.dmgMult,
      speed: 360 * ship.speedMult,
      bank: 0,
      invuln: 0,
      unscathed: true,
    },
    overdrive: {
      charge: 100,
      maxCharge: 100,
      chargeRate: 100 / Math.max(8, 18 - overdriveLvl * 2),
      dmg: 140 + overdriveLvl * 55,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    stars: [],
    particles: [],
    shockwaves: [],
    floatTexts: [],
    score: 0,
    runStars: 0,
    starsSpawned: 0,
    starsCollected: 0,
    enemiesSpawned: 0,
    enemiesDestroyed: 0,
    combo: 0,
    comboTimer: 0,
    wave: 0,
    maxWaves: sector.waves,
    waveTimer: 1.5,
    bossWarningTimer: 0,
    boss: null,
    bossSpawned: false,
    bossDefeated: false,
    keys: {},
    pointer: { x: W / 2, y: H - 105, active: false },
    time: 0,
    shake: 0,
  };
}

function NebulaLogo() {
  return (
    <svg className="nr-logo-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nrShieldGrad" x1="15" y1="10" x2="105" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="nrWingGrad" x1="20" y1="30" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* Outer Octagonal Tactical Crest */}
      <polygon
        points="60,6 102,24 114,66 92,106 60,116 28,106 6,66 18,24"
        fill="url(#nrShieldGrad)"
        fillOpacity="0.22"
        stroke="#38bdf8"
        strokeWidth="2.5"
      />
      {/* Swept Wing Chevron */}
      <polygon
        points="60,18 104,58 92,76 68,62 60,98 52,62 28,76 16,58"
        fill="url(#nrWingGrad)"
      />
      {/* Core Star Emblem */}
      <polygon
        points="60,34 65,48 80,52 65,56 60,72 55,56 40,52 55,48"
        fill="#facc15"
      />
    </svg>
  );
}

export default function Game() {
  const canvasRef = useRef(null);
  const ambientRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);

  const [screen, setScreen] = useState('menu'); // 'menu' | 'hangar' | 'playing' | 'debrief'
  const [selectedSectorId, setSelectedSectorId] = useState(1);
  const [selectedShipId, setSelectedShipId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.selectedShip) || 'valkyrie';
    } catch {
      return 'valkyrie';
    }
  });
  const [unlockedShips, setUnlockedShips] = useState(loadUnlockedShips);
  const [upgrades, setUpgrades] = useState(loadUpgrades);
  const [stars, setStars] = useState(loadStars);
  const [medals, setMedals] = useState(loadMedals);
  const [muted, setMuted] = useState(() => sfx.muted);

  const [hudState, setHudState] = useState({
    hp: 100,
    maxHp: 100,
    shield: 0,
    maxShield: 0,
    score: 0,
    runStars: 0,
    wave: 1,
    maxWaves: 6,
    combo: 0,
    overdrive: 100,
    bossWarning: false,
    bossHp: 0,
    bossMaxHp: 0,
    bossName: '',
  });

  const [debrief, setDebrief] = useState(null);

  const activeSector = SECTORS.find((s) => s.id === selectedSectorId) || SECTORS[0];
  const activeShip = SHIPS.find((s) => s.id === selectedShipId) || SHIPS[0];

  // Ambient animated background for Menu / Hangar / Debrief screens
  useEffect(() => {
    if (screen === 'playing') return;
    const canvas = ambientRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    let animId;
    const startT = performance.now();

    const renderLoop = (now) => {
      const t = (now - startT) / 1000;
      renderEnvironment(ctx, W, H, t * 0.65, activeSector);
      renderClouds(ctx, W, H, t * 0.65, activeSector);

      // Gentle flyby preview of selected ship in menu/hangar
      const previewPlayer = {
        x: W / 2 + Math.sin(t * 1.4) * 42,
        y: H * 0.42 + Math.cos(t * 1.1) * 14,
        bank: Math.cos(t * 1.4) * 0.65,
        wingLevel: upgrades.wingCannons || 0,
        magnetRadius: 0,
        shield: (upgrades.hullShield || 0) * 20,
        maxShield: Math.max(20, (upgrades.hullShield || 0) * 20),
        invuln: 0,
      };
      renderPlayer(ctx, previewPlayer, activeShip, t);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [screen, activeSector, activeShip, upgrades]);

  const startMission = (sectorOverride) => {
    sfx.init();
    const sec = sectorOverride || activeSector;
    const mState = createMissionState(sec, activeShip, upgrades);
    gameRef.current = mState;
    if (typeof window !== 'undefined') window.__nebulaGame = mState;
    setScreen('playing');
  };

  const triggerOverdrive = () => {
    const g = gameRef.current;
    if (!g || g.state !== 'playing' || g.overdrive.charge < 100) return;
    g.overdrive.charge = 0;
    g.shake = 14;
    sfx.playExplosion(1.6);

    // Massive expanding NOVA EMP ring
    g.shockwaves.push({
      x: g.player.x,
      y: g.player.y,
      r: 16,
      maxR: 480,
      speed: 780,
      alpha: 1,
      color: '#38bdf8',
      lineWidth: 6,
    });
    g.shockwaves.push({
      x: g.player.x,
      y: g.player.y,
      r: 8,
      maxR: 420,
      speed: 620,
      alpha: 0.9,
      color: '#f43f5e',
      lineWidth: 4,
    });

    // Clear all enemy bullets on screen
    g.enemyBullets = [];

    // Deal heavy EMP thermal damage to all active enemies & boss parts
    const odDmg = g.overdrive.dmg;
    g.enemies.forEach((e) => {
      e.hp -= odDmg;
      e.hitFlash = 0.2;
    });
    if (g.boss) {
      g.boss.parts.forEach((pt) => {
        if (pt.hp > 0) {
          pt.hp -= odDmg * 0.65;
          pt.hitFlash = 0.2;
        }
      });
    }
    g.floatTexts.push({
      x: g.player.x,
      y: g.player.y - 36,
      text: 'NOVA EMP SURGE!',
      color: '#38bdf8',
      life: 1.1,
    });
  };

  // Main 60fps Gameplay Loop
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = gameRef.current;
    let last = performance.now();
    let hudSyncTimer = 0;

    const addExplosion = (x, y, scale = 1, baseColor = '#fb923c') => {
      sfx.playExplosion(scale);
      g.shockwaves.push({
        x,
        y,
        r: 6,
        maxR: 42 * scale,
        speed: 210 * scale,
        alpha: 0.95,
        color: baseColor,
        lineWidth: 3 * scale,
      });

      const sparkCount = Math.floor(14 * scale);
      for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = (60 + Math.random() * 190) * Math.sqrt(scale);
        const life = 0.35 + Math.random() * 0.35;
        g.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life,
          maxLife: life,
          size: 3 + Math.random() * 4 * scale,
          color: i % 3 === 0 ? '#fef08a' : i % 2 === 0 ? baseColor : '#ef4444',
          kind: i % 2 === 0 ? 'spark' : 'fire',
        });
      }

      const smokeCount = Math.floor(6 * scale);
      for (let i = 0; i < smokeCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 55;
        const life = 0.55 + Math.random() * 0.4;
        g.particles.push({
          x,
          y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life,
          maxLife: life,
          size: 8 + Math.random() * 8 * scale,
          color: 'rgba(148, 163, 184, 0.38)',
          kind: 'smoke',
        });
      }
    };

    const dropStars = (x, y, count) => {
      g.starsSpawned += count;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spread = Math.random() * 24;
        g.stars.push({
          x: x + Math.cos(a) * spread,
          y: y + Math.sin(a) * spread,
          vx: (Math.random() - 0.5) * 45,
          vy: 52 + Math.random() * 35,
          phase: Math.random() * Math.PI * 2,
          collected: false,
        });
      }
    };

    const spawnWave = () => {
      g.wave++;
      const w = g.wave;
      const secMult = 1 + (g.sector.id - 1) * 0.38;

      // Pattern 1: V-Formation of Crimson Dart Scouts
      const scoutCount = 5 + (w % 2);
      const centerX = 110 + Math.random() * (W - 220);
      for (let i = 0; i < scoutCount; i++) {
        const offset = i - Math.floor(scoutCount / 2);
        const hp = Math.round(18 * secMult);
        g.enemies.push({
          type: 'scout',
          x: Math.max(36, Math.min(W - 36, centerX + offset * 38)),
          y: -35 - Math.abs(offset) * 32,
          vx: 0,
          speed: 145 + w * 6,
          hp,
          maxHp: hp,
          w: 32,
          shootCd: 1.4 + Math.random() * 1.1,
          zig: i * 0.6,
          hitFlash: 0,
        });
        g.enemiesSpawned++;
      }

      // Pattern 2: Deck-mounted Rotating AA Turrets (Every wave)
      if (w >= 1) {
        const turretCount = w >= 3 ? 2 : 1;
        for (let t = 0; t < turretCount; t++) {
          const tx = t === 0 ? 74 + Math.random() * 60 : W - 74 - Math.random() * 60;
          const hp = Math.round(48 * secMult);
          g.enemies.push({
            type: 'turret',
            x: tx,
            y: -45 - t * 85,
            vx: 0,
            speed: 58, // scrolls with lower deck speed
            hp,
            maxHp: hp,
            w: 38,
            shootCd: 1.2 + t * 0.5,
            zig: 0,
            hitFlash: 0,
          });
          g.enemiesSpawned++;
        }
      }

      // Pattern 3: Mid-level Raptor Gunships (Every wave)
      if (w >= 1) {
        const gunCount = w >= 4 ? 3 : 2;
        for (let j = 0; j < gunCount; j++) {
          const hp = Math.round(62 * secMult);
          g.enemies.push({
            type: 'gunship',
            x: 85 + j * ((W - 170) / Math.max(1, gunCount - 1)),
            y: -115 - j * 50,
            vx: 0,
            speed: 88,
            hp,
            maxHp: hp,
            w: 46,
            shootCd: 1.3 + j * 0.4,
            zig: j * 1.5,
            hitFlash: 0,
          });
          g.enemiesSpawned++;
        }
      }

      // Pattern 4: Heavy Aerial Frigate (Wave 4+)
      if (w >= 4) {
        const hp = Math.round(135 * secMult);
        g.enemies.push({
          type: 'heavy',
          x: W / 2 + (Math.random() - 0.5) * 110,
          y: -210,
          vx: 0,
          speed: 62,
          hp,
          maxHp: hp,
          w: 62,
          shootCd: 1.5,
          zig: 0,
          hitFlash: 0,
        });
        g.enemiesSpawned++;
      }
    };

    const spawnBoss = () => {
      g.bossSpawned = true;
      const baseHp = g.sector.bossHp;
      const wingHp = Math.round(baseHp * 0.28);
      const coreHp = Math.round(baseHp * 0.44);
      g.boss = {
        name: g.sector.bossName,
        x: W / 2,
        y: -95,
        targetY: 132,
        dir: 1,
        t: 0,
        hitFlash: 0,
        parts: [
          {
            id: 'leftWing',
            name: 'PORT BATTERY',
            offsetX: -72,
            offsetY: 8,
            r: 22,
            hp: wingHp,
            maxHp: wingHp,
            shootCd: 1.1,
            hitFlash: 0,
          },
          {
            id: 'rightWing',
            name: 'STARBOARD BATTERY',
            offsetX: 72,
            offsetY: 8,
            r: 22,
            hp: wingHp,
            maxHp: wingHp,
            shootCd: 1.4,
            hitFlash: 0,
          },
          {
            id: 'core',
            name: 'OMEGA REACTOR',
            offsetX: 0,
            offsetY: 16,
            r: 26,
            hp: coreHp,
            maxHp: coreHp,
            shootCd: 1.8,
            hitFlash: 0,
          },
        ],
      };
      g.enemiesSpawned += 3;
    };

    const finishMission = (victory) => {
      if (g.state !== 'playing') return;
      g.state = victory ? 'won' : 'dead';

      const earnedStars = Math.round(g.runStars * g.player.starValueMult);
      const newTotalStars = loadStars() + earnedStars;
      saveStars(newTotalStars);
      setStars(newTotalStars);

      // Evaluate 4 Sky Force-style Sector Medals
      const killRatio = g.enemiesSpawned > 0 ? g.enemiesDestroyed / g.enemiesSpawned : 0;
      const starRatio = g.starsSpawned > 0 ? g.starsCollected / g.starsSpawned : 0;

      const runMedals = {
        clear: killRatio >= 0.85,
        stars: starRatio >= 0.8,
        unscathed: victory && g.player.unscathed,
        boss: victory && g.bossDefeated,
      };

      const allMedals = loadMedals();
      const prevSec = allMedals[g.sector.id] || {};
      allMedals[g.sector.id] = {
        clear: Boolean(prevSec.clear || runMedals.clear),
        stars: Boolean(prevSec.stars || runMedals.stars),
        unscathed: Boolean(prevSec.unscathed || runMedals.unscathed),
        boss: Boolean(prevSec.boss || runMedals.boss),
      };
      saveMedals(allMedals);
      setMedals(allMedals);

      setDebrief({
        victory,
        sector: g.sector,
        score: g.score,
        earnedStars,
        killPct: Math.min(100, Math.round(killRatio * 100)),
        starPct: Math.min(100, Math.round(starRatio * 100)),
        unscathed: g.player.unscathed,
        bossDefeated: g.bossDefeated,
        runMedals,
      });

      setTimeout(() => {
        setScreen('debrief');
      }, victory ? 1350 : 900);
    };

    const damagePlayer = (amount) => {
      const p = g.player;
      if (p.invuln > 0 || g.state !== 'playing') return;
      p.invuln = 0.65;
      p.shieldRegenDelay = 4.5;
      g.shake = 10;
      sfx.playHit();

      if (p.shield > 0) {
        const absorbed = Math.min(p.shield, amount);
        p.shield -= absorbed;
        const rem = amount - absorbed;
        if (rem > 0) {
          p.hp -= rem;
          p.unscathed = false;
        }
      } else {
        p.hp -= amount;
        p.unscathed = false;
      }

      addExplosion(p.x, p.y, 0.75, '#38bdf8');
      if (p.hp <= 0) {
        p.hp = 0;
        addExplosion(p.x, p.y, 2.2, '#ef4444');
        finishMission(false);
      }
    };

    const firePlayerWeapons = () => {
      const p = g.player;
      const lvl = p.cannonLvl;
      const color = g.ship.primaryColor;
      sfx.playLaser(lvl);

      // Multi-barrel progression inspired by Sky Force main cannon tiers
      if (lvl === 0) {
        g.bullets.push({ x: p.x - 6, y: p.y - 18, vx: 0, vy: -680, w: 4, dmg: p.dmg * 0.55, color });
        g.bullets.push({ x: p.x + 6, y: p.y - 18, vx: 0, vy: -680, w: 4, dmg: p.dmg * 0.55, color });
      } else if (lvl <= 2) {
        g.bullets.push({ x: p.x, y: p.y - 24, vx: 0, vy: -720, w: 5.5, dmg: p.dmg * 0.65, color });
        g.bullets.push({ x: p.x - 11, y: p.y - 14, vx: -25, vy: -690, w: 4, dmg: p.dmg * 0.4, color });
        g.bullets.push({ x: p.x + 11, y: p.y - 14, vx: 25, vy: -690, w: 4, dmg: p.dmg * 0.4, color });
      } else {
        // Heavy quad/penta plasma stream
        g.bullets.push({ x: p.x - 5, y: p.y - 24, vx: 0, vy: -760, w: 5.5, dmg: p.dmg * 0.5, color });
        g.bullets.push({ x: p.x + 5, y: p.y - 24, vx: 0, vy: -760, w: 5.5, dmg: p.dmg * 0.5, color });
        g.bullets.push({ x: p.x - 16, y: p.y - 14, vx: -55, vy: -720, w: 4.5, dmg: p.dmg * 0.38, color });
        g.bullets.push({ x: p.x + 16, y: p.y - 14, vx: 55, vy: -720, w: 4.5, dmg: p.dmg * 0.38, color });
        if (lvl >= 5) {
          g.bullets.push({ x: p.x - 24, y: p.y - 8, vx: -115, vy: -690, w: 4, dmg: p.dmg * 0.32, color });
          g.bullets.push({ x: p.x + 24, y: p.y - 8, vx: 115, vy: -690, w: 4, dmg: p.dmg * 0.32, color });
        }
      }
    };

    const fireWingPods = () => {
      const p = g.player;
      if (p.wingLevel <= 0) return;
      sfx.playMissile();
      const podDmg = p.dmg * (0.65 + p.wingLevel * 0.22);
      [-24, 24].forEach((offsetX) => {
        // Find nearest target to angle toward
        let vx = offsetX * 1.8;
        let vy = -540;
        const target = g.enemies[0] || (g.boss ? { x: g.boss.x, y: g.boss.y } : null);
        if (target) {
          const dx = target.x - (p.x + offsetX);
          const dy = target.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          vx = (dx / len) * 560;
          vy = (dy / len) * 560;
        }
        g.bullets.push({
          x: p.x + offsetX,
          y: p.y - 6,
          vx,
          vy,
          w: 6,
          dmg: podDmg,
          color: '#f59e0b',
        });
      });
    };

    const update = (dt) => {
      g.time += dt;
      const p = g.player;

      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (g.comboTimer > 0) {
        g.comboTimer -= dt;
        if (g.comboTimer <= 0) g.combo = 0;
      }

      // Shield recharge after delay
      if (p.maxShield > 0 && p.shield < p.maxShield) {
        if (p.shieldRegenDelay > 0) {
          p.shieldRegenDelay -= dt;
        } else {
          p.shield = Math.min(p.maxShield, p.shield + dt * 8);
        }
      }

      // Overdrive passive charge
      if (g.overdrive.charge < 100) {
        g.overdrive.charge = Math.min(100, g.overdrive.charge + g.overdrive.chargeRate * dt);
      }

      // Player steering & smooth banking physics
      if (g.state === 'playing') {
        let prevX = p.x;
        if (g.pointer.active) {
          p.x += (g.pointer.x - p.x) * Math.min(1, dt * 14);
          p.y += (g.pointer.y - p.y) * Math.min(1, dt * 14);
        }
        let kx = 0;
        let ky = 0;
        if (g.keys.ArrowLeft || g.keys.a || g.keys.A) kx -= 1;
        if (g.keys.ArrowRight || g.keys.d || g.keys.D) kx += 1;
        if (g.keys.ArrowUp || g.keys.w || g.keys.W) ky -= 1;
        if (g.keys.ArrowDown || g.keys.s || g.keys.S) ky += 1;
        if (kx !== 0 || ky !== 0) {
          g.pointer.active = false;
          const norm = Math.hypot(kx, ky) || 1;
          p.x += (kx / norm) * p.speed * dt;
          p.y += (ky / norm) * p.speed * dt;
        }

        p.x = Math.max(26, Math.min(W - 26, p.x));
        p.y = Math.max(46, Math.min(H - 36, p.y));

        const targetBank = Math.max(-1, Math.min(1, (p.x - prevX) / (dt * 240 || 1)));
        p.bank += (targetBank - p.bank) * Math.min(1, dt * 10);

        // Spacebar or E triggers Overdrive EMP
        if ((g.keys[' '] || g.keys.e || g.keys.E) && g.overdrive.charge >= 100) {
          triggerOverdrive();
        }

        // Auto-fire primary cannon & wing pods
        p.fireCd -= dt;
        if (p.fireCd <= 0) {
          p.fireCd = p.fireInterval;
          firePlayerWeapons();
        }
        if (p.wingLevel > 0) {
          p.wingCd -= dt;
          if (p.wingCd <= 0) {
            p.wingCd = Math.max(0.42, 0.95 - p.wingLevel * 0.09);
            fireWingPods();
          }
        }
      }

      // Wave & Boss Pacing Director
      if (g.forceSpawnBoss && !g.bossSpawned) {
        g.forceSpawnBoss = false;
        g.enemies = [];
        spawnBoss();
      } else if (g.state === 'playing' && !g.bossSpawned) {
        g.waveTimer -= dt;
        if (g.wave < g.maxWaves && (g.waveTimer <= 0 || (g.wave > 0 && g.enemies.length === 0))) {
          g.waveTimer = 6.2;
          spawnWave();
        } else if (g.wave >= g.maxWaves && g.enemies.length === 0) {
          if (g.bossWarningTimer === 0) {
            g.bossWarningTimer = 2.4;
            sfx.playWarning();
          } else {
            g.bossWarningTimer -= dt;
            if (g.bossWarningTimer <= 0) {
              g.bossWarningTimer = 0;
              spawnBoss();
            }
          }
        }
      }

      // Update player bullets
      for (const b of g.bullets) {
        b.x += (b.vx || 0) * dt;
        b.y += b.vy * dt;
      }
      g.bullets = g.bullets.filter((b) => b.y > -30 && b.x > -30 && b.x < W + 30);

      // Update enemy bullets
      for (const b of g.enemyBullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      g.enemyBullets = g.enemyBullets.filter((b) => b.y < H + 30 && b.y > -30 && b.x > -30 && b.x < W + 30);

      // Update enemies
      for (const e of g.enemies) {
        if (e.hitFlash > 0) e.hitFlash -= dt;
        e.y += e.speed * dt;

        if (e.type === 'scout') {
          e.vx = Math.sin(g.time * 3.4 + e.zig) * 75;
          e.x += e.vx * dt;
        } else if (e.type === 'gunship') {
          e.vx = Math.cos(g.time * 2.1 + e.zig) * 65;
          e.x += e.vx * dt;
        } else if (e.type === 'heavy') {
          e.vx = Math.sin(g.time * 1.2) * 42;
          e.x += e.vx * dt;
        }
        e.x = Math.max(30, Math.min(W - 30, e.x));

        e.shootCd -= dt;
        if (e.shootCd <= 0 && e.y > 20 && e.y < H - 90) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          if (e.type === 'scout') {
            e.shootCd = 2.1;
            g.enemyBullets.push({ x: e.x, y: e.y + 14, vx: 0, vy: 270, r: 4.5, color: '#fb7185' });
          } else if (e.type === 'turret') {
            e.shootCd = 1.65;
            const spd = 250;
            g.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * spd, vy: (dy / len) * spd, r: 5.5, color: '#f97316' });
          } else if (e.type === 'gunship') {
            e.shootCd = 1.75;
            const baseAngle = Math.atan2(dy, dx);
            [-0.16, 0.16].forEach((ang) => {
              g.enemyBullets.push({
                x: e.x,
                y: e.y + 16,
                vx: Math.cos(baseAngle + ang) * 265,
                vy: Math.sin(baseAngle + ang) * 265,
                r: 5,
                color: '#fb7185',
              });
            });
          } else if (e.type === 'heavy') {
            e.shootCd = 1.9;
            for (let k = -2; k <= 2; k++) {
              const a = Math.PI / 2 + k * 0.24;
              g.enemyBullets.push({
                x: e.x,
                y: e.y + 22,
                vx: Math.cos(a) * 245,
                vy: Math.sin(a) * 245,
                r: 6,
                color: '#ef4444',
              });
            }
          }
        }
      }

      // Bullet vs Enemy collisions
      for (const b of g.bullets) {
        if (b.dead) continue;
        for (const e of g.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.w * 0.52 + 5) {
            e.hp -= b.dmg;
            e.hitFlash = 0.08;
            b.dead = true;
            g.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 90,
              vy: (Math.random() - 0.5) * 90,
              life: 0.18,
              maxLife: 0.18,
              size: 3.5,
              color: '#bae6fd',
              kind: 'spark',
            });
            break;
          }
        }
      }
      g.bullets = g.bullets.filter((b) => !b.dead);

      // Process destroyed enemies
      for (const e of g.enemies) {
        if (e.hp <= 0 && !e.counted) {
          e.counted = true;
          g.enemiesDestroyed++;
          g.combo++;
          g.comboTimer = 3.2;
          const mult = 1 + Math.min(5, Math.floor(g.combo / 4)) * 0.25;
          const pts = Math.round((e.type === 'scout' ? 35 : e.type === 'turret' ? 65 : e.type === 'gunship' ? 90 : 180) * mult);
          g.score += pts;

          const starDrops = e.type === 'scout' ? 1 : e.type === 'turret' ? 2 : e.type === 'gunship' ? 3 : 6;
          dropStars(e.x, e.y, starDrops);
          addExplosion(e.x, e.y, e.type === 'heavy' ? 1.55 : e.type === 'scout' ? 0.85 : 1.15);

          if (e.type === 'heavy' || e.type === 'turret') {
            g.floatTexts.push({
              x: e.x,
              y: e.y - 10,
              text: e.type === 'turret' ? 'AA SILENCED +65' : 'FRIGATE DOWN!',
              color: '#fef08a',
              life: 0.85,
            });
          }
        }
      }
      g.enemies = g.enemies.filter((e) => e.y < H + 70 && e.hp > 0);

      // Update Multi-Part Boss Dreadnought
      if (g.boss) {
        const boss = g.boss;
        boss.t += dt;
        if (boss.hitFlash > 0) boss.hitFlash -= dt;

        if (boss.y < boss.targetY) {
          boss.y = Math.min(boss.targetY, boss.y + 72 * dt);
        } else {
          boss.x += boss.dir * 68 * dt;
          if (boss.x < 125) {
            boss.x = 125;
            boss.dir = 1;
          } else if (boss.x > W - 125) {
            boss.x = W - 125;
            boss.dir = -1;
          }
        }

        let aliveParts = 0;
        boss.parts.forEach((part) => {
          if (part.hitFlash > 0) part.hitFlash -= dt;
          if (part.hp <= 0) return;
          aliveParts++;

          const wx = boss.x + part.offsetX;
          const wy = boss.y + part.offsetY;

          // Boss subsystem firing patterns
          part.shootCd -= dt;
          if (part.shootCd <= 0 && boss.y >= boss.targetY - 10) {
            if (part.id === 'core') {
              part.shootCd = 1.65;
              const spreadCount = 7;
              for (let i = 0; i < spreadCount; i++) {
                const a = Math.PI * 0.22 + (i / (spreadCount - 1)) * Math.PI * 0.56 + Math.sin(boss.t * 2) * 0.12;
                g.enemyBullets.push({
                  x: wx,
                  y: wy + 12,
                  vx: Math.cos(a) * 240,
                  vy: Math.sin(a) * 240,
                  r: 6,
                  color: '#38bdf8',
                });
              }
            } else {
              part.shootCd = 1.35;
              const aim = Math.atan2(p.y - wy, p.x - wx);
              [-0.1, 0.1].forEach((da) => {
                g.enemyBullets.push({
                  x: wx,
                  y: wy + 14,
                  vx: Math.cos(aim + da) * 275,
                  vy: Math.sin(aim + da) * 275,
                  r: 5,
                  color: '#f43f5e',
                });
              });
            }
          }

          // Bullet hits on boss subsystem
          for (const b of g.bullets) {
            if (b.dead) continue;
            if (Math.hypot(b.x - wx, b.y - wy) < part.r + 6) {
              part.hp -= b.dmg;
              part.hitFlash = 0.08;
              b.dead = true;
              if (part.hp <= 0) {
                part.hp = 0;
                g.enemiesDestroyed++;
                g.score += 450;
                g.shake = 12;
                dropStars(wx, wy, 10);
                addExplosion(wx, wy, 1.8, '#f59e0b');
                g.floatTexts.push({
                  x: wx,
                  y: wy,
                  text: `${part.name} DESTROYED!`,
                  color: '#facc15',
                  life: 1.2,
                });
              }
            }
          }
        });

        g.bullets = g.bullets.filter((b) => !b.dead);

        if (aliveParts === 0) {
          g.score += 1500 * g.sector.id;
          g.bossDefeated = true;
          g.shake = 20;
          dropStars(boss.x, boss.y, 22);
          addExplosion(boss.x, boss.y, 2.8, '#fb7185');
          addExplosion(boss.x - 55, boss.y - 20, 1.8, '#f59e0b');
          addExplosion(boss.x + 55, boss.y + 20, 1.8, '#38bdf8');
          g.boss = null;
          finishMission(true);
        }
      }

      // Collectible Nebula Cores (Stars) with magnetic tractor pull
      for (const s of g.stars) {
        const dist = Math.hypot(p.x - s.x, p.y - s.y);
        if (dist < p.magnetRadius && g.state === 'playing') {
          const pull = (1 - dist / p.magnetRadius) * 580 + 180;
          const dx = (p.x - s.x) / (dist || 1);
          const dy = (p.y - s.y) / (dist || 1);
          s.x += dx * pull * dt;
          s.y += dy * pull * dt;
        } else {
          s.x += (s.vx || 0) * dt;
          s.y += s.vy * dt;
          s.vx *= 0.96;
        }

        if (!s.collected && dist < p.r + 12) {
          s.collected = true;
          g.runStars++;
          g.starsCollected++;
          g.score += 15;
          sfx.playStar(g.combo);
        }
      }
      g.stars = g.stars.filter((s) => !s.collected && s.y < H + 30);

      // Enemy bullets & hull collisions with player
      if (g.state === 'playing') {
        for (const b of g.enemyBullets) {
          if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + (b.r || 5) - 2) {
            b.y = H + 200;
            damagePlayer(24);
          }
        }
        for (const e of g.enemies) {
          if (e.type !== 'turret' && Math.hypot(e.x - p.x, e.y - p.y) < e.w * 0.45 + p.r - 2) {
            e.hp = 0;
            addExplosion(e.x, e.y, 1.1);
            damagePlayer(34);
          }
        }
      }

      // Update shockwaves, particles, and floating callouts
      for (const ring of g.shockwaves) {
        ring.r += ring.speed * dt;
        ring.alpha = Math.max(0, 1 - ring.r / ring.maxR);
      }
      g.shockwaves = g.shockwaves.filter((r) => r.alpha > 0.02);

      for (const pt of g.particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.life -= dt;
      }
      g.particles = g.particles.filter((pt) => pt.life > 0);

      for (const ft of g.floatTexts) {
        ft.y -= 28 * dt;
        ft.life -= dt;
      }
      g.floatTexts = g.floatTexts.filter((ft) => ft.life > 0);

      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 28);

      // Throttle React HUD state updates to ~15fps so canvas stays 60fps locked
      hudSyncTimer += dt;
      if (hudSyncTimer >= 0.065) {
        hudSyncTimer = 0;
        let bossHp = 0;
        let bossMaxHp = 0;
        if (g.boss) {
          g.boss.parts.forEach((pt) => {
            bossHp += Math.max(0, pt.hp);
            bossMaxHp += pt.maxHp;
          });
        }
        setHudState({
          hp: Math.ceil(p.hp),
          maxHp: p.maxHp,
          shield: Math.ceil(p.shield),
          maxShield: p.maxShield,
          score: g.score,
          runStars: Math.round(g.runStars * p.starValueMult),
          wave: Math.min(g.maxWaves, Math.max(1, g.wave)),
          maxWaves: g.maxWaves,
          combo: g.combo,
          overdrive: Math.floor(g.overdrive.charge),
          bossWarning: g.bossWarningTimer > 0,
          bossHp: Math.ceil(bossHp),
          bossMaxHp,
          bossName: g.boss ? g.boss.name : '',
        });
      }
    };

    const draw = () => {
      ctx.save();
      if (g.shake > 0) {
        ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      }

      // 1. Multi-layer environment & ground decks
      renderEnvironment(ctx, W, H, g.time, g.sector);

      // 2. Ground turrets first so airborne craft fly over them
      for (const e of g.enemies) {
        if (e.type === 'turret') renderEnemy(ctx, e, g.player, g.time);
      }

      // 3. Boss Dreadnought & Airborne Enemies
      renderBoss(ctx, g.boss, g.player, g.time);
      for (const e of g.enemies) {
        if (e.type !== 'turret') renderEnemy(ctx, e, g.player, g.time);
      }

      // 4. Player Interceptor
      if (g.player.hp > 0) {
        renderPlayer(ctx, g.player, g.ship, g.time);
      }

      // 5. Projectiles, Stars, Shockwaves & Volumetric Explosions
      renderProjectilesAndFX(ctx, g, g.time);

      // 6. High-altitude translucent cloud veil
      renderClouds(ctx, W, H, g.time, g.sector);

      ctx.restore();
    };

    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const updatePointer = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      g.pointer.x = ((clientX - rect.left) / rect.width) * W;
      g.pointer.y = ((clientY - rect.top) / rect.height) * H;
      g.pointer.active = true;
    };

    const onMouseMove = (e) => updatePointer(e.clientX, e.clientY);
    const onTouch = (e) => {
      if (e.touches.length > 0) {
        // Offset slightly above finger on touchscreens for clear visibility
        const rect = canvas.getBoundingClientRect();
        g.pointer.x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
        g.pointer.y = ((e.touches[0].clientY - rect.top) / rect.height) * H - 34;
        g.pointer.active = true;
      }
      e.preventDefault();
    };
    const onKeyDown = (e) => {
      g.keys[e.key] = true;
    };
    const onKeyUp = (e) => {
      g.keys[e.key] = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [screen]);

  const handleBuyUpgrade = (key) => {
    setUpgrades((prevUpgrades) => {
      const lvl = prevUpgrades[key] || 0;
      const cost = getUpgradeCost(key, lvl);
      const currentStars = loadStars();
      if (cost === null || currentStars < cost) return prevUpgrades;
      sfx.playUpgrade();
      const nextStars = currentStars - cost;
      const nextUpgrades = { ...prevUpgrades, [key]: lvl + 1 };
      saveStars(nextStars);
      saveUpgrades(nextUpgrades);
      setStars(nextStars);
      return nextUpgrades;
    });
  };

  const handleSelectShip = (ship) => {
    if (unlockedShips.includes(ship.id)) {
      setSelectedShipId(ship.id);
      try {
        localStorage.setItem(STORAGE_KEYS.selectedShip, ship.id);
      } catch {
        // ignore
      }
      return;
    }
    if (stars >= ship.unlockStars) {
      sfx.playUpgrade();
      const nextStars = stars - ship.unlockStars;
      const nextUnlocked = [...unlockedShips, ship.id];
      saveStars(nextStars);
      saveUnlockedShips(nextUnlocked);
      setStars(nextStars);
      setUnlockedShips(nextUnlocked);
      setSelectedShipId(ship.id);
    }
  };

  const handleToggleMute = () => {
    setMuted(sfx.toggleMute());
  };

  const totalEarnedMedals = Object.values(medals).reduce(
    (acc, m) => acc + ['clear', 'stars', 'unscathed', 'boss'].filter((k) => m && m[k]).length,
    0
  );

  return (
    <div className="nr-shell">
      <div className="nr-stage">
        {screen !== 'playing' && <canvas ref={ambientRef} className="nr-ambient-bg" />}

        {/* SCREEN 1: COMMAND MENU & SECTOR SELECT */}
        {screen === 'menu' && (
          <div className="nr-screen">
            <div className="nr-topbar">
              <div className="nr-currency-pill" title="Nebula Cores (Currency)">
                <span>★</span>
                <span>{stars.toLocaleString()} CORES</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
                  MEDALS {totalEarnedMedals}/12
                </span>
                <button className="nr-icon-btn" onClick={handleToggleMute}>
                  {muted ? 'AUDIO OFF' : 'AUDIO ON'}
                </button>
              </div>
            </div>

            <div className="nr-brand-hero">
              <NebulaLogo />
              <h1 className="nr-title">NEBULA RAID</h1>
              <p className="nr-subtitle">ORBITAL STRIKE VANGUARD</p>
            </div>

            <div className="nr-panel">
              <div className="nr-section-title">
                <span>SELECT COMBAT SECTOR</span>
                <span style={{ color: '#38bdf8' }}>{activeSector.difficulty}</span>
              </div>
              <div className="nr-sector-list">
                {SECTORS.map((sec) => {
                  const secMedals = medals[sec.id] || {};
                  const isActive = sec.id === selectedSectorId;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      className={`nr-sector-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedSectorId(sec.id)}
                    >
                      <div>
                        <div className="nr-sector-code">
                          {sec.code} · {sec.recTier}
                        </div>
                        <div className="nr-sector-name">{sec.name}</div>
                        <div className="nr-sector-sub">{sec.subtitle}</div>
                      </div>
                      <div className="nr-medal-row" aria-label="Sector Medals">
                        {MEDAL_META.map((m) => (
                          <span
                            key={m.key}
                            className={`nr-medal-pip ${secMedals[m.key] ? 'earned' : ''}`}
                            title={`${m.name}: ${m.desc}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="nr-panel" style={{ marginTop: '10px' }}>
              <div className="nr-section-title">
                <span>STRIKE INTERCEPTOR</span>
                <span style={{ color: activeShip.primaryColor }}>{activeShip.role}</span>
              </div>
              <div className="nr-ship-grid">
                {SHIPS.map((ship) => {
                  const unlocked = unlockedShips.includes(ship.id);
                  const active = ship.id === selectedShipId;
                  return (
                    <button
                      key={ship.id}
                      type="button"
                      className={`nr-ship-card ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}`}
                      onClick={() => handleSelectShip(ship)}
                    >
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: ship.primaryColor,
                          margin: '0 auto',
                          boxShadow: `0 0 8px ${ship.primaryColor}`,
                        }}
                      />
                      <div className="nr-ship-name">{ship.name.replace('NV-0', 'NV')}</div>
                      <div className="nr-ship-role">
                        {unlocked ? ship.role.split(' ')[0] : `UNLOCK ★${ship.unlockStars}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="nr-actions">
              <button
                type="button"
                className="nr-btn nr-btn-secondary"
                onClick={() => setScreen('hangar')}
              >
                TECH HANGAR
              </button>
              <button
                type="button"
                className="nr-btn nr-btn-primary"
                onClick={() => startMission(activeSector)}
              >
                LAUNCH SORTIE
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: TECH HANGAR & UPGRADE WORKSHOP */}
        {screen === 'hangar' && (
          <div className="nr-screen">
            <div className="nr-topbar">
              <div className="nr-currency-pill">
                <span>★</span>
                <span>{stars.toLocaleString()} CORES</span>
              </div>
              <button type="button" className="nr-icon-btn" onClick={() => setScreen('menu')}>
                BACK TO BRIDGE
              </button>
            </div>

            <div style={{ margin: '10px 0 4px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '0.08em' }}>
                ORBITAL TECH HANGAR
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Install permanent weapon pods, Aegis shields, and magnetic core tractors.
              </p>
            </div>

            <div className="nr-upgrade-list">
              {Object.keys(UPGRADES).map((key) => {
                const u = UPGRADES[key];
                const lvl = upgrades[key] || 0;
                const cost = getUpgradeCost(key, lvl);
                return (
                  <div className="nr-upgrade-card" key={key}>
                    <div className="nr-upg-info">
                      <div className="nr-upg-title">
                        <span style={{ color: u.color }}>●</span>
                        <span>{u.name}</span>
                        <span style={{ fontSize: '11px', color: '#38bdf8', marginLeft: 'auto' }}>
                          {u.statLabel(lvl)}
                        </span>
                      </div>
                      <div className="nr-upg-sub">{u.desc}</div>
                      <div className="nr-upg-bars">
                        {Array.from({ length: u.max }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`nr-upg-pip ${idx < lvl ? 'filled' : ''}`}
                            style={idx < lvl ? { background: u.color } : undefined}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="nr-buy-btn"
                      disabled={cost === null || stars < cost}
                      onClick={() => handleBuyUpgrade(key)}
                    >
                      {cost !== null ? `★ ${cost}` : 'MAXED'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="nr-actions">
              <button
                type="button"
                className="nr-btn nr-btn-secondary"
                onClick={() => setScreen('menu')}
              >
                SECTOR MAP
              </button>
              <button
                type="button"
                className="nr-btn nr-btn-primary"
                onClick={() => startMission(activeSector)}
              >
                LAUNCH SORTIE
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: ACTIVE MISSION CANVAS & TACTICAL HUD */}
        {screen === 'playing' && (
          <div className="nr-canvas-wrap">
            <canvas ref={canvasRef} className="nr-canvas" />
            <div className="nr-hud">
              <div className="nr-hud-top">
                <div className="nr-hud-row">
                  <div className="nr-hud-cluster">
                    <div className="nr-bar-wrap">
                      <div className="nr-bar-label">
                        <span>HULL INTEGRITY</span>
                        <span>
                          {hudState.hp}/{hudState.maxHp}
                        </span>
                      </div>
                      <div className="nr-bar-track">
                        <div
                          className="nr-bar-fill"
                          style={{
                            width: `${Math.max(0, (hudState.hp / hudState.maxHp) * 100)}%`,
                            background:
                              hudState.hp / hudState.maxHp > 0.35 ? '#34d399' : '#ef4444',
                          }}
                        />
                      </div>
                      {hudState.maxShield > 0 && (
                        <div className="nr-bar-track" style={{ height: '4px', marginTop: '2px' }}>
                          <div
                            className="nr-bar-fill"
                            style={{
                              width: `${Math.max(0, (hudState.shield / hudState.maxShield) * 100)}%`,
                              background: '#38bdf8',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="nr-hud-cluster">
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800 }}>
                        SCORE {hudState.combo > 1 ? `· x${1 + Math.min(5, Math.floor(hudState.combo / 4)) * 0.25}` : ''}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                        {hudState.score.toLocaleString()}
                      </div>
                    </div>
                    <div className="nr-currency-pill" style={{ padding: '4px 9px', fontSize: '12px' }}>
                      <span>★</span>
                      <span>{hudState.runStars}</span>
                    </div>
                  </div>
                </div>

                {hudState.bossMaxHp > 0 && (
                  <div className="nr-boss-hud">
                    <div className="nr-boss-title">
                      <span>{hudState.bossName}</span>
                      <span>{Math.round((hudState.bossHp / hudState.bossMaxHp) * 100)}%</span>
                    </div>
                    <div className="nr-bar-track" style={{ height: '7px' }}>
                      <div
                        className="nr-bar-fill"
                        style={{
                          width: `${Math.max(0, (hudState.bossHp / hudState.bossMaxHp) * 100)}%`,
                          background: 'linear-gradient(90deg, #f43f5e, #f59e0b)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {hudState.bossWarning && (
                <div className="nr-warning-banner">
                  WARNING · DREADNOUGHT APPROACHING
                </div>
              )}

              <div className="nr-hud-bottom">
                <button
                  type="button"
                  className="nr-emp-btn"
                  disabled={hudState.overdrive < 100}
                  onClick={triggerOverdrive}
                >
                  <span>⚡ NOVA EMP</span>
                  <span>{hudState.overdrive}%</span>
                </button>

                <div className="nr-hud-cluster" style={{ fontSize: '11px', fontWeight: 800 }}>
                  <span>
                    WAVE {hudState.wave}/{hudState.maxWaves}
                  </span>
                  <button
                    type="button"
                    className="nr-icon-btn"
                    style={{ padding: '4px 8px', fontSize: '10px' }}
                    onClick={() => setScreen('menu')}
                  >
                    ABORT
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 4: TACTICAL DEBRIEF & MEDAL EVALUATION */}
        {screen === 'debrief' && debrief && (
          <div className="nr-screen">
            <div className="nr-topbar">
              <div className="nr-currency-pill">
                <span>★</span>
                <span>{stars.toLocaleString()} CORES</span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  color: debrief.victory ? '#34d399' : '#fb7185',
                }}
              >
                {debrief.victory ? 'SECTOR SECURED' : 'INTERCEPTOR LOST'}
              </span>
            </div>

            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, letterSpacing: '0.14em' }}>
                {debrief.sector.code} · {debrief.sector.name}
              </div>
              <h2 style={{ margin: '4px 0', fontSize: '26px', fontWeight: 900 }}>
                {debrief.victory ? 'MISSION ACCOMPLISHED' : 'TACTICAL RETREAT'}
              </h2>
            </div>

            <div className="nr-panel">
              <div className="nr-section-title">
                <span>COMBAT TELEMETRY</span>
                <span style={{ color: '#facc15' }}>+★{debrief.earnedStars} CORES</span>
              </div>
              <div className="nr-stat-row">
                <span style={{ color: '#94a3b8' }}>Final Combat Score</span>
                <strong>{debrief.score.toLocaleString()}</strong>
              </div>
              <div className="nr-stat-row">
                <span style={{ color: '#94a3b8' }}>Hostiles Eliminated</span>
                <strong>{debrief.killPct}%</strong>
              </div>
              <div className="nr-stat-row">
                <span style={{ color: '#94a3b8' }}>Nebula Cores Retrieved</span>
                <strong>{debrief.starPct}%</strong>
              </div>
              <div className="nr-stat-row">
                <span style={{ color: '#94a3b8' }}>Dreadnought Status</span>
                <strong style={{ color: debrief.bossDefeated ? '#34d399' : '#94a3b8' }}>
                  {debrief.bossDefeated ? 'DESTROYED' : 'ACTIVE'}
                </strong>
              </div>
            </div>

            <div className="nr-panel" style={{ marginTop: '8px' }}>
              <div className="nr-section-title">
                <span>SECTOR COMMENDATIONS</span>
                <span>4 GOALS</span>
              </div>
              <div className="nr-debrief-grid">
                {MEDAL_META.map((m) => {
                  const earned = debrief.runMedals[m.key];
                  return (
                    <div key={m.key} className={`nr-medal-card ${earned ? 'earned' : ''}`}>
                      <span
                        className={`nr-medal-pip ${earned ? 'earned' : ''}`}
                        style={{ width: '24px', height: '24px', fontSize: '13px' }}
                      >
                        ★
                      </span>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 800 }}>{m.name}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{m.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="nr-actions">
              <button
                type="button"
                className="nr-btn nr-btn-secondary"
                onClick={() => setScreen('hangar')}
              >
                TECH HANGAR
              </button>
              <button
                type="button"
                className="nr-btn nr-btn-primary"
                onClick={() => startMission(debrief.sector)}
              >
                REDEPLOY
              </button>
            </div>
            <button
              type="button"
              className="nr-btn nr-btn-secondary"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={() => setScreen('menu')}
            >
              COMMAND BRIDGE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}