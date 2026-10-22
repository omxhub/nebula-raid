import { useEffect, useRef, useState } from 'react';
import './App.css';

const W = 480, H = 720;
const loadUpgrades = () => { try { return JSON.parse(localStorage.getItem('nebulaUpgrades') || '{}'); } catch { return {}; } };
const saveUpgrades = (u) => localStorage.setItem('nebulaUpgrades', JSON.stringify(u));
const loadStars = () => parseInt(localStorage.getItem('nebulaStars') || '0', 10) || 0;
const saveStars = (n) => localStorage.setItem('nebulaStars', String(n));

const UPG = {
  fireRate: { name: 'Fire Rate', max: 5, cost: (l) => (l + 1) * 60 },
  damage: { name: 'Damage', max: 5, cost: (l) => (l + 1) * 80 },
};

function makeGame(upgrades) {
  const frLevel = upgrades.fireRate || 0;
  const dmgLevel = upgrades.damage || 0;
  return {
    state: 'playing',
    player: { x: W / 2, y: H - 80, r: 14, hp: 3, maxHp: 3, fireCd: 0, fireInterval: 260 - frLevel * 30, dmg: 1 + dmgLevel },
    bullets: [], enemyBullets: [], enemies: [], stars: [], particles: [],
    score: 0, runStars: 0,
    wave: 0, waveTimer: 0,
    boss: null, bossSpawned: false,
    keys: {},
    mouse: { x: W / 2, y: H - 80, active: false },
    time: 0, levelTime: 0,
    shake: 0,
  };
}

export default function Game() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef = useRef(null);
  const [screen, setScreen] = useState('menu');
  const [upgrades, setUpgrades] = useState(loadUpgrades());
  const [stars, setStars] = useState(loadStars());
  const [runInfo, setRunInfo] = useState({ score: 0, stars: 0 });

  const start = () => {
    gameRef.current = makeGame(upgrades);
    setScreen('playing');
  };

  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const g = gameRef.current;
    let last = performance.now();

    const spawnWave = () => {
      g.wave++;
      const n = 4 + Math.min(g.wave, 4);
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        let type = 'small';
        if (g.wave > 2 && t > 0.6) type = 'medium';
        if (g.wave > 4 && t > 0.85) type = 'big';
        g.enemies.push({
          x: 40 + Math.random() * (W - 80),
          y: -30 - i * 40,
          type, hp: type === 'small' ? 1 : type === 'medium' ? 2 : 4,
          maxHp: type === 'small' ? 1 : type === 'medium' ? 2 : 4,
          speed: type === 'small' ? 120 : type === 'medium' ? 90 : 60,
          w: type === 'small' ? 22 : type === 'medium' ? 28 : 36,
          shootCd: 1.5 + Math.random(),
          zig: Math.random() * Math.PI * 2,
        });
      }
    };

    const spawnBoss = () => {
      g.boss = { x: W / 2, y: -60, hp: 60, maxHp: 60, w: 70, dir: 1, shootCd: 1, t: 0 };
      g.bossSpawned = true;
    };

    const addParticles = (x, y, color, n = 8) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 120;
        g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
      }
    };

    const hitPlayer = () => {
      g.player.hp--;
      g.shake = 8;
      addParticles(g.player.x, g.player.y, '#ff6b6b', 12);
      if (g.player.hp <= 0) {
        g.state = 'dead';
        const total = loadStars() + g.runStars;
        saveStars(total);
        setStars(total);
        setRunInfo({ score: g.score, stars: g.runStars });
        setScreen('gameover');
      }
    };

    const update = (dt) => {
      if (g.state !== 'playing') return;
      g.time += dt;
      g.levelTime += dt;
      const p = g.player;
      if (g.mouse.active) {
        p.x += (g.mouse.x - p.x) * 0.25;
        p.y += (g.mouse.y - p.y) * 0.25;
      }
      const speed = 320;
      if (g.keys['ArrowLeft'] || g.keys['a']) p.x -= speed * dt;
      if (g.keys['ArrowRight'] || g.keys['d']) p.x += speed * dt;
      if (g.keys['ArrowUp'] || g.keys['w']) p.y -= speed * dt;
      if (g.keys['ArrowDown'] || g.keys['s']) p.y += speed * dt;
      p.x = Math.max(p.r, Math.min(W - p.r, p.x));
      p.y = Math.max(p.r, Math.min(H - p.r, p.y));

      p.fireCd -= dt;
      if (p.fireCd <= 0) {
        p.fireCd = p.fireInterval / 1000;
        g.bullets.push({ x: p.x, y: p.y - p.r - 4, vy: -520, dmg: p.dmg });
      }

      g.waveTimer += dt;
      if (!g.bossSpawned && g.wave < 8 && g.waveTimer > 5) {
        g.waveTimer = 0;
        spawnWave();
      }
      if (!g.bossSpawned && (g.wave >= 8 || g.levelTime > 50)) {
        if (g.enemies.length === 0) spawnBoss();
      }

      for (const b of g.bullets) b.y += b.vy * dt;
      g.bullets = g.bullets.filter(b => b.y > -20);
      for (const b of g.enemyBullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
      g.enemyBullets = g.enemyBullets.filter(b => b.y < H + 20 && b.x > -20 && b.x < W + 20);

      for (const e of g.enemies) {
        e.y += e.speed * dt;
        if (e.type === 'medium') { e.x += Math.sin(g.time * 2 + e.zig) * 60 * dt; }
        if (e.type === 'big') { e.x += Math.sin(g.time * 1.2 + e.zig) * 40 * dt; e.x = Math.max(30, Math.min(W - 30, e.x)); }
        e.shootCd -= dt;
        if (e.shootCd <= 0 && e.type !== 'small') {
          e.shootCd = 1.6 + Math.random() * 0.8;
          const dx = p.x - e.x, dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          g.enemyBullets.push({ x: e.x, y: e.y + e.w / 2, vx: dx / len * 220, vy: dy / len * 220 });
        }
      }

      for (const b of g.bullets) {
        for (const e of g.enemies) {
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.w / 2 + 4) {
            e.hp -= b.dmg; b.y = -100;
            addParticles(b.x, b.y, '#ffd166', 4);
            if (e.hp <= 0) {
              g.score += e.type === 'small' ? 10 : e.type === 'medium' ? 25 : 60;
              const drop = e.type === 'small' ? 1 : e.type === 'medium' ? 2 : 4;
              for (let i = 0; i < drop; i++) g.stars.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y, vy: 40 + Math.random() * 40, collected: false });
              addParticles(e.x, e.y, '#94d2bd', 10);
              e.y = H + 100;
            }
          }
        }
      }
      g.enemies = g.enemies.filter(e => e.y < H + 60 && e.hp > 0);

      if (g.boss) {
        const boss = g.boss;
        boss.t += dt;
        boss.x += boss.dir * 80 * dt;
        if (boss.x < 60 || boss.x > W - 60) boss.dir *= -1;
        boss.y = Math.min(100, boss.y + 60 * dt);
        boss.shootCd -= dt;
        if (boss.shootCd <= 0) {
          boss.shootCd = 0.9;
          for (let i = -2; i <= 2; i++) {
            const a = Math.PI / 2 + i * 0.25;
            g.enemyBullets.push({ x: boss.x, y: boss.y + 30, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260 });
          }
        }
        for (const b of g.bullets) {
          if (Math.hypot(b.x - boss.x, b.y - boss.y) < boss.w / 2 + 4) {
            boss.hp -= b.dmg; b.y = -100;
            addParticles(b.x, b.y, '#ffd166', 3);
          }
        }
        if (boss.hp <= 0) {
          g.score += 500;
          for (let i = 0; i < 12; i++) g.stars.push({ x: boss.x + (Math.random() - 0.5) * 60, y: boss.y, vy: 50 + Math.random() * 60, collected: false });
          addParticles(boss.x, boss.y, '#f4a261', 40);
          g.boss = null;
          g.state = 'won';
          const total = loadStars() + g.runStars;
          saveStars(total);
          setStars(total);
          setRunInfo({ score: g.score, stars: g.runStars });
          setTimeout(() => setScreen('gameover'), 1200);
        }
      }

      for (const s of g.stars) {
        s.y += s.vy * dt;
        if (!s.collected && Math.hypot(s.x - p.x, s.y - p.y) < p.r + 10) {
          s.collected = true; g.runStars++; g.score += 5;
          addParticles(s.x, s.y, '#ffd700', 6);
        }
      }
      g.stars = g.stars.filter(s => !s.collected && s.y < H + 20);

      for (const b of g.enemyBullets) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 4) {
          b.y = H + 100; hitPlayer();
        }
      }
      for (const e of g.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.w / 2 + p.r - 2) {
          e.y = H + 100; hitPlayer();
        }
      }
      if (g.boss && Math.hypot(g.boss.x - p.x, g.boss.y - p.y) < g.boss.w / 2 + p.r) {
        hitPlayer();
      }

      for (const pt of g.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.95; pt.vy *= 0.95; pt.life -= dt; }
      g.particles = g.particles.filter(pt => pt.life > 0);

      if (g.shake > 0) g.shake -= dt * 20;
    };

    const draw = () => {
      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      ctx.fillStyle = '#050816';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 60; i++) {
        const x = (i * 97 + 13) % W;
        const y = (i * 131 + g.time * (20 + (i % 5) * 10)) % H;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = '#7dd3fc';
      for (const b of g.bullets) { ctx.fillRect(b.x - 2, b.y - 8, 4, 12); }
      ctx.fillStyle = '#ff6b6b';
      for (const b of g.enemyBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
      for (const e of g.enemies) {
        ctx.fillStyle = e.type === 'small' ? '#a78bfa' : e.type === 'medium' ? '#f472b6' : '#fb923c';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2); ctx.fill();
        if (e.hp < e.maxHp) {
          ctx.fillStyle = '#333'; ctx.fillRect(e.x - e.w / 2, e.y - e.w / 2 - 6, e.w, 4);
          ctx.fillStyle = '#4ade80'; ctx.fillRect(e.x - e.w / 2, e.y - e.w / 2 - 6, e.w * (e.hp / e.maxHp), 4);
        }
      }
      if (g.boss) {
        const b = g.boss;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(b.x - b.w / 2, b.y - b.w / 3, b.w, b.w * 2 / 3);
        ctx.fillStyle = '#fca5a5';
        ctx.fillRect(b.x - 10, b.y - b.w / 3 - 8, 20, 8);
        ctx.fillStyle = '#333'; ctx.fillRect(b.x - b.w / 2, b.y - b.w / 2 - 10, b.w, 5);
        ctx.fillStyle = '#4ade80'; ctx.fillRect(b.x - b.w / 2, b.y - b.w / 2 - 10, b.w * (b.hp / b.maxHp), 5);
      }
      ctx.fillStyle = '#ffd700';
      for (const s of g.stars) { ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill(); }
      const pl = g.player;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(pl.x, pl.y - pl.r);
      ctx.lineTo(pl.x - pl.r, pl.y + pl.r);
      ctx.lineTo(pl.x + pl.r, pl.y + pl.r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(251,191,36,0.6)';
      ctx.fillRect(pl.x - 3, pl.y + pl.r, 6, 6 + Math.random() * 4);
      for (const pt of g.particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 2);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.fillStyle = '#9fd3ff';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('Score: ' + g.score, 10, 20);
      ctx.fillText('Stars: ' + g.runStars, 10, 40);
      ctx.textAlign = 'right';
      ctx.fillText('Lives: ' + g.player.hp, W - 10, 20);
      ctx.fillText('Wave: ' + g.wave + '/8', W - 10, 40);
      ctx.textAlign = 'left';
    };

    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      g.mouse.x = (e.clientX - rect.left) * (W / rect.width);
      g.mouse.y = (e.clientY - rect.top) * (H / rect.height);
      g.mouse.active = true;
    };
    const onTouch = (e) => {
      if (e.touches.length) {
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        g.mouse.x = (t.clientX - rect.left) * (W / rect.width);
        g.mouse.y = (t.clientY - rect.top) * (H / rect.height);
        g.mouse.active = true;
      }
      e.preventDefault();
    };
    const kd = (e) => { g.keys[e.key] = true; };
    const ku = (e) => { g.keys[e.key] = false; };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchstart', onTouch);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [screen, upgrades]);

  const buy = (key) => {
    const lvl = upgrades[key] || 0;
    const u = UPG[key];
    if (lvl >= u.max) return;
    const cost = u.cost(lvl);
    if (stars < cost) return;
    const newStars = stars - cost;
    const newUp = { ...upgrades, [key]: lvl + 1 };
    saveStars(newStars); saveUpgrades(newUp);
    setStars(newStars); setUpgrades(newUp);
  };

  if (screen === 'menu') {
    return (
      <div className="app">
        <div className="overlay" style={{ position: 'relative', background: 'transparent' }}>
          <h1>Nebula Raid</h1>
          <p>An original vertical-scrolling shooter. Move with mouse, touch or keys. Auto-fire. Collect stars, defeat the boss.</p>
          <p>Stars: {stars}</p>
          <button className="btn" onClick={start}>Start Mission</button>
          <button className="btn" onClick={() => setScreen('shop')} style={{ background: '#475569' }}>Upgrades</button>
        </div>
      </div>
    );
  }

  if (screen === 'shop') {
    return (
      <div className="app">
        <div className="overlay" style={{ position: 'relative', background: 'transparent' }}>
          <h1>Upgrades</h1>
          <p>Stars: {stars}</p>
          <div className="shop">
            {Object.keys(UPG).map(key => {
              const u = UPG[key]; const lvl = upgrades[key] || 0;
              const cost = lvl < u.max ? u.cost(lvl) : null;
              return (
                <div className="card" key={key}>
                  <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                  <div>Level {lvl}/{u.max}</div>
                  {cost !== null ? <button className="btn" onClick={() => buy(key)} disabled={stars < cost}>Buy ({cost})</button> : <div>MAX</div>}
                </div>
              );
            })}
          </div>
          <button className="btn" onClick={() => setScreen('menu')} style={{ background: '#475569' }}>Back</button>
        </div>
      </div>
    );
  }

  if (screen === 'gameover') {
    return (
      <div className="app">
        <div className="overlay" style={{ position: 'relative', background: 'transparent' }}>
          <h1>Game Over</h1>
          <p>Score: {runInfo.score}</p>
          <p>Stars earned: {runInfo.stars}</p>
          <p>Total stars: {stars}</p>
          <button className="btn" onClick={start}>Play Again</button>
          <button className="btn" onClick={() => setScreen('shop')} style={{ background: '#475569' }}>Upgrades</button>
          <button className="btn" onClick={() => setScreen('menu')} style={{ background: '#334155' }}>Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" style={{ position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}