// 2.5D Top-Down Renderer for Nebula Raid v2
// Original procedural vector & gradient rendering with altitude drop-shadows,
// beveled metallic hulls, rotating turret barrels, volumetric explosions, and cloud layers.

export function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function renderEnvironment(ctx, W, H, time, sector) {
  const pal = sector.palette;

  // Base atmospheric / sea / canyon gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, pal.skyTop);
  bgGrad.addColorStop(0.55, pal.water);
  bgGrad.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle depth grid / tactical radar water ripples scrolling
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
  ctx.lineWidth = 1;
  const gridOffset = (time * 38) % 64;
  for (let y = -64 + gridOffset; y < H + 64; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let x = 40; x < W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();

  // Layer 1: Deep lower structures / canyon / sea platforms (slow parallax)
  const platScroll = time * 58;
  for (let i = 0; i < 5; i++) {
    const seed = i * 197 + sector.id * 41;
    const py = ((seed * 3.7 + platScroll) % (H + 340)) - 170;
    const px = (seed % 2 === 0) ? 18 + (seed % 50) : W - 150 - (seed % 50);
    const pw = 105 + (seed % 45);
    const ph = 145 + (seed % 60);

    // Sub-platform drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    drawRoundedRect(ctx, px + 12, py + 16, pw, ph, 10);
    ctx.fill();

    // Main platform deck
    const deckGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
    deckGrad.addColorStop(0, pal.deckMain);
    deckGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = deckGrad;
    drawRoundedRect(ctx, px, py, pw, ph, 10);
    ctx.fill();

    // Bevel highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner tech superstructure & helipad/reactor details
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    drawRoundedRect(ctx, px + 12, py + 14, pw - 24, ph - 28, 6);
    ctx.fill();

    // Hazard stripes on edge
    ctx.fillStyle = pal.deckTrim;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(px + 16, py + 20, pw - 32, 3);
    ctx.fillRect(px + 16, py + ph - 23, pw - 32, 3);

    // Landing circle or reactor ring
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph / 2, 18, 0, Math.PI * 2);
    ctx.strokeStyle = pal.deckTrim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Layer 2: Mid-altitude procedural girders / bridge spans
  const bridgeY = ((time * 95 + 420) % (H + 600)) - 300;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(0, bridgeY + 18, W, 34);

  const spanGrad = ctx.createLinearGradient(0, bridgeY, 0, bridgeY + 32);
  spanGrad.addColorStop(0, '#334155');
  spanGrad.addColorStop(0.5, '#1e293b');
  spanGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = spanGrad;
  ctx.fillRect(0, bridgeY, W, 32);

  ctx.fillStyle = pal.hazardColor;
  for (let hx = -20; hx < W + 20; hx += 28) {
    ctx.beginPath();
    ctx.moveTo(hx, bridgeY);
    ctx.lineTo(hx + 12, bridgeY);
    ctx.lineTo(hx + 4, bridgeY + 6);
    ctx.lineTo(hx - 8, bridgeY + 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Layer 3: High-speed atmospheric particles / embers / stars
  for (let i = 0; i < 38; i++) {
    const sx = (i * 89 + 23) % W;
    const speed = 110 + (i % 5) * 45;
    const sy = (i * 151 + time * speed) % H;
    const len = (i % 3 === 0) ? 8 : 3;
    ctx.fillStyle = i % 4 === 0 ? pal.deckTrim : 'rgba(226, 232, 240, 0.45)';
    ctx.fillRect(sx, sy, 1.5, len);
  }
}

export function renderClouds(ctx, W, H, time, sector) {
  const cloudScroll = time * 135;
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 173 + 60) % (W + 120)) - 60;
    const cy = ((i * 240 + cloudScroll) % (H + 360)) - 180;
    const rad = 75 + (i % 3) * 35;
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, rad);
    grad.addColorStop(0, sector.palette.cloudColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawJetFrame(ctx, ship, bankAngle, time, isShadow = false) {
  const id = ship.id;
  ctx.save();
  ctx.scale(1 - Math.abs(bankAngle) * 0.14, 1);

  if (id === 'valkyrie') {
    // Swept twin-tail fighter
    // Outer wings
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(28, 8);
    ctx.lineTo(24, 18);
    ctx.lineTo(9, 14);
    ctx.lineTo(11, 24);
    ctx.lineTo(4, 22);
    ctx.lineTo(0, 17);
    ctx.lineTo(-4, 22);
    ctx.lineTo(-11, 24);
    ctx.lineTo(-9, 14);
    ctx.lineTo(-24, 18);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      ctx.restore();
      return;
    }
    const wingGrad = ctx.createLinearGradient(-28, 0, 28, 0);
    wingGrad.addColorStop(0, '#0f172a');
    wingGrad.addColorStop(0.25, ship.secondaryColor);
    wingGrad.addColorStop(0.5, ship.primaryColor);
    wingGrad.addColorStop(0.75, ship.secondaryColor);
    wingGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = wingGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center fuselage spine
    const bodyGrad = ctx.createLinearGradient(-8, -28, 8, 22);
    bodyGrad.addColorStop(0, '#f8fafc');
    bodyGrad.addColorStop(0.45, ship.primaryColor);
    bodyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(8, -6);
    ctx.lineTo(6, 20);
    ctx.lineTo(0, 24);
    ctx.lineTo(-6, 20);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();

    // Wing accent stripes
    ctx.fillStyle = ship.accentColor;
    ctx.beginPath();
    ctx.moveTo(-19, 6);
    ctx.lineTo(-10, -2);
    ctx.lineTo(-10, 4);
    ctx.lineTo(-19, 11);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(19, 6);
    ctx.lineTo(10, -2);
    ctx.lineTo(10, 4);
    ctx.lineTo(19, 11);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'seraph') {
    // Forward-swept needle interceptor
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(9, -8);
    ctx.lineTo(29, -4);
    ctx.lineTo(22, 14);
    ctx.lineTo(8, 12);
    ctx.lineTo(5, 25);
    ctx.lineTo(0, 19);
    ctx.lineTo(-5, 25);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-22, 14);
    ctx.lineTo(-29, -4);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      ctx.restore();
      return;
    }
    const grad = ctx.createLinearGradient(-26, -15, 26, 20);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.5, ship.primaryColor);
    grad.addColorStop(1, '#022c22');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner core
    ctx.fillStyle = '#ecfdf5';
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(5, -4);
    ctx.lineTo(0, 20);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();
  } else {
    // Hyperion heavy twin-boom gunship
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(14, -18);
    ctx.lineTo(31, 4);
    ctx.lineTo(29, 18);
    ctx.lineTo(14, 24);
    ctx.lineTo(8, 18);
    ctx.lineTo(0, 24);
    ctx.lineTo(-8, 18);
    ctx.lineTo(-14, 24);
    ctx.lineTo(-29, 18);
    ctx.lineTo(-31, 4);
    ctx.lineTo(-14, -18);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      ctx.restore();
      return;
    }
    const grad = ctx.createLinearGradient(-30, -10, 30, 15);
    grad.addColorStop(0, '#4c0519');
    grad.addColorStop(0.5, ship.primaryColor);
    grad.addColorStop(1, '#4c0519');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Heavy armor plates
    ctx.fillStyle = '#ffe4e6';
    ctx.fillRect(-13, -14, 5, 28);
    ctx.fillRect(8, -14, 5, 28);
  }

  // Glossy Cockpit Canopy
  const canGrad = ctx.createLinearGradient(0, -16, 0, 4);
  canGrad.addColorStop(0, '#e0f2fe');
  canGrad.addColorStop(0.4, '#38bdf8');
  canGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = canGrad;
  ctx.beginPath();
  ctx.ellipse(0, -6, 3.6, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Specular glint on canopy
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-1.2, -9, 1.1, 4, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Twin Afterburner plumes
  const flicker = 1 + Math.sin(time * 55) * 0.22;
  [-6, 6].forEach((tx) => {
    const pGrad = ctx.createLinearGradient(tx, 20, tx, 20 + 18 * flicker);
    pGrad.addColorStop(0, '#ffffff');
    pGrad.addColorStop(0.35, ship.thrusterColor);
    pGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(tx - 3.2, 20);
    ctx.lineTo(tx + 3.2, 20);
    ctx.lineTo(tx, 20 + 19 * flicker);
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

export function renderPlayer(ctx, player, ship, time) {
  ctx.save();

  // 1. Offset Altitude Shadow (Sky Force signature 3D depth cue)
  ctx.save();
  ctx.translate(player.x + 22, player.y + 28);
  ctx.rotate(player.bank * 0.18);
  ctx.scale(0.84, 0.84);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  drawJetFrame(ctx, ship, player.bank, time, true);
  ctx.restore();

  // 2. Magnet tractor ring (subtle pulse around ship)
  if (player.magnetRadius > 90) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.beginPath();
    ctx.arc(0, 0, player.magnetRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Main Aircraft Body
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.bank * 0.2);

  // Wingpods if unlocked
  if (player.wingLevel > 0) {
    [-24, 24].forEach((wx) => {
      ctx.fillStyle = '#334155';
      drawRoundedRect(ctx, wx - 3.5, -2, 7, 15, 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(wx - 1.5, -5, 3, 4);
    });
  }

  drawJetFrame(ctx, ship, player.bank, time, false);

  // Damage flash overlay
  if (player.invuln > 0 && Math.floor(time * 24) % 2 === 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(-35, -35, 70, 70);
  }
  ctx.restore();

  // 4. Energy Shield Dome if active
  if (player.shield > 0) {
    const shieldRatio = player.shield / player.maxShield;
    ctx.save();
    ctx.translate(player.x, player.y);
    const sGrad = ctx.createRadialGradient(0, 0, 14, 0, 0, 34);
    sGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    sGrad.addColorStop(0.75, `rgba(56, 189, 248, ${0.08 + shieldRatio * 0.12})`);
    sGrad.addColorStop(1, `rgba(125, 211, 252, ${0.35 + shieldRatio * 0.35})`);
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(186, 230, 253, ${0.4 + shieldRatio * 0.4})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export function renderEnemy(ctx, e, player, time) {
  ctx.save();

  if (e.type === 'turret') {
    // Ground-emplaced armored AA turret (no long altitude shadow, sits on deck)
    ctx.translate(e.x, e.y);

    // Base shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(4, 5, 20, 0, Math.PI * 2);
    ctx.fill();

    // Octagonal armored bunker base
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const rx = Math.cos(a) * 19;
      const ry = Math.sin(a) * 19;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rotating gun housing aiming at player
    const aimAngle = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.save();
    ctx.rotate(aimAngle - Math.PI / 2);

    // Twin AA barrels
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-6, -2, 3.5, 22);
    ctx.fillRect(2.5, -2, 3.5, 22);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-6.5, 17, 4.5, 4);
    ctx.fillRect(2, 17, 4.5, 4);

    // Turret dome
    const domeGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
    domeGrad.addColorStop(0, '#94a3b8');
    domeGrad.addColorStop(0.6, '#334155');
    domeGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Glowing sensor eye
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    // Airborne Enemy Craft: Draw 3D Altitude Shadow first
    ctx.save();
    ctx.translate(e.x + 18, e.y + 24);
    ctx.scale(0.85, 0.85);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    drawEnemyHull(ctx, e.type, true);
    ctx.restore();

    // Draw Airborne Hull
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.vx) {
      ctx.rotate(Math.max(-0.28, Math.min(0.28, -e.vx * 0.002)));
    }
    drawEnemyHull(ctx, e.type, false, e.hitFlash > 0, time);
    ctx.restore();
  }

  // Health bar when damaged
  if (e.hp < e.maxHp) {
    const bw = e.w * 0.95;
    const bx = e.x - bw / 2;
    const by = e.y - e.w * 0.65 - 8;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = ratio > 0.5 ? '#34d399' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.fillRect(bx, by, bw * ratio, 4);
  }

  ctx.restore();
}

function drawEnemyHull(ctx, type, isShadow, hitFlash = false, time = 0) {
  if (type === 'scout') {
    // Fast Crimson Dart Interceptor
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(17, -6);
    ctx.lineTo(12, -16);
    ctx.lineTo(4, -10);
    ctx.lineTo(0, -18);
    ctx.lineTo(-4, -10);
    ctx.lineTo(-12, -16);
    ctx.lineTo(-17, -6);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(-16, -10, 16, 12);
    g.addColorStop(0, '#881337');
    g.addColorStop(0.5, hitFlash ? '#ffffff' : '#f43f5e');
    g.addColorStop(1, '#4c0519');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Canopy
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.ellipse(0, 2, 2.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'valkyrie_enemy' || type === 'gunship') {
    // Mid-size twin-engine raptor gunship
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(9, 14);
    ctx.lineTo(25, 4);
    ctx.lineTo(22, -14);
    ctx.lineTo(10, -10);
    ctx.lineTo(7, -20);
    ctx.lineTo(-7, -20);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-22, -14);
    ctx.lineTo(-25, 4);
    ctx.lineTo(-9, 14);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(-24, 0, 24, 0);
    g.addColorStop(0, '#431407');
    g.addColorStop(0.5, hitFlash ? '#ffffff' : '#fb923c');
    g.addColorStop(1, '#431407');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Twin rotor/thruster pods on wings
    [-16, 16].forEach((rx) => {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(rx, -2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Cockpit visor
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(0, 6, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Heavy Aerial Frigate / Mini-Cruiser ('heavy')
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(15, 22);
    ctx.lineTo(32, 6);
    ctx.lineTo(30, -16);
    ctx.lineTo(18, -24);
    ctx.lineTo(-18, -24);
    ctx.lineTo(-30, -16);
    ctx.lineTo(-32, 6);
    ctx.lineTo(-15, 22);
    ctx.closePath();
    if (isShadow) {
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(-32, -20, 32, 20);
    g.addColorStop(0, '#1e293b');
    g.addColorStop(0.5, hitFlash ? '#ffffff' : '#64748b');
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Armor trim & core glow
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-18, -8, 36, 4);
    ctx.beginPath();
    ctx.arc(0, 4, 6 + Math.sin(time * 10) * 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }
}

export function renderBoss(ctx, boss, player, time) {
  if (!boss) return;
  ctx.save();

  // 1. Massive Altitude Shadow
  ctx.save();
  ctx.translate(boss.x + 26, boss.y + 34);
  ctx.scale(0.92, 0.92);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(42, 42);
  ctx.lineTo(118, 12);
  ctx.lineTo(106, -42);
  ctx.lineTo(48, -56);
  ctx.lineTo(-48, -56);
  ctx.lineTo(-106, -42);
  ctx.lineTo(-118, 12);
  ctx.lineTo(-42, 42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Main Dreadnought Airframe
  ctx.save();
  ctx.translate(boss.x, boss.y);

  // Main wingspan
  const hullGrad = ctx.createLinearGradient(-118, -45, 118, 45);
  hullGrad.addColorStop(0, '#0f172a');
  hullGrad.addColorStop(0.25, '#334155');
  hullGrad.addColorStop(0.5, boss.hitFlash > 0 ? '#ffffff' : '#475569');
  hullGrad.addColorStop(0.75, '#334155');
  hullGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = hullGrad;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(42, 42);
  ctx.lineTo(118, 12);
  ctx.lineTo(106, -42);
  ctx.lineTo(48, -56);
  ctx.lineTo(-48, -56);
  ctx.lineTo(-106, -42);
  ctx.lineTo(-118, 12);
  ctx.lineTo(-42, 42);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Armored deck plates
  ctx.fillStyle = '#1e293b';
  drawRoundedRect(ctx, -44, -42, 88, 72, 10);
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hazard stripes on wings
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-96, -32, 36, 5);
  ctx.fillRect(60, -32, 36, 5);

  // 3. Multi-Part Subsystems (Left Wing Pod, Right Wing Pod, Central Core)
  boss.parts.forEach((part) => {
    const px = part.offsetX;
    const py = part.offsetY;
    ctx.save();
    ctx.translate(px, py);

    if (part.hp <= 0) {
      // Destroyed crater with scorched rim
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(0, 0, part.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Flickering internal fire
      ctx.fillStyle = Math.sin(time * 25 + px) > 0 ? '#ea580c' : '#facc15';
      ctx.beginPath();
      ctx.arc(Math.sin(time * 9) * 3, Math.cos(time * 11) * 3, part.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Active turret or reactor core
      if (part.id === 'core') {
        // Central Plasma Core
        const pulse = 1 + Math.sin(time * 8) * 0.08;
        const cGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, part.r * pulse);
        cGrad.addColorStop(0, '#ffffff');
        cGrad.addColorStop(0.4, part.hitFlash > 0 ? '#ffffff' : '#38bdf8');
        cGrad.addColorStop(0.8, '#0284c7');
        cGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(0, 0, part.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Heavy Wing Turret Battery
        const aim = Math.atan2(player.y - (boss.y + py), player.x - (boss.x + px));
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, part.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.rotate(aim - Math.PI / 2);
        ctx.fillStyle = part.hitFlash > 0 ? '#ffffff' : '#cbd5e1';
        ctx.fillRect(-7, 0, 4.5, 22);
        ctx.fillRect(2.5, 0, 4.5, 22);

        ctx.fillStyle = part.hitFlash > 0 ? '#ffffff' : '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Individual part mini health bar
      if (part.hp < part.maxHp) {
        const pw = part.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(-pw / 2, -part.r - 10, pw, 4);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-pw / 2, -part.r - 10, pw * (part.hp / part.maxHp), 4);
      }
    }
    ctx.restore();
  });

  ctx.restore();
  ctx.restore();
}

export function renderProjectilesAndFX(ctx, g, time) {
  // 1. Expanding shockwave rings (explosions & EMP overdrive)
  for (const ring of g.shockwaves) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = Math.max(0, ring.alpha);
    ctx.lineWidth = ring.lineWidth || 3;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Collectible Nebula Cores (Stars/Medals) with magnetic tether & golden sheen
  for (const s of g.stars) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const spin = time * 5 + s.phase;

    // Glow halo
    const sGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    sGrad.addColorStop(0, '#fef08a');
    sGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.55)');
    sGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // 4-point star crystal
    ctx.rotate(spin * 0.4);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? 6.5 : 2.8;
      const a = (i * Math.PI) / 4;
      const rx = Math.cos(a) * rad;
      const ry = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 3. Player Primary & Wing Bullets (luminous plasma bolts)
  for (const b of g.bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.vx) {
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    }
    const bGrad = ctx.createLinearGradient(0, -12, 0, 8);
    bGrad.addColorStop(0, '#ffffff');
    bGrad.addColorStop(0.4, b.color || '#38bdf8');
    bGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = bGrad;
    drawRoundedRect(ctx, -b.w / 2, -12, b.w, 18, b.w / 2);
    ctx.fill();

    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -10, 2, 9);
    ctx.restore();
  }

  // 4. Enemy Ordnance (high-contrast glowing plasma orbs with dark-core readability)
  for (const b of g.enemyBullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const r = b.r || 5.5;
    const eGrad = ctx.createRadialGradient(0, 0, 1.5, 0, 0, r * 1.9);
    eGrad.addColorStop(0, '#ffffff');
    eGrad.addColorStop(0.45, b.color || '#fb7185');
    eGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = eGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Volumetric Particles (sparks, fireballs, smoke puffs)
  for (const pt of g.particles) {
    ctx.save();
    const lifeRatio = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = lifeRatio;
    if (pt.kind === 'smoke') {
      ctx.fillStyle = pt.color || 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.5 - lifeRatio * 0.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.035, pt.y - pt.vy * 0.035);
      ctx.stroke();
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 6. Floating Tactical Callouts ("+25", "CHAIN x4", "TURRET DESTROYED")
  for (const ft of g.floatTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 2));
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color || '#facc15';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}
