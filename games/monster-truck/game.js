// ─── Monster Truck Kaland — Elasto Mania-stílusú fizika ──────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ─── Konstansok ───────────────────────────────────────────────────────────────
const GRAVITY      = 0.85;    // erősebb gravitáció → gyorsabb süllyedés
const WHEEL_R      = 22;
const WHEELBASE    = 76;       // keréktengelyek távolsága
const ENGINE_FORCE = 0.50;     // motor erő növelés
const MAX_SPEED    = 16;       // gyorsabb max sebesség
const TERRAIN_LEN  = 4500;    // TEST: rövidebb pálya
const FINISH_X     = 4200;    // TEST: hamarabb vége
const CONSTRAINT_ITER = 5;    // megkötés iterációk száma

// ─── Billentyűk ───────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── Terepgenerátor ───────────────────────────────────────────────────────────
const GROUND_Y = H - 55;
const TSTEP = 6;
let terrain = [];

function buildTerrain() {
  terrain = [];
  for (let x = 0; x <= TERRAIN_LEN; x += TSTEP) {
    terrain.push({ x, y: terrainF(x) });
  }
}

function terrainF(x) {
  if (x < 0) return GROUND_Y;

  // TEST TRACK: lapos → emelkedő → lapos → leszálló → lapos
  if (x < 800) {
    // Flat section 1
    return GROUND_Y;
  } else if (x < 1600) {
    // Upslope: 45 degrees over 800px
    return GROUND_Y - (x - 800) * (150 / 800);
  } else if (x < 2400) {
    // Flat section 2 (elevated)
    return GROUND_Y - 150;
  } else if (x < 3200) {
    // Downslope: 45 degrees over 800px
    return GROUND_Y - 150 + (x - 2400) * (150 / 800);
  } else {
    // Flat section 3
    return GROUND_Y;
  }
}

function getTerrainY(wx) {
  if (wx <= 0) return GROUND_Y;
  if (wx >= TERRAIN_LEN) return GROUND_Y;
  const i = Math.floor(wx / TSTEP);
  if (i >= terrain.length - 1) return terrain[terrain.length - 1].y;
  const t = (wx - terrain[i].x) / TSTEP;
  return terrain[i].y + (terrain[i + 1].y - terrain[i].y) * t;
}

function getTerrainNormal(wx) {
  // Terep normálvektora → merőleges a felszínre, felfelé mutat
  const dy = getTerrainY(wx + 2) - getTerrainY(wx - 2);
  const dx = 4;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { nx: -dy / len, ny: -dx / len };  // forgás 90°-kal
}

// ─── Kerék fizika ─────────────────────────────────────────────────────────────
function makeWheel(x, y) {
  return { x, y, px: x, py: y, angle: 0, onGround: false };
}

function stepWheel(w, ax, ay) {
  const vx = w.x - w.px;
  const vy = w.y - w.py;
  w.px = w.x;
  w.py = w.y;
  w.x += vx + ax;
  w.y += vy + ay + GRAVITY;
  // Max sebesség korlát
  const speed = Math.sqrt((w.x-w.px)**2 + (w.y-w.py)**2);
  if (speed > MAX_SPEED) {
    const f = MAX_SPEED / speed;
    w.x = w.px + (w.x - w.px) * f;
    w.y = w.py + (w.y - w.py) * f;
  }
}

function resolveWheelTerrain(w) {
  const ty = getTerrainY(w.x);
  const pen = (w.y + WHEEL_R) - ty;
  if (pen <= 0) { w.onGround = false; return; }

  const n = getTerrainNormal(w.x);
  // Kerék kilökése a terepből a normál irányában
  w.x -= n.nx * pen;
  w.y -= n.ny * pen;

  // Sebesség tükrözése a normál mentén (rugalmas ütközés)
  const vx = w.x - w.px;
  const vy = w.y - w.py;
  const vDotN = vx * n.nx + vy * n.ny;
  if (vDotN < 0) {
    const restitution = 0.05;  // kevésbé rugalmas → könnyebb kezelés
    w.x -= (1 + restitution) * vDotN * n.nx;
    w.y -= (1 + restitution) * vDotN * n.ny;
    // Súrlódás a tangensirányban — lejtőn is csúszhat
    const tx = -n.ny, ty2 = n.nx;
    const vDotT = (w.x - w.px) * tx + (w.y - w.py) * ty2;
    const friction = 0.84;  // jó tapadás, kisebb dampening
    w.x -= (1 - friction) * vDotT * tx;
    w.y -= (1 - friction) * vDotT * ty2;
  }
  w.onGround = true;
}

function applyWheelbaseConstraint(a, b) {
  // Merev rúd megkötés: a és b kerék távolsága = WHEELBASE
  // Jó egyensúly: elég merev trakció, de még hullik
  for (let i = 0; i < CONSTRAINT_ITER; i++) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) continue;
    const diff = (dist - WHEELBASE) / dist * 0.28;  // köztes stiffness
    a.x += dx * diff;
    a.y += dy * diff;
    b.x -= dx * diff;
    b.y -= dy * diff;
  }
}

// ─── Truck állapot ────────────────────────────────────────────────────────────
let rear, front;   // kerekek
let wheelAngle = 0;
let flipFrames = 0;
let lives, score, level, frameCount, cameraX, animId, gameState;
let flipWarning = 0;

function resetTruck(startX) {
  rear  = makeWheel(startX - WHEELBASE / 2, GROUND_Y - WHEEL_R);
  front = makeWheel(startX + WHEELBASE / 2, GROUND_Y - WHEEL_R);
}

function truckAngle() {
  return Math.atan2(front.y - rear.y, front.x - rear.x);
}

function truckCenter() {
  return { x: (rear.x + front.x) / 2, y: (rear.y + front.y) / 2 };
}

function isFlipped() {
  const a = truckAngle();
  return Math.abs(a) > Math.PI * 0.62;  // >~112° a vízszintestől
}

// ─── Update ───────────────────────────────────────────────────────────────────
let debugInfo = {};

function updateTruck() {
  // Motor erő – csak ha talajon van legalább az egyik kerék
  let ax = 0;
  if (keys['ArrowRight']) ax =  ENGINE_FORCE;
  if (keys['ArrowLeft'])  ax = -ENGINE_FORCE * 0.75;

  // Kerekek léptetése
  stepWheel(rear,  ax * 0.6, 0);
  stepWheel(front, ax * 0.4, 0);

  // Terep ütközés
  resolveWheelTerrain(rear);
  resolveWheelTerrain(front);

  // Megkötés (kerekek távolsága = WHEELBASE)
  applyWheelbaseConstraint(rear, front);

  // Terep ütközés még egyszer a megkötés után
  resolveWheelTerrain(rear);
  resolveWheelTerrain(front);

  // Debug info
  debugInfo = {
    rearGround: rear.onGround,
    frontGround: front.onGround,
    motorForce: ax,
    angle: (truckAngle() * 180 / Math.PI).toFixed(1)
  };

  // Keréknyom-forgás (vizuális)
  const vx = (front.x - front.px + rear.x - rear.px) / 2;
  wheelAngle += vx / WHEEL_R;

  // Bukfenc detektálás
  if (isFlipped()) {
    flipFrames++;
    flipWarning = 60;
  } else {
    flipFrames = Math.max(0, flipFrames - 2);
  }
  if (flipWarning > 0) flipWarning--;

  if (flipFrames > 180) {  // 3 másodperc bukfencben
    flipFrames = 0;
    hit();
  }

  // Kamera
  const target = truckCenter().x - W * 0.3;
  cameraX += (target - cameraX) * 0.12;
  cameraX = Math.max(0, cameraX);
}

// ─── Pontszám / szint ─────────────────────────────────────────────────────────
function updateScore() {
  const dist = Math.round((truckCenter().x) / 8);
  if (dist > score) {
    score = dist;
    document.getElementById('distance').textContent = score;
    const newLevel = Math.floor(score / 200) + 1;
    if (newLevel !== level) {
      level = newLevel;
      document.getElementById('level').textContent = level;
      GameUtils.playTone(660, 0.18);
    }
  }
  // Célba ért?
  if (truckCenter().x >= FINISH_X) {
    finishLevel();
  }
}

// ─── Háttér rajz ─────────────────────────────────────────────────────────────
const bgClouds = Array.from({length: 8}, (_, i) => ({
  wx: i * 1100 + 200, y: 30 + Math.random() * 55,
  r: 24 + Math.random() * 20, speed: 0.15 + Math.random() * 0.15
}));

function drawBg() {
  // Égbolt
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#5ba3d9');
  sky.addColorStop(1, '#c8e8ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Felhők (parallax: 30%-os scroll)
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (const c of bgClouds) {
    const sx = c.wx - cameraX * 0.3;
    ctx.beginPath();
    ctx.arc(sx,          c.y,       c.r,       0, Math.PI * 2); ctx.fill();
    ctx.arc(sx + c.r * 0.75, c.y + 6, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.arc(sx - c.r * 0.6,  c.y + 8, c.r * 0.58,0, Math.PI * 2); ctx.fill();
    // végtelen scroll
    if (sx < -120) c.wx += 9500;
  }

  // Háttér dombok (parallax 60%)
  ctx.fillStyle = '#9dcc78';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let sx = 0; sx < W + 60; sx += 30) {
    const wx = sx + cameraX * 0.6;
    const hy = H - 60 - Math.sin(wx * 0.0038) * 40 - Math.sin(wx * 0.0091) * 25;
    ctx.lineTo(sx, hy);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

// ─── Terep rajz ───────────────────────────────────────────────────────────────
function drawTerrain() {
  const startI = Math.max(0, Math.floor(cameraX / TSTEP) - 2);
  const endI   = Math.min(terrain.length - 1, startI + Math.ceil(W / TSTEP) + 4);

  // Terep kitöltés
  const grad = ctx.createLinearGradient(0, GROUND_Y - 80, 0, H);
  grad.addColorStop(0, '#5a9e3f');
  grad.addColorStop(0.12, '#4a8a34');
  grad.addColorStop(1, '#3d6b28');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(terrain[startI].x - cameraX, H);
  for (let i = startI; i <= endI; i++) {
    ctx.lineTo(terrain[i].x - cameraX, terrain[i].y);
  }
  ctx.lineTo(terrain[endI].x - cameraX, H);
  ctx.closePath();
  ctx.fill();

  // Fű csík
  ctx.strokeStyle = '#6abf4b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = startI; i <= endI; i++) {
    const sx = terrain[i].x - cameraX;
    if (i === startI) ctx.moveTo(sx, terrain[i].y);
    else ctx.lineTo(sx, terrain[i].y);
  }
  ctx.stroke();

  // Szikla textúra (ismétlődő kövek)
  ctx.fillStyle = '#7d5a3c';
  for (let wx = Math.floor(cameraX / 80) * 80; wx < cameraX + W; wx += 80) {
    const sy = getTerrainY(wx) + 8;
    const sx = wx - cameraX;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 14, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Célzászló
  const fx = FINISH_X - cameraX;
  if (fx > -20 && fx < W + 20) {
    const fy = getTerrainY(FINISH_X) - 2;
    ctx.fillStyle = '#555';
    ctx.fillRect(fx - 2, fy - 80, 4, 80);
    // sakktábla minta
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#fff' : '#222';
        ctx.fillRect(fx + col * 10, fy - 80 + row * 10, 10, 10);
      }
    }
  }
}

// ─── Truck rajz ───────────────────────────────────────────────────────────────
function drawWheel(w) {
  const sx = w.x - cameraX;
  const sy = w.y;
  // Gumi
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath(); ctx.arc(sx, sy, WHEEL_R, 0, Math.PI * 2); ctx.fill();
  // Futófelület bordák
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = wheelAngle + i * Math.PI / 4;
    ctx.beginPath();
    ctx.arc(sx, sy, WHEEL_R, a, a + 0.35);
    ctx.stroke();
  }
  // Felni
  ctx.fillStyle = '#bdc3c7';
  ctx.beginPath(); ctx.arc(sx, sy, WHEEL_R * 0.48, 0, Math.PI * 2); ctx.fill();
  // Küllők
  ctx.strokeStyle = '#95a5a6';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = wheelAngle + i * Math.PI * 2 / 5;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 4);
    ctx.lineTo(sx + Math.cos(a) * WHEEL_R * 0.44, sy + Math.sin(a) * WHEEL_R * 0.44);
    ctx.stroke();
  }
}

function drawTruck() {
  const rx = rear.x  - cameraX;
  const fx = front.x - cameraX;
  const angle = Math.atan2(front.y - rear.y, front.x - rear.x);
  const cx = (rx + fx) / 2;
  const cy = (rear.y + front.y) / 2;

  // DEBUG: velocity
  const vx = (front.x - front.px + rear.x - rear.px) / 2;
  const vy = (front.y - front.py + rear.y - rear.py) / 2;
  const speed = Math.sqrt(vx * vx + vy * vy);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Lengéscsillapítók
  ctx.strokeStyle = '#7f8c8d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-WHEELBASE/2, 0); ctx.lineTo(-WHEELBASE/2, -14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( WHEELBASE/2, 0); ctx.lineTo( WHEELBASE/2, -14); ctx.stroke();

  // Alváz
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.roundRect(-WHEELBASE/2 - 8, -28, WHEELBASE + 16, 18, 4);
  ctx.fill();
  ctx.strokeStyle = '#922b21';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Karosszéria
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.roundRect(-WHEELBASE/2 - 4, -48, WHEELBASE + 8, 22, 6);
  ctx.fill();

  // Fülke
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.roundRect(-4, -70, WHEELBASE/2 + 4, 24, [6, 6, 0, 0]);
  ctx.fill();

  // Szélvédő
  ctx.fillStyle = '#85c1e9';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.roundRect(0, -67, WHEELBASE/2 - 2, 18, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Kipufogó (hátul)
  ctx.fillStyle = '#555';
  ctx.fillRect(-WHEELBASE/2 - 14, -42, 10, 6);
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(-WHEELBASE/2 - 14, -36, 4, 0, Math.PI * 2); ctx.fill();

  // Fényszórók (elöl)
  ctx.fillStyle = '#f9e74c';
  ctx.beginPath(); ctx.ellipse(WHEELBASE/2 + 8, -44, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,100,0.4)';
  ctx.beginPath();
  ctx.moveTo(WHEELBASE/2 + 12, -44);
  ctx.lineTo(WHEELBASE/2 + 35, -54);
  ctx.lineTo(WHEELBASE/2 + 35, -34);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Kerekek (camera-offset-tel)
  drawWheel(rear);
  drawWheel(front);

  // Bukfenc figyelmeztetés
  if (flipWarning > 0 && Math.floor(flipWarning / 8) % 2 === 0) {
    ctx.font = 'bold 22px Nunito, sans-serif';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ Megdől!', cx, rear.y - 60);
  }

  // DEBUG OUTPUT
  ctx.font = '12px monospace';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'left';
  ctx.fillText(`Pos: ${truckCenter().x.toFixed(0)} | V: vx=${vx.toFixed(2)} vy=${vy.toFixed(2)} | Speed: ${speed.toFixed(3)}`, 10, 20);
  ctx.fillText(`Ground: R=${debugInfo.rearGround ? '✓' : '✗'} F=${debugInfo.frontGround ? '✓' : '✗'} | Force: ${debugInfo.motorForce.toFixed(2)} | Angle: ${debugInfo.angle}°`, 10, 35);
}

// ─── Pálya díszítők ───────────────────────────────────────────────────────────
function drawDecorations() {
  // TEST TRACK LABELS
  const labels = [
    { x: 400, label: "Flat 1" },
    { x: 1200, label: "↗ Up" },
    { x: 2000, label: "Flat 2" },
    { x: 2800, label: "↘ Down" },
    { x: 3600, label: "Flat 3" }
  ];

  for (const {x, label} of labels) {
    const sx = x - cameraX;
    if (sx < -60 || sx > W + 60) continue;
    const ty = getTerrainY(x) - 80;
    ctx.font = 'bold 16px Nunito, sans-serif';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, ty);
  }

  // Fák (hátul)
  for (let wx = 400; wx < TERRAIN_LEN; wx += 350) {
    const sx = wx - cameraX;
    if (sx < -60 || sx > W + 60) continue;
    const ty = getTerrainY(wx) - 2;
    // törzs
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(sx - 5, ty - 50, 10, 50);
    // lombozat
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.arc(sx, ty - 65, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(sx - 8, ty - 72, 18, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Ütközés / életek ────────────────────────────────────────────────────────
function hit() {
  lives--;
  document.getElementById('lives').textContent = lives;
  GameUtils.playError();
  if (lives <= 0) {
    endGame();
    return;
  }
  // Újraindítás az utolsó elért pozícióban
  const spawnX = Math.max(200, truckCenter().x - 100);
  invincibleFrames = 120;
  resetTruck(spawnX);
}

let invincibleFrames = 0;

function finishLevel() {
  gameState = 'finished';
  cancelAnimationFrame(animId);
  GameUtils.celebrate(`🏁 Célba értél! ${score} méter!`, 3000);
  setTimeout(() => {
    showOverlay('🏆', 'Gratulálok!', `Teljesítetted a pályát!<br>Megtett távolság: <strong>${score} m</strong>`, 'Újra játszom');
  }, 2500);
}

function endGame() {
  gameState = 'gameover';
  cancelAnimationFrame(animId);
  setTimeout(() => {
    showOverlay('💥', 'Játék vége!', `Megtett távolság: <strong>${score} m</strong><br>Próbáld újra!`, 'Újra játszom');
  }, 400);
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  if (gameState !== 'playing') return;
  frameCount++;
  if (invincibleFrames > 0) invincibleFrames--;

  drawBg();
  drawDecorations();
  drawTerrain();
  updateTruck();
  drawTruck();
  updateScore();

  animId = requestAnimationFrame(loop);
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
const overlay   = document.getElementById('overlay');
const btnAction = document.getElementById('action-btn');

function showOverlay(emoji, title, sub, btnText) {
  document.getElementById('overlay-emoji').textContent = emoji;
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-sub').innerHTML = sub;
  btnAction.textContent = btnText;
  overlay.classList.remove('hidden');
}

function startGame() {
  cancelAnimationFrame(animId);
  buildTerrain();
  lives = 3; score = 0; level = 1; frameCount = 0;
  cameraX = 0; flipFrames = 0; flipWarning = 0; invincibleFrames = 60;
  document.getElementById('lives').textContent = 3;
  document.getElementById('distance').textContent = 0;
  document.getElementById('level').textContent = 1;
  resetTruck(160);
  overlay.classList.add('hidden');
  gameState = 'playing';
  loop();
}

btnAction.addEventListener('click', startGame);
window.addEventListener('keydown', e => {
  if (e.key === ' ' && (gameState === 'idle' || gameState === 'gameover' || gameState === 'finished')) startGame();
});

showOverlay('🚛', 'Monster Truck Kaland', 'Vezérelje a szörnyeteget az akadálypályán!<br>⬅ visszafelé · ➡ előre', 'Indítás!');
gameState = 'idle';
