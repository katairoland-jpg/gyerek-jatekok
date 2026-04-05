// ─── Kislány kalandjai ───────────────────────────────────────────────────────

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const btnAction      = document.getElementById('action-btn');
const elLives = document.getElementById('lives');
const elScore = document.getElementById('score');
const elLevel = document.getElementById('level');

// ─── Konstansok ──────────────────────────────────────────────────────────────
const W = canvas.width;
const H = canvas.height;
const GROUND      = H - 60;   // talaj Y koordinátája
const GRAVITY     = 0.55;
const JUMP_FORCE  = -13;
const MOVE_SPEED  = 4.5;
const OBS_BASE_SPEED = 3.5;

// ─── Játék állapot ───────────────────────────────────────────────────────────
let state = 'idle';   // idle | playing | dead | gameover
let score = 0;
let lives = 3;
let level = 1;
let frameCount = 0;
let invincible = 0;   // beütés utáni sebezhetetlenségi keretek
let animId;

// ─── Billentyűk ──────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── Kislány ─────────────────────────────────────────────────────────────────
const girl = {
  x: 120, y: GROUND,
  vy: 0,
  onGround: true,
  ducking: false,
  walkFrame: 0,
  hitFlash: 0,

  get w()  { return 36; },
  get h()  { return this.ducking ? 38 : 68; },
  get top(){ return this.y - this.h; },

  reset() {
    this.x = 120; this.y = GROUND;
    this.vy = 0; this.onGround = true;
    this.ducking = false; this.walkFrame = 0;
  },

  update() {
    // Vízszintes mozgás
    if (keys['ArrowLeft']  && this.x > 20)               this.x -= MOVE_SPEED;
    if (keys['ArrowRight'] && this.x < W / 2 - 10)       this.x += MOVE_SPEED;

    // Guggolás
    this.ducking = keys['ArrowDown'] && this.onGround;

    // Ugrás
    if ((keys['ArrowUp'] || keys[' ']) && this.onGround && !this.ducking) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      GameUtils.playTone(520, 0.1);
    }

    // Gravitáció
    this.vy += GRAVITY;
    this.y  += this.vy;

    if (this.y >= GROUND) {
      this.y = GROUND;
      this.vy = 0;
      this.onGround = true;
    }

    // Animációs keret
    if (this.onGround && (keys['ArrowLeft'] || keys['ArrowRight'])) {
      if (frameCount % 8 === 0) this.walkFrame = (this.walkFrame + 1) % 4;
    } else {
      this.walkFrame = 0;
    }

    if (this.hitFlash > 0) this.hitFlash--;
  },

  draw() {
    ctx.save();
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    const x = this.x;
    const ground = this.y;
    const duck = this.ducking;

    if (duck) {
      drawGirlDucking(x, ground);
    } else {
      drawGirl(x, ground, this.walkFrame, this.vy < -2);
    }

    ctx.restore();
  },

  // Ütközési doboz
  bbox() {
    const margin = 6;
    return {
      x: this.x - this.w / 2 + margin,
      y: this.top + margin,
      w: this.w - margin * 2,
      h: this.h - margin
    };
  }
};

// ─── Kislány rajzolása ────────────────────────────────────────────────────────
function drawGirl(x, ground, walkFrame, jumping) {
  const py = ground;  // lábak alja

  // ---- Lábak ----
  const legOffsets = [[- 7, 0],[7, 0],[- 7, 5],[7, 5]];
  const lo = legOffsets[walkFrame];
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  // bal láb
  ctx.beginPath();
  ctx.moveTo(x - 8 + lo[0], py - 22);
  ctx.lineTo(x - 8 + lo[0], py);
  ctx.stroke();
  // jobb láb
  ctx.beginPath();
  ctx.moveTo(x + 8 - lo[0], py - 22);
  ctx.lineTo(x + 8 - lo[0], py + lo[1]);
  ctx.stroke();
  // cipők
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x - 8 + lo[0], py,     7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 8 - lo[0], py + lo[1], 7, 4, 0, 0, Math.PI * 2); ctx.fill();

  // ---- Szoknya / test ----
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.moveTo(x - 14, py - 22);
  ctx.lineTo(x + 14, py - 22);
  ctx.lineTo(x + 18, py - 40);
  ctx.lineTo(x - 18, py - 40);
  ctx.closePath();
  ctx.fill();

  // ---- Felső test ----
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x - 11, py - 58, 22, 20, 4);
  ctx.fill();

  // ---- Karok ----
  const armAngle = jumping ? -0.8 : (walkFrame % 2 === 0 ? 0.3 : -0.3);
  ctx.strokeStyle = '#fde3a7';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  // bal kar
  ctx.beginPath();
  ctx.moveTo(x - 11, py - 54);
  ctx.lineTo(x - 20, py - 54 + Math.sin(armAngle) * 16);
  ctx.stroke();
  // jobb kar
  ctx.beginPath();
  ctx.moveTo(x + 11, py - 54);
  ctx.lineTo(x + 20, py - 54 - Math.sin(armAngle) * 16);
  ctx.stroke();

  // ---- Fej ----
  ctx.fillStyle = '#fde3a7';
  ctx.beginPath();
  ctx.arc(x, py - 67, 13, 0, Math.PI * 2);
  ctx.fill();

  // ---- Haj ----
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.arc(x, py - 72, 13, Math.PI, 0);
  ctx.fill();
  // copfok
  ctx.beginPath();
  ctx.arc(x - 16, py - 68, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 16, py - 68, 6, 0, Math.PI * 2);
  ctx.fill();
  // piros szalagok
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x - 16, py - 68, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 16, py - 68, 4, 0, Math.PI * 2); ctx.fill();

  // ---- Arc ----
  // szemek
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x - 4, py - 67, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 4, py - 67, 2, 0, Math.PI * 2); ctx.fill();
  // mosoly
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, py - 64, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawGirlDucking(x, ground) {
  const py = ground;
  // test guggoló
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.ellipse(x, py - 18, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(x - 10, py - 34, 20, 14, 4);
  ctx.fill();

  // fej
  ctx.fillStyle = '#fde3a7';
  ctx.beginPath();
  ctx.arc(x + 10, py - 38, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.arc(x + 10, py - 42, 11, Math.PI, 0);
  ctx.fill();

  // copf jobbra nyúlik
  ctx.beginPath();
  ctx.arc(x + 24, py - 38, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x + 24, py - 38, 3, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x + 14, py - 38, 1.5, 0, Math.PI * 2); ctx.fill();

  // lábak
  ctx.strokeStyle = '#f5a623';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 5,  py - 6); ctx.lineTo(x - 18, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 5,  py - 6); ctx.lineTo(x + 18, py); ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x - 18, py, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 18, py, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
}

// ─── Akadályok ───────────────────────────────────────────────────────────────
let obstacles = [];
let nextObstacleIn = 90;

const OBSTACLE_TYPES = [
  {
    id: 'ko',
    w: 38, h: 30,
    yOffset: 0,   // alulról ennyi a magasság
    draw(ctx, x, y) {
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.ellipse(x, y - 15, 19, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#95a5a6';
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 20, 8, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  {
    id: 'bokor',
    w: 50, h: 48,
    yOffset: 0,
    draw(ctx, x, y) {
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(x - 4, y - 14, 8, 14);
      ctx.fillStyle = '#27ae60';
      ctx.beginPath(); ctx.arc(x,      y - 36, 18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 14, y - 28, 14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 14, y - 28, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(x,      y - 40, 10, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'madar',
    w: 44, h: 20,
    yOffset: 80,   // fent repül
    draw(ctx, x, y) {
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.quadraticCurveTo(x - 9, y - 10, x, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,      y); ctx.quadraticCurveTo(x +  9, y - 10, x + 18, y); ctx.stroke();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(x + 19, y - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
  },
  {
    id: 'keritas',
    w: 30, h: 52,
    yOffset: 0,
    draw(ctx, x, y) {
      ctx.fillStyle = '#d4a96a';
      for (let i = -1; i <= 1; i++) {
        const px = x + i * 14;
        ctx.beginPath();
        ctx.moveTo(px - 5, y);
        ctx.lineTo(px - 5, y - 44);
        ctx.lineTo(px,     y - 52);
        ctx.lineTo(px + 5, y - 44);
        ctx.lineTo(px + 5, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b8864e';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = '#d4a96a';
      ctx.fillRect(x - 20, y - 36, 40, 7);
      ctx.fillRect(x - 20, y - 20, 40, 7);
    }
  }
];

function spawnObstacle() {
  const type = GameUtils.pick(OBSTACLE_TYPES);
  obstacles.push({
    type,
    x: W + type.w,
    y: GROUND - type.yOffset,
    speed: OBS_BASE_SPEED + (level - 1) * 0.4 + Math.random() * 0.8
  });
}

function updateObstacles() {
  if (--nextObstacleIn <= 0) {
    spawnObstacle();
    const gap = Math.max(55, 110 - level * 7);
    nextObstacleIn = gap + Math.floor(Math.random() * 50);
  }
  for (const obs of obstacles) obs.x -= obs.speed;
  obstacles = obstacles.filter(o => o.x > -80);
}

// ─── Háttér ──────────────────────────────────────────────────────────────────
let bgOffset = 0;
const clouds = Array.from({length: 5}, (_, i) => ({
  x: 80 + i * 160, y: 30 + Math.random() * 50, r: 22 + Math.random() * 18, speed: 0.3 + Math.random() * 0.2
}));

function drawBg() {
  // Égbolt
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(1, '#d6f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Felhők
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r,      0, Math.PI * 2); ctx.fill();
    ctx.arc(c.x + c.r * 0.7, c.y + 6, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.arc(c.x - c.r * 0.6, c.y + 8, c.r * 0.6, 0, Math.PI * 2); ctx.fill();
    c.x -= c.speed;
    if (c.x < -80) c.x = W + 80;
  }

  // Talaj
  ctx.fillStyle = '#5dbb63';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(0, GROUND, W, 6);

  // Fűcsíkok
  ctx.strokeStyle = '#388e3c';
  ctx.lineWidth = 2;
  bgOffset = (bgOffset + 1.5) % 40;
  for (let gx = -bgOffset; gx < W; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx,     GROUND + 3);
    ctx.lineTo(gx + 6, GROUND - 4);
    ctx.lineTo(gx + 12, GROUND + 3);
    ctx.stroke();
  }
}

// ─── Ütközés ──────────────────────────────────────────────────────────────────
function checkCollisions() {
  if (invincible > 0) return;
  const gb = girl.bbox();
  for (const obs of obstacles) {
    const ob = {
      x: obs.x - obs.type.w / 2 + 6,
      y: obs.y - obs.type.h + 6,
      w: obs.type.w - 12,
      h: obs.type.h - 6
    };
    if (
      gb.x < ob.x + ob.w &&
      gb.x + gb.w > ob.x &&
      gb.y < ob.y + ob.h &&
      gb.y + gb.h > ob.y
    ) {
      hit();
      return;
    }
  }
}

function hit() {
  lives--;
  elLives.textContent = lives;
  invincible = 90;
  GameUtils.playError();
  if (lives <= 0) {
    endGame();
  }
}

// ─── Pontszám / szint ────────────────────────────────────────────────────────
function updateScore() {
  if (frameCount % 6 === 0) {
    score++;
    elScore.textContent = score;
    const newLevel = Math.floor(score / 80) + 1;
    if (newLevel !== level) {
      level = newLevel;
      elLevel.textContent = level;
      GameUtils.playTone(660, 0.2);
    }
  }
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  if (state !== 'playing') return;
  frameCount++;

  drawBg();

  updateObstacles();
  for (const obs of obstacles) {
    ctx.save();
    obs.type.draw(ctx, obs.x, obs.y);
    ctx.restore();
  }

  girl.update();
  checkCollisions();
  girl.draw();

  if (invincible > 0) invincible--;
  updateScore();

  animId = requestAnimationFrame(loop);
}

// ─── Overlay kezelés ─────────────────────────────────────────────────────────
function showOverlay(emoji, title, sub, btnText) {
  document.getElementById('overlay-emoji').textContent = emoji;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').innerHTML = sub;
  btnAction.textContent = btnText;
  overlay.classList.remove('hidden');
}

function startGame() {
  cancelAnimationFrame(animId);
  score = 0; lives = 3; level = 1; frameCount = 0; invincible = 0;
  obstacles = []; nextObstacleIn = 90;
  elScore.textContent = 0;
  elLives.textContent = 3;
  elLevel.textContent = 1;
  girl.reset();
  overlay.classList.add('hidden');
  state = 'playing';
  loop();
}

function endGame() {
  state = 'gameover';
  cancelAnimationFrame(animId);
  setTimeout(() => {
    showOverlay('😢', 'Játék vége!', `Elértél <strong>${score}</strong> pontot!<br>Próbáld újra!`, 'Újra játszom');
  }, 400);
}

btnAction.addEventListener('click', startGame);

// Kezdeti overlay
showOverlay('🌟', 'Kislány kalandjai', 'Nyilakkal irányítsd a kislányt,<br>kerüld el az akadályokat!', 'Játék indítása');

// Szóközzel is indítható
window.addEventListener('keydown', e => {
  if (e.key === ' ' && state === 'idle') startGame();
  if (e.key === ' ' && state === 'gameover') startGame();
});
