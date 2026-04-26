// ═══════════════════════════════════════════════════════════════════════════
//  Palota Kaland — Prince of Persia stílusú platformer
//  Mozgó platformok, csapdák, fal-kapaszkodás, időzített kihívások
// ═══════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const btnAction = document.getElementById('action-btn');
const elLives = document.getElementById('lives');
const elLevel = document.getElementById('level');

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const WALK_SPEED = 5;
const CLIMB_SPEED = 2.5;

// ─── Játék állapot ───────────────────────────────────────────────────────────
let state = 'idle';
let lives = 3;
let level = 1;
let frameCount = 0;
let invincible = 0;
let cameraX = 0;
let animId;

// ─── Billentyűk ──────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── Lány ────────────────────────────────────────────────────────────────────
const girl = {
  x: 100,
  y: 150,
  vy: 0,
  vx: 0,
  onGround: true,
  onClimb: false,
  walkFrame: 0,

  get w() { return 36; },
  get h() { return 68; },
  get top() { return this.y - this.h; },

  reset() {
    this.x = 100;
    this.y = 150;
    this.vy = 0;
    this.vx = 0;
    this.onGround = true;
    this.onClimb = false;
  },

  update() {
    const prevY = this.y;

    // Horizontális mozgás
    this.vx = 0;
    if (keys['ArrowLeft']) this.vx = -WALK_SPEED;
    if (keys['ArrowRight']) this.vx = WALK_SPEED;
    this.x += this.vx;

    if (!this.onClimb) {
      // Ugrás
      if ((keys['ArrowUp'] || keys[' ']) && this.onGround) {
        this.vy = JUMP_FORCE;
        this.onGround = false;
        GameUtils.playTone(520, 0.1);
      }

      this.vy += GRAVITY;
      this.y += this.vy;

      this.onGround = false;
      checkPlatformCollisions(this, prevY);

      const groundY = getGroundAt(this.x);
      if (!this.onGround && this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      }
    } else {
      // Kletter
      this.vy = 0;
      if (keys['ArrowUp']) this.y -= CLIMB_SPEED;
      if (keys['ArrowDown']) this.y += CLIMB_SPEED;

      if (keys['ArrowLeft'] || keys['ArrowRight']) {
        this.onClimb = false;
        this.vy = 0;
      }
    }

    checkClimbCollisions(this);
    checkTrapCollisions(this);
    checkGoalCollision(this);

    // Animáció
    if (this.vx !== 0 && this.onGround) {
      if (frameCount % 8 === 0) this.walkFrame = (this.walkFrame + 1) % 4;
    } else {
      this.walkFrame = 0;
    }

    // Esés → respawn
    if (this.y > H + 100) {
      respawnGirl();
    }
  },

  draw() {
    const screenX = this.x - cameraX;
    const screenY = this.y;

    ctx.save();
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) ctx.globalAlpha = 0.35;

    if (this.onClimb) {
      drawGirlClimbing(screenX, screenY);
    } else {
      drawGirl(screenX, screenY, this.walkFrame, this.vy < -2, this.vx < 0);
    }

    ctx.restore();
  },

  bbox() {
    const m = 6;
    return { x: this.x - this.w / 2 + m, y: this.top + m, w: this.w - m * 2, h: this.h - m };
  }
};

// ─── Rajzolás (átmásolt az előző játékból) ────────────────────────────────────
function drawGirl(x, ground, walkFrame, jumping, facingLeft) {
  const py = ground;
  const dir = facingLeft ? -1 : 1;
  const lo = [[-7, 0], [7, 0], [-7, 5], [7, 5]][walkFrame];

  ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 8*dir + lo[0]*dir, py - 22); ctx.lineTo(x - 8*dir + lo[0]*dir, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 8*dir - lo[0]*dir, py - 22); ctx.lineTo(x + 8*dir - lo[0]*dir, py + lo[1]); ctx.stroke();

  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x - 8*dir + lo[0]*dir, py, 7, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 8*dir - lo[0]*dir, py + lo[1], 7, 4, 0, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.moveTo(x - 14*dir, py - 22); ctx.lineTo(x + 14*dir, py - 22); ctx.lineTo(x + 18*dir, py - 40); ctx.lineTo(x - 18*dir, py - 40); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x - 11*dir, py - 58, 22*dir, 20, 4); ctx.fill();

  const armAngle = jumping ? -0.8 : (walkFrame % 2 === 0 ? 0.3 : -0.3);
  ctx.strokeStyle = '#fde3a7'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 11*dir, py - 54); ctx.lineTo(x - 20*dir, py - 54 + Math.sin(armAngle)*16*dir); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 11*dir, py - 54); ctx.lineTo(x + 20*dir, py - 54 - Math.sin(armAngle)*16*dir); ctx.stroke();

  ctx.fillStyle = '#fde3a7'; ctx.beginPath(); ctx.arc(x, py - 67, 13, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#8B4513';
  ctx.beginPath(); ctx.arc(x, py - 72, 13, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 16*dir, py - 68, 6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16*dir, py - 68, 6, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x - 16*dir, py - 68, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16*dir, py - 68, 4, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x - 4*dir, py - 67, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4*dir, py - 67, 2, 0, Math.PI*2); ctx.fill();

  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, py - 64, 4, 0.2, Math.PI - 0.2); ctx.stroke();
}

function drawGirlClimbing(x, y) {
  const py = y;
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.roundRect(x - 10, py - 48, 20, 28, 4); ctx.fill();
  ctx.strokeStyle = '#fde3a7'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 10, py - 40); ctx.lineTo(x - 18, py - 58); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 10, py - 40); ctx.lineTo(x + 18, py - 58); ctx.stroke();
  ctx.fillStyle = '#fde3a7'; ctx.beginPath(); ctx.arc(x, py - 60, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.arc(x, py - 65, 10, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x - 3, py - 60, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 3, py - 60, 1.5, 0, Math.PI*2); ctx.fill();
}

// ─── Platformok ──────────────────────────────────────────────────────────────
let platforms = [];
let movingPlatforms = [];
let traps = [];
let climbObjects = [];
let goalPlatform = null;
let nextSpawnX = 0;

function generateLevel() {
  platforms = [];
  movingPlatforms = [];
  traps = [];
  climbObjects = [];

  // Kezdeti platform
  platforms.push({ x: 0, y: 180, w: 200 });

  nextSpawnX = 220;

  // Szintek progresszívabb
  const levelDifficulty = Math.min(level, 5);

  for (let i = 0; i < 20 + levelDifficulty * 5; i++) {
    spawnNextSection(levelDifficulty);
  }

  // Végcél
  goalPlatform = {
    x: nextSpawnX + 300,
    y: 160,
    w: 150
  };
}

function spawnNextSection(difficulty) {
  const gap = 70 + Math.random() * 90 + difficulty * 10;
  const x = nextSpawnX + gap;
  const w = 80 + Math.random() * 110;
  const y = 120 + Math.random() * 140;

  // Normál platform
  if (Math.random() < 0.6) {
    platforms.push({ x, y, w });
  }

  // Mozgó platform
  if (Math.random() < 0.25 + difficulty * 0.08) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const speed = 1.5 + Math.random() * 2;
    movingPlatforms.push({
      x, y, w, dir, speed,
      minX: Math.max(0, x - 180),
      maxX: x + 180,
      t: 0
    });
  }

  // Szöges csapda
  if (Math.random() < 0.3 + difficulty * 0.05) {
    traps.push({
      type: 'spikes',
      x: x + w / 2,
      y: y + 20,
      w: 40,
      h: 20
    });
  }

  // Nyíl csapda (függőleges)
  if (Math.random() < 0.2 + difficulty * 0.03) {
    traps.push({
      type: 'arrow',
      x: x - 80,
      y: y - 100,
      interval: 120 + Math.floor(Math.random() * 80),
      timer: 0,
      active: false
    });
  }

  // Mászható fal
  if (Math.random() < 0.2) {
    climbObjects.push({
      x: x + w / 2,
      y: y - 80,
      w: 24,
      h: 60
    });
  }

  nextSpawnX = x + w;
}

function getGroundAt(x) {
  for (const p of platforms) {
    if (x > p.x - 20 && x < p.x + p.w + 20) return p.y;
  }
  for (const mp of movingPlatforms) {
    if (x > mp.x - 20 && x < mp.x + mp.w + 20) return mp.y;
  }
  return H + 50;
}

function checkPlatformCollisions(g, prevY) {
  const gb = g.bbox();

  // Normál platformok
  for (const p of platforms) {
    if (gb.x + gb.w < p.x || gb.x > p.x + p.w) continue;
    if (prevY + g.h <= p.y + 5 && g.y + g.h >= p.y && g.vy >= 0) {
      g.y = p.y - g.h;
      g.vy = 0;
      g.onGround = true;
      return;
    }
  }

  // Mozgó platformok
  for (const mp of movingPlatforms) {
    if (gb.x + gb.w < mp.x || gb.x > mp.x + mp.w) continue;
    if (prevY + g.h <= mp.y + 5 && g.y + g.h >= mp.y && g.vy >= 0) {
      g.y = mp.y - g.h;
      g.vy = 0;
      g.onGround = true;
      return;
    }
  }
}

function checkClimbCollisions(g) {
  for (const c of climbObjects) {
    if (g.x > c.x - c.w / 2 - 10 && g.x < c.x + c.w / 2 + 10 &&
        g.y - g.h < c.y + c.h && g.y > c.y - 40) {
      if (keys['ArrowUp']) {
        g.onClimb = true;
        g.onGround = false;
        g.vy = 0;
      }
    }
  }
}

function checkTrapCollisions(g) {
  if (invincible > 0) return;

  const gb = g.bbox();
  for (const t of traps) {
    if (t.type === 'spikes') {
      if (gb.x < t.x + t.w && gb.x + gb.w > t.x &&
          gb.y < t.y + t.h && gb.y + gb.h > t.y) {
        hit();
        return;
      }
    } else if (t.type === 'arrow' && t.active) {
      const arrowX = t.x;
      const arrowY = t.y + 60;
      if (gb.x < arrowX + 15 && gb.x + gb.w > arrowX - 15 &&
          gb.y < arrowY + 10 && gb.y + gb.h > arrowY - 10) {
        hit();
        return;
      }
    }
  }
}

function checkGoalCollision(g) {
  if (!goalPlatform) return;
  if (g.x > goalPlatform.x && g.x < goalPlatform.x + goalPlatform.w &&
      g.y >= goalPlatform.y - 40) {
    levelComplete();
  }
}

// ─── Háttér ──────────────────────────────────────────────────────────────────
function drawBackground() {
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, W, H);

  // Oszlopok
  ctx.fillStyle = '#34495e';
  for (let cx = -cameraX * 0.3 % 200; cx < W + 200; cx += 200) {
    ctx.fillRect(cx, 0, 30, H);
  }

  // Kövek dekoráció
  ctx.fillStyle = '#7f8c8d';
  for (let bx = -cameraX * 0.5 % 250; bx < W + 250; bx += 250) {
    ctx.beginPath(); ctx.arc(bx, H - 40, 15, 0, Math.PI*2); ctx.fill();
  }
}

function drawPlatforms() {
  // Normál platformok
  for (const p of platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < 0 || sx > W) continue;

    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(sx, p.y, p.w, 20);
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(sx, p.y - 4, p.w, 4);

    // Kötél szegélyek
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, p.y); ctx.lineTo(sx, p.y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + p.w, p.y); ctx.lineTo(sx + p.w, p.y - 8); ctx.stroke();
  }

  // Mozgó platformok
  for (const mp of movingPlatforms) {
    const sx = mp.x - cameraX;
    if (sx + mp.w < 0 || sx > W) continue;

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(sx, mp.y, mp.w, 20);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(sx, mp.y - 4, mp.w, 4);

    // Nyíl jelzés
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mp.dir > 0 ? '→' : '←', sx + mp.w / 2, mp.y - 10);
  }

  // Végcél
  if (goalPlatform) {
    const sx = goalPlatform.x - cameraX;
    if (sx + goalPlatform.w > 0 && sx < W) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(sx, goalPlatform.y, goalPlatform.w, 20);
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(sx, goalPlatform.y - 6, goalPlatform.w, 6);

      // Korona szimbólum
      ctx.fillStyle = '#e74c3c';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👑', sx + goalPlatform.w / 2, goalPlatform.y - 20);
    }
  }
}

function drawTraps() {
  for (const t of traps) {
    const sx = t.x - cameraX;

    if (t.type === 'spikes') {
      // Szöges csapda
      ctx.fillStyle = '#7f8c8d';
      for (let i = 0; i < 3; i++) {
        const px = sx - 20 + i * 20;
        ctx.beginPath();
        ctx.moveTo(px - 6, t.y + 20);
        ctx.lineTo(px, t.y);
        ctx.lineTo(px + 6, t.y + 20);
        ctx.closePath();
        ctx.fill();
      }
    } else if (t.type === 'arrow') {
      t.timer++;
      if (t.timer >= t.interval) {
        t.active = true;
        if (t.timer > t.interval + 60) {
          t.active = false;
          t.timer = 0;
        }
      }

      if (t.active) {
        // Nyíl
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 10, t.y + 60);
        ctx.lineTo(sx + 10, t.y + 60);
        ctx.stroke();

        // Nyílhegy
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(sx + 12, t.y + 60);
        ctx.lineTo(sx + 8, t.y + 55);
        ctx.lineTo(sx + 8, t.y + 65);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawClimbObjects() {
  for (const c of climbObjects) {
    const sx = c.x - cameraX;
    if (sx + c.w < 0 || sx > W) continue;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(sx - c.w / 2, c.y, c.w, c.h);

    // Kötél csíkok
    ctx.strokeStyle = '#d4a96a';
    ctx.lineWidth = 2;
    for (let cy = c.y; cy < c.y + c.h; cy += 14) {
      ctx.beginPath();
      ctx.moveTo(sx - c.w / 2, cy);
      ctx.lineTo(sx + c.w / 2, cy);
      ctx.stroke();
    }
  }
}

// ─── Mozgó platformok update ──────────────────────────────────────────────────
function updateMovingPlatforms() {
  for (const mp of movingPlatforms) {
    mp.t += mp.speed;
    const dist = (mp.maxX - mp.minX) / 2;
    mp.x = mp.minX + dist + Math.sin(mp.t * 0.05) * dist * 0.6;
  }
}

// ─── Kamera ──────────────────────────────────────────────────────────────────
function updateCamera() {
  const targetCameraX = girl.x - W / 3;
  cameraX += (targetCameraX - cameraX) * 0.1;
  cameraX = Math.max(0, cameraX);
}

// ─── Game loop ───────────────────────────────────────────────────────────────
function loop() {
  if (state !== 'playing') return;
  frameCount++;

  drawBackground();
  drawPlatforms();
  drawClimbObjects();
  drawTraps();

  girl.update();
  girl.draw();

  if (invincible > 0) invincible--;

  updateMovingPlatforms();
  updateCamera();

  animId = requestAnimationFrame(loop);
}

// ─── Közös függvények ────────────────────────────────────────────────────────
function respawnGirl() {
  if (invincible > 0) return;

  lives--;
  elLives.textContent = lives;
  invincible = 120;
  GameUtils.playError();

  if (platforms.length > 0) {
    const lastPlat = platforms[platforms.length - 2] || platforms[0];
    girl.x = lastPlat.x + lastPlat.w / 2;
    girl.y = lastPlat.y - girl.h;
  } else {
    girl.x = 100;
    girl.y = 150;
  }

  girl.vy = 0;
  girl.onGround = true;

  if (lives <= 0) endGame();
}

function hit() {
  if (invincible > 0) return;
  lives--;
  elLives.textContent = lives;
  invincible = 100;
  GameUtils.playError();
  if (lives <= 0) endGame();
}

function levelComplete() {
  state = 'levelcomplete';
  cancelAnimationFrame(animId);
  GameUtils.playSuccess();
  setTimeout(() => {
    level++;
    elLevel.textContent = level;
    startGame();
  }, 1500);
}

function startGame() {
  cancelAnimationFrame(animId);

  lives = 3;
  frameCount = 0;
  invincible = 0;
  cameraX = 0;

  elLives.textContent = 3;
  elLevel.textContent = level;

  girl.reset();
  generateLevel();

  overlay.classList.add('hidden');
  state = 'playing';
  loop();
}

function endGame() {
  state = 'gameover';
  cancelAnimationFrame(animId);
  setTimeout(() => {
    showOverlay('👸', 'Játék vége!', `Eljutottál a ${level}. szintig!<br>Próbáld újra!`, 'Újra játszom');
  }, 400);
}

function showOverlay(emoji, title, sub, btnText) {
  document.getElementById('overlay-emoji').textContent = emoji;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').innerHTML = sub;
  btnAction.textContent = btnText;
  overlay.classList.remove('hidden');
}

btnAction.addEventListener('click', startGame);
showOverlay('🏰', 'Palota Kaland', 'Segítsd a kislányt a palotán keresztül!<br>Ugorj, mászsz, és kerüld a csapdákat!', 'Játék indítása');

window.addEventListener('keydown', e => {
  if (e.key === ' ' && state === 'idle') startGame();
  if (e.key === ' ' && state === 'gameover') {
    level = 1;
    elLevel.textContent = 1;
    startGame();
  }
});
