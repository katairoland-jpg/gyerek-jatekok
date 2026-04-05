// ═══════════════════════════════════════════════════════════════════════════
//  Kislány kalandjai — Kamera-követős platformer, végtelenül scrollozó világ
// ═══════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const settingsOverlay = document.getElementById('settings-overlay');
const btnAction = document.getElementById('action-btn');
const btnSettingsStart = document.getElementById('settings-start-btn');
const elLives = document.getElementById('lives');
const elScore = document.getElementById('score');
const elLevel = document.getElementById('level');

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const WALK_SPEED = 5;
const CLIMB_SPEED = 2.5;

// ─── Beállítások ────────────────────────────────────────────────────────────
const settings = {
  world: '1',
  difficulty: 'normal',
  obstacles: 'all'
};

let difficultyMultiplier = 1.0;
let worldType = 1;  // 1=rét, 2=erdő

// ─── Játék állapot ───────────────────────────────────────────────────────────
let state = 'idle';
let score = 0;
let lives = 3;
let level = 1;
let frameCount = 0;
let invincible = 0;
let cameraX = 0;  // kamera pozíciója

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
    const prevOnGround = this.onGround;

    // Horizontális mozgás
    this.vx = 0;
    if (keys['ArrowLeft']) this.vx = -WALK_SPEED;
    if (keys['ArrowRight']) this.vx = WALK_SPEED;
    this.x += this.vx;

    // Kletternél már nem mozgunk vízszintesen így
    if (!this.onClimb) {
      // Normál platformer fizika
      if ((keys['ArrowUp'] || keys[' ']) && this.onGround) {
        this.vy = JUMP_FORCE;
        this.onGround = false;
        GameUtils.playTone(520, 0.1);
      }

      this.vy += GRAVITY;
      this.y += this.vy;

      // Talajhoz ütközés
      const groundY = getGroundAt(this.x);
      if (this.y >= groundY && prevY <= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      } else if (this.y > groundY) {
        this.y = groundY;
        this.vy = 0;
        this.onGround = true;
      }
    } else {
      // Kletterben
      this.vy = 0;
      if (keys['ArrowUp']) this.y -= CLIMB_SPEED;
      if (keys['ArrowDown']) this.y += CLIMB_SPEED;

      // Kilépni a kletterből
      if (keys['ArrowLeft'] || keys['ArrowRight']) {
        this.onClimb = false;
        this.vy = 0;
      }
    }

    // Platformokra ütközés ellenőrzése
    checkPlatformCollisions(this, prevY);

    // Mászható objektumokra
    checkClimbCollisions(this);

    // Akadályokra
    checkObstacleCollisions(this);

    // Animáció
    if (this.vx !== 0 && this.onGround) {
      if (frameCount % 8 === 0) this.walkFrame = (this.walkFrame + 1) % 4;
    } else {
      this.walkFrame = 0;
    }

    // Ha lezuhant a térképről
    if (this.y > H + 100) {
      hit();
      this.y = 150;
      this.onGround = true;
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
    return {
      x: this.x - this.w / 2 + m,
      y: this.top + m,
      w: this.w - m * 2,
      h: this.h - m
    };
  }
};

// ─── Lány rajzolása ──────────────────────────────────────────────────────────
function drawGirl(x, ground, walkFrame, jumping, facingLeft) {
  const py = ground;
  const dir = facingLeft ? -1 : 1;

  const lo = [[-7, 0], [7, 0], [-7, 5], [7, 5]][walkFrame];

  // Lábak
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 8 * dir + lo[0] * dir, py - 22);
  ctx.lineTo(x - 8 * dir + lo[0] * dir, py);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 8 * dir - lo[0] * dir, py - 22);
  ctx.lineTo(x + 8 * dir - lo[0] * dir, py + lo[1]);
  ctx.stroke();

  // Cipők
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.ellipse(x - 8 * dir + lo[0] * dir, py, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 8 * dir - lo[0] * dir, py + lo[1], 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Szoknya
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(x - 14 * dir, py - 22);
  ctx.lineTo(x + 14 * dir, py - 22);
  ctx.lineTo(x + 18 * dir, py - 40);
  ctx.lineTo(x - 18 * dir, py - 40);
  ctx.closePath();
  ctx.fill();

  // Felső test
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x - 11 * dir, py - 58, 22 * dir, 20, 4);
  ctx.fill();

  // Karok
  const armAngle = jumping ? -0.8 : (walkFrame % 2 === 0 ? 0.3 : -0.3);
  ctx.strokeStyle = '#fde3a7';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 11 * dir, py - 54);
  ctx.lineTo(x - 20 * dir, py - 54 + Math.sin(armAngle) * 16 * dir);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 11 * dir, py - 54);
  ctx.lineTo(x + 20 * dir, py - 54 - Math.sin(armAngle) * 16 * dir);
  ctx.stroke();

  // Fej
  ctx.fillStyle = '#fde3a7';
  ctx.beginPath();
  ctx.arc(x, py - 67, 13, 0, Math.PI * 2);
  ctx.fill();

  // Haj
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.arc(x, py - 72, 13, Math.PI, 0);
  ctx.fill();

  // Copfok
  ctx.beginPath();
  ctx.arc(x - 16 * dir, py - 68, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16 * dir, py - 68, 6, 0, Math.PI * 2);
  ctx.fill();

  // Szalagok
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(x - 16 * dir, py - 68, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16 * dir, py - 68, 4, 0, Math.PI * 2);
  ctx.fill();

  // Arc
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x - 4 * dir, py - 67, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 4 * dir, py - 67, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, py - 64, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawGirlClimbing(x, y) {
  const py = y;

  // Test felülről nézve
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.roundRect(x - 10, py - 48, 20, 28, 4);
  ctx.fill();

  // Kar fel
  ctx.strokeStyle = '#fde3a7';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10, py - 40);
  ctx.lineTo(x - 18, py - 58);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 10, py - 40);
  ctx.lineTo(x + 18, py - 58);
  ctx.stroke();

  // Fej
  ctx.fillStyle = '#fde3a7';
  ctx.beginPath();
  ctx.arc(x, py - 60, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.arc(x, py - 65, 10, Math.PI, 0);
  ctx.fill();

  // Szemek
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x - 3, py - 60, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 3, py - 60, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Platformok ──────────────────────────────────────────────────────────────
let platforms = [];
let obstacles = [];
let climbObjects = [];
let nextSpawnX = 0;

function generateLevel() {
  platforms = [];
  obstacles = [];
  climbObjects = [];
  nextSpawnX = 200;

  // Kezdeti platform
  platforms.push({ x: 0, y: 180, w: 200 });

  // Előre generálunk
  for (let i = 0; i < 30; i++) {
    spawnNextSection();
  }
}

function spawnNextSection() {
  const gap = 80 + Math.random() * 80;
  const x = nextSpawnX + gap;
  const w = 80 + Math.random() * 120;
  const y = 140 + Math.random() * 120;

  platforms.push({ x, y, w });

  // Akadályok
  if (Math.random() < 0.4) {
    const obsX = x + w / 2;
    const obsY = y - 60;
    const obsType = spawnObstacle(obsX, obsY);
  }

  // Mászható falak
  if (Math.random() < 0.35 && settings.obstacles === 'all') {
    climbObjects.push({
      x: x + w / 2,
      y: y - 100,
      w: 24,
      h: 80
    });
  }

  nextSpawnX = x + w;
}

function spawnObstacle(x, y) {
  let types = [];
  if (settings.obstacles !== 'birds') types.push('ground');
  if (settings.obstacles !== 'ground') types.push('bird');

  if (types.length === 0) types = ['ground', 'bird'];

  const type = GameUtils.pick(types);
  const speed = (2 + Math.random() * 1.5) * difficultyMultiplier;

  if (type === 'ground') {
    obstacles.push({ type: 'rock', x, y, w: 35, h: 25, speed });
  } else {
    obstacles.push({ type: 'bird', x, y, vx: -speed });
  }
}

function getGroundAt(x) {
  for (const p of platforms) {
    if (x > p.x - 20 && x < p.x + p.w + 20) {
      return p.y;
    }
  }
  return H + 50;  // Nem lezuhani egyből
}

function checkPlatformCollisions(g, prevY) {
  const gb = g.bbox();
  for (const p of platforms) {
    if (gb.x + gb.w < p.x || gb.x > p.x + p.w) continue;

    if (prevY + g.h <= p.y + 5 && g.y + g.h >= p.y && g.vy >= 0) {
      g.y = p.y - g.h;
      g.vy = 0;
      g.onGround = true;
      return;
    }
  }
  g.onGround = false;
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

function checkObstacleCollisions(g) {
  if (invincible > 0) return;

  const gb = g.bbox();
  for (const o of obstacles) {
    let hit = false;

    if (o.type === 'rock') {
      if (gb.x < o.x + o.w && gb.x + gb.w > o.x &&
          gb.y < o.y + o.h && gb.y + gb.h > o.y) {
        hit = true;
      }
    } else if (o.type === 'bird') {
      if (gb.x < o.x + 20 && gb.x + gb.w > o.x - 20 &&
          gb.y < o.y + 12 && gb.y + gb.h > o.y - 12) {
        hit = true;
      }
    }

    if (hit) {
      hit();
      return;
    }
  }
}

// ─── Háttér rajzolása ────────────────────────────────────────────────────────
function drawBackground() {
  if (worldType === 1) {
    drawBgMeadow();
  } else {
    drawBgForest();
  }
}

function drawBgMeadow() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(1, '#d6f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Felhők parallax
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let cx = -cameraX * 0.2 % 300; cx < W; cx += 300) {
    ctx.beginPath();
    ctx.arc(cx, 40, 25, 0, Math.PI * 2);
    ctx.arc(cx + 35, 50, 20, 0, Math.PI * 2);
    ctx.arc(cx - 35, 50, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBgForest() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1b5e20');
  sky.addColorStop(1, '#4caf50');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Háttérfák
  ctx.fillStyle = '#1a3a1a';
  for (let tx = -cameraX * 0.4 % 400; tx < W + 400; tx += 400) {
    ctx.beginPath();
    ctx.arc(tx, 80, 40, 0, Math.PI * 2);
    ctx.arc(tx - 50, 110, 30, 0, Math.PI * 2);
    ctx.arc(tx + 50, 110, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Platformok rajzolása ────────────────────────────────────────────────────
function drawPlatforms() {
  for (const p of platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < 0 || sx > W) continue;

    // Platform
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(sx, p.y, p.w, 20);

    // Fű teteje
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(sx, p.y - 6, p.w, 6);

    // Dekoráció
    ctx.fillStyle = '#2e7d32';
    for (let gx = sx + 20; gx < sx + p.w; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, p.y);
      ctx.lineTo(gx - 4, p.y - 8);
      ctx.lineTo(gx + 8, p.y - 4);
      ctx.stroke();
    }
  }
}

// ─── Akadályok rajzolása ─────────────────────────────────────────────────────
function drawObstacles() {
  for (const o of obstacles) {
    const sx = o.x - cameraX;
    if (sx + 40 < 0 || sx > W) continue;

    if (o.type === 'rock') {
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.ellipse(sx, o.y, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#95a5a6';
      ctx.beginPath();
      ctx.ellipse(sx - 4, o.y - 8, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.type === 'bird') {
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx - 14, o.y);
      ctx.quadraticCurveTo(sx - 7, o.y - 8, sx, o.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, o.y);
      ctx.quadraticCurveTo(sx + 7, o.y - 8, sx + 14, o.y);
      ctx.stroke();

      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(sx + 15, o.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── Mászható falak ──────────────────────────────────────────────────────────
function drawClimbObjects() {
  for (const c of climbObjects) {
    const sx = c.x - cameraX;
    if (sx + c.w < 0 || sx > W) continue;

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(sx - c.w / 2, c.y, c.w, c.h);

    // Kötél csíkok
    ctx.strokeStyle = '#d4a96a';
    ctx.lineWidth = 2;
    for (let cy = c.y; cy < c.y + c.h; cy += 16) {
      ctx.beginPath();
      ctx.moveTo(sx - c.w / 2, cy);
      ctx.lineTo(sx + c.w / 2, cy);
      ctx.stroke();
    }
  }
}

// ─── Kamera követés ──────────────────────────────────────────────────────────
function updateCamera() {
  const targetCameraX = girl.x - W / 3;
  cameraX += (targetCameraX - cameraX) * 0.1;  // smooth
  cameraX = Math.max(0, cameraX);
}

// ─── Game loop ───────────────────────────────────────────────────────────────
function loop() {
  if (state !== 'playing') return;
  frameCount++;

  // Világ generálása ha szükséges
  while (nextSpawnX < cameraX + W + 500) {
    spawnNextSection();
  }

  // Rajzolás
  drawBackground();
  drawPlatforms();
  drawClimbObjects();
  drawObstacles();

  girl.update();
  girl.draw();

  if (invincible > 0) invincible--;

  updateScore();
  updateCamera();

  animId = requestAnimationFrame(loop);
}

// ─── Közös függvények ────────────────────────────────────────────────────────
function hit() {
  if (invincible > 0) return;
  lives--;
  elLives.textContent = lives;
  invincible = 100;
  GameUtils.playError();
  if (lives <= 0) endGame();
}

function updateScore() {
  if (frameCount % 6 === 0) {
    score++;
    elScore.textContent = score;
    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel !== level) {
      level = newLevel;
      elLevel.textContent = level;
      GameUtils.playTone(660, 0.2);
    }
  }
}

function applyDifficulty() {
  switch (settings.difficulty) {
    case 'easy':
      difficultyMultiplier = 0.6;
      break;
    case 'normal':
      difficultyMultiplier = 1.0;
      break;
    case 'hard':
      difficultyMultiplier = 1.5;
      break;
  }
}

function startGame() {
  cancelAnimationFrame(animId);

  // Beállítások alkalmazása
  if (settings.world === 'random') {
    worldType = Math.random() < 0.5 ? 1 : 2;
  } else {
    worldType = parseInt(settings.world);
  }

  applyDifficulty();

  score = 0;
  lives = 3;
  level = 1;
  frameCount = 0;
  invincible = 0;
  cameraX = 0;

  elScore.textContent = 0;
  elLives.textContent = 3;
  elLevel.textContent = 1;

  girl.reset();
  generateLevel();

  settingsOverlay.classList.add('hidden');
  overlay.classList.add('hidden');
  state = 'playing';
  loop();
}

function endGame() {
  state = 'gameover';
  cancelAnimationFrame(animId);
  setTimeout(() => {
    showOverlay('😢', 'Játék vége!', `Elértél <strong>${score}</strong> pontot!<br>Világod: ${worldType === 1 ? '🌾 Rét' : '🌲 Erdő'}<br>Próbáld újra!`, 'Beállítások');
  }, 400);
}

function showOverlay(emoji, title, sub, btnText) {
  document.getElementById('overlay-emoji').textContent = emoji;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').innerHTML = sub;
  btnAction.textContent = btnText;
  overlay.classList.remove('hidden');
}

// ─── Beállítások UI ──────────────────────────────────────────────────────────
btnAction.addEventListener('click', () => {
  overlay.classList.add('hidden');
  settingsOverlay.classList.remove('hidden');
});

btnSettingsStart.addEventListener('click', startGame);

document.querySelectorAll('.btn-option').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const setting = e.target.dataset.setting;
    const value = e.target.dataset.value;

    document.querySelectorAll(`.btn-option[data-setting="${setting}"]`).forEach(b => {
      b.classList.remove('active');
    });

    e.target.classList.add('active');
    settings[setting] = value;
  });
});

showOverlay('🌟', 'Kislány kalandjai', 'Nyilakkal irányítsd a kislányt,<br>ugorj platformokról platformra!', 'Beállítások');

window.addEventListener('keydown', e => {
  if (e.key === ' ' && state === 'idle') {
    overlay.classList.add('hidden');
    settingsOverlay.classList.remove('hidden');
  }
  if (e.key === ' ' && state === 'gameover') {
    overlay.classList.remove('hidden');
    settingsOverlay.classList.add('hidden');
    state = 'idle';
  }
});
