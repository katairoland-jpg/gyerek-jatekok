// ═══════════════════════════════════════════════════════════════════════════
//  Kislány kalandjai — két világgal
//  Világ 1: réti futás, akadályok elkerülése (1 perc)
//  Világ 2: erdő, szigetről szigetre ugrálás víz felett
// ═══════════════════════════════════════════════════════════════════════════

const canvas    = document.getElementById('gameCanvas');
const ctx       = canvas.getContext('2d');
const overlay   = document.getElementById('overlay');
const settingsOverlay = document.getElementById('settings-overlay');
const btnAction = document.getElementById('action-btn');
const btnSettingsStart = document.getElementById('settings-start-btn');
const elLives   = document.getElementById('lives');
const elScore   = document.getElementById('score');
const elLevel   = document.getElementById('level');

// ─── Beállítások ────────────────────────────────────────────────────────────
const settings = {
  world: 1,       // 1, 2, random
  difficulty: 'normal',  // easy, normal, hard
  obstacles: 'all'  // all, birds, ground
};

let difficultyMultiplier = 1.0;

// ─── Konstansok ─────────────────────────────────────────────────────────────
const W            = canvas.width;
const H            = canvas.height;
const GROUND       = H - 60;
const GRAVITY      = 0.55;
const JUMP_FORCE   = -13;
const MOVE_SPEED   = 4.5;
const ENV1_FRAMES  = 60 * 60;   // 1 perc @ 60fps → átmenet

// ─── Játék állapot ───────────────────────────────────────────────────────────
let state       = 'idle';   // idle | playing | transitioning | gameover
let score       = 0;
let lives       = 3;
let level       = 1;
let frameCount  = 0;
let envFrames   = 0;        // keretek a jelenlegi világban
let environment = 1;        // 1 = rét, 2 = erdő
let invincible  = 0;
let animId;

// ─── Billentyűk ──────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── Kislány ─────────────────────────────────────────────────────────────────
const girl = {
  x: 120, y: GROUND,
  vy: 0,
  onGround: true,
  ducking: false,
  walkFrame: 0,

  get w()   { return 36; },
  get h()   { return this.ducking ? 38 : 68; },
  get top() { return this.y - this.h; },

  reset(env) {
    this.x       = env === 2 ? 110 : 120;
    this.y       = GROUND;
    this.vy      = 0;
    this.onGround = true;
    this.ducking  = false;
    this.walkFrame = 0;
  },

  update() {
    const maxRight = environment === 2 ? W - 20 : W / 2 - 10;

    if (keys['ArrowLeft']  && this.x > 20)        this.x -= MOVE_SPEED;
    if (keys['ArrowRight'] && this.x < maxRight)  this.x += MOVE_SPEED;

    this.ducking = environment === 1 && keys['ArrowDown'] && this.onGround;

    if ((keys['ArrowUp'] || keys[' ']) && this.onGround && !this.ducking) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      GameUtils.playTone(520, 0.1);
    }

    const prevY = this.y;
    this.vy += GRAVITY;
    this.y  += this.vy;

    if (environment === 1) {
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.onGround = true; }
    } else {
      this.onGround = false;
      landOnPlatform(this, prevY);
      if (this.y > H + 20 && !this.onGround) {
        hit();
        respawnOnPlatform();
      }
    }

    if (this.onGround && (keys['ArrowLeft'] || keys['ArrowRight'])) {
      if (frameCount % 8 === 0) this.walkFrame = (this.walkFrame + 1) % 4;
    } else {
      this.walkFrame = 0;
    }
  },

  draw() {
    ctx.save();
    if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) ctx.globalAlpha = 0.35;
    if (this.ducking) drawGirlDucking(this.x, this.y);
    else              drawGirl(this.x, this.y, this.walkFrame, this.vy < -2);
    ctx.restore();
  },

  bbox() {
    const m = 6;
    return { x: this.x - this.w/2 + m, y: this.top + m, w: this.w - m*2, h: this.h - m };
  }
};

// ─── Kislány rajzolása ────────────────────────────────────────────────────────
function drawGirl(x, ground, walkFrame, jumping) {
  const py = ground;
  const lo = [[-7,0],[7,0],[-7,5],[7,5]][walkFrame];
  ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x-8+lo[0], py-22); ctx.lineTo(x-8+lo[0], py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+8-lo[0], py-22); ctx.lineTo(x+8-lo[0], py+lo[1]); ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x-8+lo[0], py,      7, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+8-lo[0], py+lo[1], 7, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.moveTo(x-14,py-22); ctx.lineTo(x+14,py-22); ctx.lineTo(x+18,py-40); ctx.lineTo(x-18,py-40); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x-11, py-58, 22, 20, 4); ctx.fill();
  const armAngle = jumping ? -0.8 : (walkFrame%2===0 ? 0.3 : -0.3);
  ctx.strokeStyle = '#fde3a7'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x-11, py-54); ctx.lineTo(x-20, py-54+Math.sin(armAngle)*16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+11, py-54); ctx.lineTo(x+20, py-54-Math.sin(armAngle)*16); ctx.stroke();
  ctx.fillStyle = '#fde3a7'; ctx.beginPath(); ctx.arc(x, py-67, 13, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#8B4513';
  ctx.beginPath(); ctx.arc(x,    py-72, 13, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(x-16, py-68,  6, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+16, py-68,  6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath(); ctx.arc(x-16, py-68, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+16, py-68, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x-4, py-67, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+4, py-67, 2, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, py-64, 4, 0.2, Math.PI-0.2); ctx.stroke();
}

function drawGirlDucking(x, ground) {
  const py = ground;
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.ellipse(x, py-18, 20, 16, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';    ctx.beginPath(); ctx.roundRect(x-10, py-34, 20, 14, 4); ctx.fill();
  ctx.fillStyle = '#fde3a7'; ctx.beginPath(); ctx.arc(x+10, py-38, 11, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.arc(x+10, py-42, 11, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(x+24, py-38, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x+24, py-38, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#333';    ctx.beginPath(); ctx.arc(x+14, py-38, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f5a623'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x-5, py-6); ctx.lineTo(x-18, py); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+5, py-6); ctx.lineTo(x+18, py); ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.ellipse(x-18, py, 7, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+18, py, 7, 4, 0, 0, Math.PI*2); ctx.fill();
}

// ════════════════════════════════════════════════════════════════════════════
//  VILÁG 1 — Rét
// ════════════════════════════════════════════════════════════════════════════

let obstacles      = [];
let nextObstacleIn = 90;

const OBSTACLE_TYPES = [
  {
    id:'ko', w:38, h:30, yOffset:0,
    draw(ctx,x,y){
      ctx.fillStyle='#7f8c8d'; ctx.beginPath(); ctx.ellipse(x,y-15,19,15,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#95a5a6'; ctx.beginPath(); ctx.ellipse(x-4,y-20,8,6,-0.3,0,Math.PI*2); ctx.fill();
    }
  },
  {
    id:'bokor', w:50, h:48, yOffset:0,
    draw(ctx,x,y){
      ctx.fillStyle='#6b4226'; ctx.fillRect(x-4,y-14,8,14);
      ctx.fillStyle='#27ae60';
      ctx.beginPath(); ctx.arc(x,   y-36,18,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x-14,y-28,14,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+14,y-28,14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2ecc71'; ctx.beginPath(); ctx.arc(x,y-40,10,0,Math.PI*2); ctx.fill();
    }
  },
  {
    id:'madar', w:44, h:20, yOffset:80,
    draw(ctx,x,y){
      ctx.strokeStyle='#2c3e50'; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x-18,y); ctx.quadraticCurveTo(x-9,y-10,x,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y);    ctx.quadraticCurveTo(x+9,y-10,x+18,y); ctx.stroke();
      ctx.fillStyle='#e74c3c'; ctx.beginPath(); ctx.arc(x+19,y-2,3,0,Math.PI*2); ctx.fill();
    }
  },
  {
    id:'keritas', w:30, h:52, yOffset:0,
    draw(ctx,x,y){
      ctx.fillStyle='#d4a96a';
      for(let i=-1;i<=1;i++){
        const px=x+i*14;
        ctx.beginPath(); ctx.moveTo(px-5,y); ctx.lineTo(px-5,y-44); ctx.lineTo(px,y-52); ctx.lineTo(px+5,y-44); ctx.lineTo(px+5,y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#b8864e'; ctx.lineWidth=1; ctx.stroke();
      }
      ctx.fillStyle='#d4a96a'; ctx.fillRect(x-20,y-36,40,7); ctx.fillRect(x-20,y-20,40,7);
    }
  }
];

function spawnObstacle() {
  let availableTypes = OBSTACLE_TYPES;
  if (settings.obstacles === 'birds') {
    availableTypes = OBSTACLE_TYPES.filter(t => t.id === 'madar');
  } else if (settings.obstacles === 'ground') {
    availableTypes = OBSTACLE_TYPES.filter(t => t.id !== 'madar');
  }

  if (availableTypes.length === 0) availableTypes = OBSTACLE_TYPES;
  const type = GameUtils.pick(availableTypes);
  const baseSpeed = 3.5 + (level-1)*0.4 + Math.random()*0.8;
  const speed = baseSpeed * difficultyMultiplier;
  obstacles.push({ type, x: W + type.w, y: GROUND - type.yOffset, speed });
}

function updateObstacles() {
  if (--nextObstacleIn <= 0) {
    spawnObstacle();
    nextObstacleIn = Math.max(55, 110 - level*7) + Math.floor(Math.random()*50);
  }
  for (const o of obstacles) o.x -= o.speed;
  obstacles = obstacles.filter(o => o.x > -80);
}

let bgOffset = 0;
const clouds = Array.from({length:5}, (_,i) => ({
  x: 80+i*160, y: 30+Math.random()*50, r: 22+Math.random()*18, speed: 0.3+Math.random()*0.2
}));

function drawBg1() {
  const sky = ctx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0,'#87ceeb'); sky.addColorStop(1,'#d6f0ff');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill();
    ctx.arc(c.x+c.r*0.7,c.y+6,c.r*0.7,0,Math.PI*2); ctx.fill();
    ctx.arc(c.x-c.r*0.6,c.y+8,c.r*0.6,0,Math.PI*2); ctx.fill();
    c.x -= c.speed; if(c.x < -80) c.x = W+80;
  }

  ctx.fillStyle = '#5dbb63'; ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.fillStyle = '#4caf50'; ctx.fillRect(0,GROUND,W,6);

  ctx.strokeStyle = '#388e3c'; ctx.lineWidth = 2;
  bgOffset = (bgOffset + 1.5) % 40;
  for (let gx=-bgOffset; gx<W; gx+=40) {
    ctx.beginPath(); ctx.moveTo(gx,GROUND+3); ctx.lineTo(gx+6,GROUND-4); ctx.lineTo(gx+12,GROUND+3); ctx.stroke();
  }
}

function checkObstacleCollisions() {
  if (invincible > 0) return;
  const gb = girl.bbox();
  for (const obs of obstacles) {
    const ob = { x: obs.x-obs.type.w/2+6, y: obs.y-obs.type.h+6, w: obs.type.w-12, h: obs.type.h-6 };
    if (gb.x < ob.x+ob.w && gb.x+gb.w > ob.x && gb.y < ob.y+ob.h && gb.y+gb.h > ob.y) { hit(); return; }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  VILÁG 2 — Erdő / Víz
// ════════════════════════════════════════════════════════════════════════════

let platforms      = [];
let nextPlatX      = 0;   // a következő platform X pozíciója
let waterOffset    = 0;
let forestBirds    = [];
let nextBirdIn     = 180;

// Háttérfák (parallax)
const bgTrees = Array.from({length: 14}, (_,i) => ({
  x: i * 60 + Math.random()*30,
  h: 90 + Math.random()*80,
  w: 18 + Math.random()*14,
  dark: Math.random() < 0.4,
  speed: 0.6 + Math.random()*0.3
}));

function initEnv2() {
  platforms = [];
  forestBirds = [];
  nextBirdIn = 180;
  // Első nagy induló sziget
  platforms.push({ x: 0, y: GROUND, w: 200 });
  // Pár előre generált platform
  let curX = 220;
  for (let i = 0; i < 6; i++) {
    const w = 90 + Math.random()*90;
    platforms.push({ x: curX, y: GROUND, w });
    curX += w + 100 + Math.random()*60;
  }
  nextPlatX = curX;
  girl.reset(2);
  girl.x = 100;
  girl.y = GROUND;
}

function getPlatSpeed() {
  const baseSpeed = 2.2 + (level - 1) * 0.3;
  return baseSpeed * difficultyMultiplier;
}

function updatePlatforms() {
  const spd = getPlatSpeed();

  // Mozgasd a platformokat
  for (const p of platforms) p.x -= spd;
  nextPlatX -= spd;

  // Töröld a képernyőn kívülieket
  platforms = platforms.filter(p => p.x + p.w > -20);

  // Generálj újakat
  while (nextPlatX < W + 300) {
    const w = 90 + Math.random()*100;
    platforms.push({ x: nextPlatX, y: GROUND, w });
    nextPlatX += w + 100 + Math.random()*70;
  }
}

function landOnPlatform(g, prevY) {
  for (const p of platforms) {
    if (g.x + 14 < p.x + 4 || g.x - 14 > p.x + p.w - 4) continue;
    if (prevY <= p.y + 2 && g.y >= p.y && g.vy >= 0) {
      g.y = p.y;
      g.vy = 0;
      g.onGround = true;
      return;
    }
  }
}

function respawnOnPlatform() {
  invincible = 100;
  const visible = platforms.filter(p => p.x > 30 && p.x < W * 0.6);
  if (visible.length > 0) {
    const p = visible.reduce((a,b) => a.x < b.x ? a : b);
    girl.x = p.x + p.w / 2;
    girl.y = p.y;
  } else {
    girl.x = 80; girl.y = GROUND;
  }
  girl.vy = 0; girl.onGround = true;
}

function spawnForestBird() {
  forestBirds.push({
    x: W + 30,
    y: GROUND - 80 - Math.random() * 60,
    speed: 2.5 + Math.random() * 1.5
  });
}

function updateForestBirds() {
  if (--nextBirdIn <= 0) {
    spawnForestBird();
    nextBirdIn = 140 + Math.floor(Math.random() * 100);
  }
  for (const b of forestBirds) b.x -= b.speed;
  forestBirds = forestBirds.filter(b => b.x > -50);
}

function checkBirdCollisions() {
  if (invincible > 0) return;
  const gb = girl.bbox();
  for (const b of forestBirds) {
    if (gb.x < b.x+20 && gb.x+gb.w > b.x-20 && gb.y < b.y+12 && gb.y+gb.h > b.y-12) {
      hit();
      return;
    }
  }
}

function drawIsland(p) {
  const cx = p.x + p.w / 2;
  // Föld
  ctx.fillStyle = '#5d4037';
  ctx.beginPath(); ctx.ellipse(cx, p.y + 14, p.w/2 + 4, 14, 0, 0, Math.PI*2); ctx.fill();
  // Fű
  ctx.fillStyle = '#388e3c';
  ctx.beginPath(); ctx.ellipse(cx, p.y, p.w/2 + 2, 9, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#4caf50';
  ctx.beginPath(); ctx.ellipse(cx, p.y - 3, p.w/2, 7, 0, 0, Math.PI*2); ctx.fill();
  // Fűcsíkok
  ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 2;
  for (let gx = p.x + 12; gx < p.x + p.w - 12; gx += 18) {
    ctx.beginPath(); ctx.moveTo(gx,   p.y - 3); ctx.lineTo(gx - 4, p.y - 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx+6, p.y - 3); ctx.lineTo(gx + 10, p.y - 10); ctx.stroke();
  }
  // Kis fa a szigeten (csak ha elég széles)
  if (p.w > 130) {
    const tx = p.x + p.w * 0.72;
    drawSmallTree(tx, p.y);
  }
}

function drawSmallTree(x, ground) {
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(x - 4, ground - 42, 8, 42);
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath(); ctx.arc(x,    ground-52, 18, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x-10, ground-44, 13, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+10, ground-44, 13, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#388e3c';
  ctx.beginPath(); ctx.arc(x, ground-58, 11, 0, Math.PI*2); ctx.fill();
}

function drawBird2(b) {
  ctx.strokeStyle = '#1a237e'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(b.x-14,b.y); ctx.quadraticCurveTo(b.x-7,b.y-8,b.x,b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x,   b.y); ctx.quadraticCurveTo(b.x+7,b.y-8,b.x+14,b.y); ctx.stroke();
}

function drawBg2() {
  // Égbolt - erdős
  const sky = ctx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0, '#1b5e20');
  sky.addColorStop(0.5,'#388e3c');
  sky.addColorStop(1,  '#a5d6a7');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);

  // Háttérfák (parallax)
  for (const t of bgTrees) {
    ctx.fillStyle = t.dark ? '#1a3a1a' : '#2d5a27';
    const tx = t.x;
    // törzs
    ctx.fillRect(tx - t.w/4, GROUND - t.h, t.w/2, t.h);
    // lombkorona
    ctx.beginPath(); ctx.arc(tx, GROUND - t.h - t.w*0.8, t.w*0.9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx - t.w*0.6, GROUND - t.h - t.w*0.3, t.w*0.7, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + t.w*0.6, GROUND - t.h - t.w*0.3, t.w*0.7, 0, Math.PI*2); ctx.fill();
    t.x -= t.speed; if (t.x < -60) t.x = W + 60;
  }

  // Víz
  waterOffset = (waterOffset + 1) % 60;
  const waterTop = GROUND + 4;
  const waterGrad = ctx.createLinearGradient(0, waterTop, 0, H);
  waterGrad.addColorStop(0, '#0288d1');
  waterGrad.addColorStop(1, '#01579b');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, waterTop, W, H - waterTop);

  // Hullámok
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    ctx.beginPath();
    for (let wx = -waterOffset; wx < W + 20; wx += 60) {
      const wy = waterTop + 8 + row * 14;
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 15, wy - 5, wx + 30, wy);
      ctx.quadraticCurveTo(wx + 45, wy + 5, wx + 60, wy);
    }
    ctx.stroke();
  }

  // Víztükör fénycsíkok
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 5; i++) {
    const lx = ((i * 137 + waterOffset * 2) % W);
    ctx.beginPath();
    ctx.ellipse(lx, waterTop + 20, 30, 4, 0.2, 0, Math.PI*2);
    ctx.fill();
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Közös logika
// ════════════════════════════════════════════════════════════════════════════

function hit() {
  if (invincible > 0) return;
  lives--;
  elLives.textContent = lives;
  invincible = 90;
  GameUtils.playError();
  if (lives <= 0) endGame();
}

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

// ─── Átmenet 1 → 2 ──────────────────────────────────────────────────────────
let transAlpha  = 0;
let transPhase  = 0;  // 0=fade in, 1=megállás, 2=fade out
let transTimer  = 0;

function startTransition() {
  state = 'transitioning';
  transAlpha = 0; transPhase = 0; transTimer = 0;
  cancelAnimationFrame(animId);
  transitionLoop();
}

function transitionLoop() {
  // Rajzold le az aktuális hátteret alá
  drawBg1();

  // Zöld átmeneti overlay
  ctx.fillStyle = `rgba(27,94,32,${transAlpha})`;
  ctx.fillRect(0, 0, W, H);

  if (transAlpha >= 0.92) {
    // Szöveg
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px Nunito, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('🌲 Erdős kaland! 🌲', W/2, H/2 - 20);
    ctx.font = '22px Nunito, cursive';
    ctx.fillText('Ugorj szigetről szigetre!', W/2, H/2 + 22);
    ctx.textAlign = 'left';
  }

  // Fázis logika
  transTimer++;
  if (transPhase === 0) {
    transAlpha = Math.min(0.98, transAlpha + 0.035);
    if (transAlpha >= 0.98) { transPhase = 1; transTimer = 0; }
  } else if (transPhase === 1) {
    if (transTimer > 90) {
      transPhase = 2;
      // Inicializáljuk a 2. világot
      environment = 2;
      envFrames   = 0;
      initEnv2();
    }
  } else {
    transAlpha = Math.max(0, transAlpha - 0.04);
    if (transAlpha <= 0) {
      state = 'playing';
      loop();
      return;
    }
  }

  animId = requestAnimationFrame(transitionLoop);
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  if (state !== 'playing') return;
  frameCount++;
  envFrames++;

  if (environment === 1) {
    drawBg1();
    updateObstacles();
    for (const obs of obstacles) { ctx.save(); obs.type.draw(ctx, obs.x, obs.y); ctx.restore(); }
    girl.update();
    checkObstacleCollisions();

    // 1 perc letelt → átmenet
    if (envFrames >= ENV1_FRAMES && lives > 0) {
      girl.draw();
      updateScore();
      startTransition();
      return;
    }
  } else {
    drawBg2();
    updatePlatforms();
    for (const p of platforms) drawIsland(p);
    updateForestBirds();
    for (const b of forestBirds) drawBird2(b);
    girl.update();
    checkBirdCollisions();
  }

  if (invincible > 0) invincible--;
  girl.draw();
  updateScore();

  animId = requestAnimationFrame(loop);
}

// ─── Overlay / Start / End ───────────────────────────────────────────────────
function showOverlay(emoji, title, sub, btnText) {
  document.getElementById('overlay-emoji').textContent = emoji;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').innerHTML = sub;
  btnAction.textContent = btnText;
  overlay.classList.remove('hidden');
}

function applyDifficulty() {
  switch(settings.difficulty) {
    case 'easy':
      difficultyMultiplier = 0.65;
      break;
    case 'normal':
      difficultyMultiplier = 1.0;
      break;
    case 'hard':
      difficultyMultiplier = 1.4;
      break;
  }
}

function startGame() {
  cancelAnimationFrame(animId);
  score = 0; lives = 3; level = 1; frameCount = 0; envFrames = 0;
  invincible = 0;

  // Világ választása
  if (settings.world === 'random') {
    environment = Math.random() < 0.5 ? 1 : 2;
  } else {
    environment = parseInt(settings.world);
  }

  applyDifficulty();

  obstacles = []; nextObstacleIn = 90;
  platforms = []; forestBirds = [];
  elScore.textContent = 0; elLives.textContent = 3; elLevel.textContent = 1;

  if (environment === 1) {
    girl.reset(1);
  } else {
    girl.reset(2);
    initEnv2();
  }

  settingsOverlay.classList.add('hidden');
  overlay.classList.add('hidden');
  state = 'playing';
  loop();
}

function endGame() {
  state = 'gameover';
  cancelAnimationFrame(animId);
  setTimeout(() => {
    const vilag = environment === 2 ? ' (eljutottál az erdőbe! 🌲)' : '';
    showOverlay('😢', 'Játék vége!',
      `Elértél <strong>${score}</strong> pontot!${vilag}<br>Próbáld újra!`,
      'Újra játszom');
  }, 400);
}

btnAction.addEventListener('click', startGame);
showOverlay('🌟', 'Kislány kalandjai', 'Nyilakkal irányítsd a kislányt,<br>kerüld el az akadályokat!', 'Játék indítása');
window.addEventListener('keydown', e => {
  if (e.key === ' ' && (state === 'idle' || state === 'gameover')) startGame();
});
