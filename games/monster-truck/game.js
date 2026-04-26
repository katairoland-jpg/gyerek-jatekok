/**
 * Monster Truck Kaland - Matter.js Physics Edition
 * Bouncy truck with big wheels and hilly terrain
 */

const { Engine, World, Body, Bodies, Constraint } = Matter;

class MonsterTruckGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById('overlay');
    this.statusBar = document.querySelector('.status-bar');

    // Game settings
    this.GRAVITY = 1.8;
    this.TRUCK_MASS = 300;
    this.WHEEL_RADIUS = 25;
    this.TRUCK_WIDTH = 60;
    this.TRUCK_HEIGHT = 40;
    this.WHEELBASE = 100;

    // Create physics engine
    this.engine = Engine.create({ gravity: { y: this.GRAVITY } });
    this.world = this.engine.world;

    // Game state
    this.gameState = 'start'; // start, playing, won, lost
    this.lives = 3;
    this.distance = 0;
    this.level = 1;
    this.crashed = false;

    // Input
    this.keys = {};
    this.setupInput();

    // Create scene
    this.createTerrain();
    this.createTruck();
    this.createFinish();

    // Camera
    this.cameraX = 0;

    // Game loop
    this.running = false;
    this.setupEventHandlers();
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.gameState === 'start' || this.gameState === 'won' || this.gameState === 'lost') {
          e.preventDefault();
          this.startGame();
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
  }

  createTerrain() {
    // Generate hilly terrain
    const terrain = this.generateHillyTerrain();

    // Create static terrain body from vertices
    const vertices = terrain.map(p => ({ x: p.x, y: p.y }));
    this.terrainBody = Bodies.fromVertices(500, 0, [vertices], {
      isStatic: true,
      label: 'terrain',
      friction: 0.8,
      restitution: 0.2
    });

    World.add(this.world, this.terrainBody);
  }

  generateHillyTerrain() {
    const points = [];
    const width = 1200;
    const baseY = 200;

    // Procedural hills using sine waves
    for (let x = 0; x <= width; x += 10) {
      const y = baseY +
        Math.sin(x * 0.01) * 30 +
        Math.sin(x * 0.005) * 50 +
        Math.sin(x * 0.0025) * 20;
      points.push({ x, y });
    }

    // Bottom boundary
    points.push({ x: width, y: 400 });
    points.push({ x: 0, y: 400 });

    return points;
  }

  createTruck() {
    const startX = 100;
    const startY = 100;

    // Chassis
    this.chassis = Bodies.rectangle(startX, startY, this.TRUCK_WIDTH, this.TRUCK_HEIGHT, {
      mass: 200,
      friction: 0.3,
      restitution: 0.1,
      label: 'chassis'
    });

    // Wheels
    this.rearWheel = Bodies.circle(startX - this.WHEELBASE / 2, startY + 30, this.WHEEL_RADIUS, {
      mass: 40,
      friction: 0.9,
      restitution: 0.3,
      label: 'wheel'
    });

    this.frontWheel = Bodies.circle(startX + this.WHEELBASE / 2, startY + 30, this.WHEEL_RADIUS, {
      mass: 40,
      friction: 0.9,
      restitution: 0.3,
      label: 'wheel'
    });

    World.add(this.world, [this.chassis, this.rearWheel, this.frontWheel]);

    // Suspension
    this.rearSuspension = Constraint.create({
      bodyA: this.chassis,
      bodyB: this.rearWheel,
      pointA: { x: -this.WHEELBASE / 2, y: 20 },
      pointB: { x: 0, y: 0 },
      length: 50,
      stiffness: 0.15,
      damping: 0.08
    });

    this.frontSuspension = Constraint.create({
      bodyA: this.chassis,
      bodyB: this.frontWheel,
      pointA: { x: this.WHEELBASE / 2, y: 20 },
      pointB: { x: 0, y: 0 },
      length: 50,
      stiffness: 0.15,
      damping: 0.08
    });

    World.add(this.world, [this.rearSuspension, this.frontSuspension]);

    this.truckStartX = startX;
    this.truckStartY = startY;
  }

  createFinish() {
    this.finishX = 1000;
  }

  startGame() {
    this.gameState = 'playing';
    this.running = true;
    this.overlay.style.display = 'none';
    this.statusBar.style.display = 'flex';
    this.distance = 0;
    this.lives = 3;

    this.resetTruck();
    this.update();
  }

  resetTruck() {
    Body.setPosition(this.chassis, { x: this.truckStartX, y: this.truckStartY });
    Body.setVelocity(this.chassis, { x: 0, y: 0 });
    Body.setAngularVelocity(this.chassis, 0);

    Body.setPosition(this.rearWheel, { x: this.truckStartX - this.WHEELBASE / 2, y: this.truckStartY + 30 });
    Body.setVelocity(this.rearWheel, { x: 0, y: 0 });
    Body.setAngularVelocity(this.rearWheel, 0);

    Body.setPosition(this.frontWheel, { x: this.truckStartX + this.WHEELBASE / 2, y: this.truckStartY + 30 });
    Body.setVelocity(this.frontWheel, { x: 0, y: 0 });
    Body.setAngularVelocity(this.frontWheel, 0);
  }

  update() {
    if (!this.running) return;

    Engine.update(this.engine);

    // Controls
    const DRIVE_FORCE = 0.004;
    const STEER_FORCE = 0.005;

    if (this.keys['ArrowRight'] || this.keys['d']) {
      Body.applyForce(this.rearWheel, this.rearWheel.position, { x: DRIVE_FORCE * 60, y: 0 });
      Body.applyForce(this.frontWheel, this.frontWheel.position, { x: DRIVE_FORCE * 30, y: 0 });
    }
    if (this.keys['ArrowLeft'] || this.keys['a']) {
      Body.applyForce(this.rearWheel, this.rearWheel.position, { x: -DRIVE_FORCE * 60, y: 0 });
      Body.applyForce(this.frontWheel, this.frontWheel.position, { x: -DRIVE_FORCE * 30, y: 0 });
    }
    if (this.keys['ArrowUp'] || this.keys['w']) {
      Body.rotate(this.chassis, -STEER_FORCE);
    }
    if (this.keys['ArrowDown'] || this.keys['s']) {
      Body.rotate(this.chassis, STEER_FORCE);
    }

    // Distance tracking
    this.distance = Math.max(0, Math.round((this.chassis.position.x - this.truckStartX) / 10));

    // Check finish
    if (this.chassis.position.x > this.finishX && this.gameState === 'playing') {
      this.gameState = 'won';
      this.running = false;
      GameUtils.celebrate('Jól csináltad! 🎉', 0, () => this.showWin());
    }

    // Check if fallen
    if (this.chassis.position.y > 400 || this.chassis.position.x < -100) {
      this.lives--;
      if (this.lives > 0) {
        this.resetTruck();
      } else {
        this.gameState = 'lost';
        this.running = false;
        GameUtils.playError();
        this.showGameOver();
      }
    }

    // Camera follow
    const targetCameraX = this.chassis.position.x - 150;
    this.cameraX += (targetCameraX - this.cameraX) * 0.12;

    this.draw();
    this.updateUI();

    if (this.running) {
      requestAnimationFrame(() => this.update());
    }
  }

  draw() {
    // Clear
    this.ctx.fillStyle = '#fff9f0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Camera transform
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    this.drawBackground();
    this.drawTerrain();
    this.drawTruck();
    this.drawFinish();

    this.ctx.restore();
  }

  drawBackground() {
    // Sky
    const gradient = this.ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(-500, -50, 2000, 150);

    // Clouds parallax
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const cloudX = (-this.cameraX * 0.3) % 400;
    this.drawCloud(cloudX, 40, 60, 20);
    this.drawCloud(cloudX + 200, 70, 70, 25);
    this.drawCloud(cloudX - 200, 50, 50, 15);
  }

  drawCloud(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, h / 2, 0, Math.PI * 2);
    this.ctx.arc(x + w / 2, y - h / 4, h / 1.5, 0, Math.PI * 2);
    this.ctx.arc(x + w, y, h / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawTerrain() {
    const terrain = this.generateHillyTerrain();

    this.ctx.fillStyle = '#8B7355';
    this.ctx.beginPath();
    this.ctx.moveTo(terrain[0].x, terrain[0].y);
    terrain.forEach(p => this.ctx.lineTo(p.x, p.y));
    this.ctx.closePath();
    this.ctx.fill();

    // Grass line
    this.ctx.strokeStyle = '#228B22';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(terrain[0].x, terrain[0].y);
    for (let i = 1; i < terrain.length - 2; i++) {
      this.ctx.lineTo(terrain[i].x, terrain[i].y);
    }
    this.ctx.stroke();
  }

  drawTruck() {
    const x = this.chassis.position.x;
    const y = this.chassis.position.y;
    const angle = this.chassis.angle;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Body
    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.fillRect(-this.TRUCK_WIDTH / 2, -this.TRUCK_HEIGHT / 2, this.TRUCK_WIDTH, this.TRUCK_HEIGHT);

    // Windows
    this.ctx.fillStyle = 'rgba(100, 150, 200, 0.7)';
    this.ctx.fillRect(-this.TRUCK_WIDTH / 2 + 5, -this.TRUCK_HEIGHT / 2 + 5, 15, 12);
    this.ctx.fillRect(-5, -this.TRUCK_HEIGHT / 2 + 5, 15, 12);

    this.ctx.restore();

    // Wheels
    this.drawWheel(this.rearWheel.position.x, this.rearWheel.position.y, this.rearWheel.angle);
    this.drawWheel(this.frontWheel.position.x, this.frontWheel.position.y, this.frontWheel.angle);
  }

  drawWheel(x, y, angle) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Tire
    this.ctx.fillStyle = '#333';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.WHEEL_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();

    // Rim
    this.ctx.fillStyle = '#AAA';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, this.WHEEL_RADIUS * 0.6, 0, Math.PI * 2);
    this.ctx.fill();

    // Tread
    this.ctx.strokeStyle = '#555';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = this.WHEEL_RADIUS * 0.8;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      this.ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawFinish() {
    const x = this.finishX;
    const y = 150;
    const h = 100;

    // Flag
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(x - 10, y - h / 2, 20, h);

    // Checkered
    this.ctx.fillStyle = '#000';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2 === 0) {
          this.ctx.fillRect(x - 8 + i * 4, y - h / 2 + j * (h / 4), 4, h / 4);
        }
      }
    }

    // Pole
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(x - 2, y - h / 2, 4, h);
  }

  updateUI() {
    document.getElementById('lives').textContent = this.lives;
    document.getElementById('distance').textContent = this.distance;
    document.getElementById('level').textContent = this.level;
  }

  showWin() {
    this.overlay.style.display = 'flex';
    document.getElementById('overlay-emoji').textContent = '🎉';
    document.getElementById('overlay-title').textContent = 'Sikerült!';
    document.getElementById('overlay-sub').textContent = 'Éppen néhány méterrel több kellett volna...';
    document.getElementById('action-btn').textContent = 'Következő Szint';
  }

  showGameOver() {
    this.overlay.style.display = 'flex';
    document.getElementById('overlay-emoji').textContent = '💥';
    document.getElementById('overlay-title').textContent = 'Vége a játéknak!';
    document.getElementById('overlay-sub').textContent = `Elérted ${this.distance} métert!`;
    document.getElementById('action-btn').textContent = 'Újra!';
  }

  setupEventHandlers() {
    document.getElementById('action-btn').addEventListener('click', () => {
      if (this.gameState === 'won') {
        this.level++;
        this.finishX += 300;
      }
      this.startGame();
    });
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.game = new MonsterTruckGame();

  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  document.getElementById('overlay-emoji').textContent = '🚛';
  document.getElementById('overlay-title').textContent = 'Monster Truck Kaland';
  document.getElementById('overlay-sub').textContent = 'Nyomj jobbra/balra nyílat a vezetéshez. Érj el a célhoz!';
  document.getElementById('action-btn').textContent = 'Kezdés!';
  document.getElementById('action-btn').addEventListener('click', () => window.game.startGame());
});
