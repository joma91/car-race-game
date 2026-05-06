<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>CarOnSale Race</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #1a1d24;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Press Start 2P', monospace;
      overflow: hidden;
    }

    #gameWrapper {
      position: relative;
      display: inline-block;
      border: 3px solid #FFD452;
      box-shadow: 0 0 30px rgba(255, 212, 82, 0.4), 0 0 60px rgba(255, 212, 82, 0.1);
    }

    /* CRT Scanline overlay */
    #gameWrapper::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.08) 2px,
        rgba(0,0,0,0.08) 4px
      );
      pointer-events: none;
      z-index: 10;
    }

    /* CRT flicker animation */
    #gameWrapper::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.01);
      pointer-events: none;
      z-index: 11;
      animation: flicker 8s infinite;
    }

    @keyframes flicker {
      0%, 95%, 100% { opacity: 1; }
      96% { opacity: 0.92; }
      97% { opacity: 1; }
      98% { opacity: 0.95; }
    }

    canvas {
      display: block;
      image-rendering: pixelated;
    }

    #startButton {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 10px;
      width: 200px;
      height: 48px;
      background: #FFD452;
      color: #2F343E;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
      box-shadow: 4px 4px 0 #b8951a;
      transition: transform 0.1s, box-shadow 0.1s;
    }

    #startButton:hover {
      transform: translateX(-50%) translateY(-2px);
      box-shadow: 4px 6px 0 #b8951a;
    }

    #startButton:active {
      transform: translateX(-50%) translateY(2px);
      box-shadow: 2px 2px 0 #b8951a;
    }

    /* Keyboard hint */
    #keyHint {
      margin-top: 12px;
      color: #474B57;
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      text-align: center;
      line-height: 1.8;
    }
  </style>
</head>
<body>

<div id="gameWrapper">
  <canvas id="gameCanvas" width="700" height="420"></canvas>
  <button id="startButton">START GAME</button>
</div>
<div id="keyHint">↑↓ SPEED  ←→ STEER  SPACE BOOST</div>

<script>
function initCarRaceGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startButton = document.getElementById('startButton');

  // CarOnSale ASCII Logo
  const ASCII_LOGO = [
    "  ___          ___      ___      _      ",
    " / __|__ _ _ / _ \\ _ _ / __| __ _| |___ ",
    "| (__/ _` |  | (_) | ' \\ \\__ \\/ _` | / -_)",
    " \\___\\__,_|   \\___/|_||_|___/\\__,_|_\\___|"
  ];

  const colors = {
    yellow: '#FFD452',
    yellowDim: '#b8951a',
    darkGray: '#2F343E',
    lightGray: '#474B57',
    white: '#FFFFFF',
    lightBlue: '#BAC5E5',
    brickRed: '#8e402a',
    brickDark: '#302018',
    green: '#4CAF50',
    red: '#e74c3c'
  };

  let gameLoop;
  let car;
  let track;
  let startTime;
  let currentTime = 0;
  let finalTime;
  let gameState = 'menu';
  let gameStarted = false;
  let countdown = 0;
  let countdownTimer = null;
  let skidMarks = [];
  let particles = [];

  // ── Speedometer ──────────────────────────────
  function drawSpeedometer(speed) {
    const cx = 650, cy = 370, r = 35;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fill();
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arc track
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, Math.PI * 0.75, Math.PI * 2.25, false);
    ctx.strokeStyle = colors.lightGray;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Arc fill
    const maxSpeed = 8;
    const pct = Math.min(Math.abs(speed) / maxSpeed, 1);
    const startA = Math.PI * 0.75;
    const endA = startA + pct * Math.PI * 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, startA, endA, false);
    ctx.strokeStyle = pct > 0.7 ? colors.red : colors.yellow;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Needle
    const needleAngle = startA + pct * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 10), cy + Math.sin(needleAngle) * (r - 10));
    ctx.strokeStyle = colors.white;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = colors.yellow;
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', cx, cy + 4);
    ctx.restore();
  }

  // ── Particles ─────────────────────────────────
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        color
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      p.vx *= 0.95;
      p.vy *= 0.95;
    }
  }

  function drawParticles() {
    for (let p of particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.restore();
    }
  }

  // ── Car ───────────────────────────────────────
  class Car {
    constructor() {
      this.x = 375;
      this.y = 320;
      this.angle = 0;
      this.speed = 0;
      this.lap = 1;
      this.checkpoint = 0;
      this.boosting = false;
      this.boostCooldown = 0;
      this.skidTimer = 0;
    }

    update() {
      if (!gameStarted && (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'])) {
        gameStarted = true;
        startTime = Date.now();
      }

      const accel = this.boosting ? 0.4 : 0.2;
      if (keys['ArrowUp']) this.speed += accel;
      if (keys['ArrowDown']) this.speed -= 0.15;

      // Boost
      if (keys['Space'] && this.boostCooldown <= 0) {
        this.boosting = true;
        this.boostCooldown = 120;
        spawnParticles(this.x, this.y, colors.yellow, 8);
      }
      if (this.boosting && this.boostCooldown < 100) this.boosting = false;
      if (this.boostCooldown > 0) this.boostCooldown--;

      const maxSpeed = this.boosting ? 10 : 7;
      this.speed = Math.max(-3, Math.min(maxSpeed, this.speed));

      const turnRate = 0.045 + Math.abs(this.speed) * 0.002;
      if (keys['ArrowLeft']) this.angle -= turnRate * Math.sign(this.speed);
      if (keys['ArrowRight']) this.angle += turnRate * Math.sign(this.speed);

      this.speed *= 0.97;

      let newX = this.x + Math.cos(this.angle) * this.speed;
      let newY = this.y + Math.sin(this.angle) * this.speed;

      if (this.isOnTrack(newX, newY)) {
        // Skid marks when turning fast
        if (Math.abs(this.speed) > 3 && (keys['ArrowLeft'] || keys['ArrowRight'])) {
          skidMarks.push({ x: this.x, y: this.y, life: 1 });
          if (skidMarks.length > 200) skidMarks.shift();
        }
        this.x = newX;
        this.y = newY;
      } else {
        spawnParticles(this.x, this.y, colors.brickRed, 4);
        this.speed *= -0.3;
      }

      // Lap logic
      if (this.x > 350 && this.x < 400 && this.y > 300 && this.y < 340) {
        if (this.checkpoint === 1) {
          if (this.lap < 3) {
            this.lap++;
            spawnParticles(this.x, this.y, colors.yellow, 20);
          } else {
            gameState = 'finished';
            finalTime = currentTime;
            clearInterval(gameLoop);
          }
        }
        this.checkpoint = 0;
      } else if (this.x > 600 && this.y > 150 && this.y < 200) {
        this.checkpoint = 1;
      }
    }

    isOnTrack(x, y) {
      return (x > 55 && x < 645 && y > 55 && y < 345) &&
             !(x > 105 && x < 595 && y > 105 && y < 295);
    }

    draw() {
      // Shadow
      ctx.save();
      ctx.translate(this.x + 3, this.y + 4);
      ctx.rotate(this.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Boost flame
      if (this.boosting) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        const flameX = -18 - Math.random() * 6;
        ctx.fillStyle = Math.random() > 0.5 ? '#ff6600' : colors.yellow;
        ctx.beginPath();
        ctx.moveTo(flameX, -5);
        ctx.lineTo(flameX - 10, 0);
        ctx.lineTo(flameX, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      // Body
      ctx.fillStyle = colors.yellow;
      ctx.fillRect(-15, -8, 30, 16);

      // Cockpit
      ctx.fillStyle = colors.lightBlue;
      ctx.fillRect(-4, -6, 10, 12);

      // Windows tint
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-3, -5, 8, 10);

      // Wheels
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(-13, -10, 5, 3);
      ctx.fillRect(-13, 7, 5, 3);
      ctx.fillRect(8, -10, 5, 3);
      ctx.fillRect(8, 7, 5, 3);

      // Wheel shine
      ctx.fillStyle = '#666';
      ctx.fillRect(-11, -9, 2, 1);
      ctx.fillRect(9, -9, 2, 1);

      // Front detail
      ctx.fillStyle = '#fff';
      ctx.fillRect(13, -4, 3, 2);
      ctx.fillRect(13, 2, 3, 2);

      ctx.restore();
    }
  }

  // ── Track ─────────────────────────────────────
  class Track {
    constructor() {
      this.innerPoints = [[105, 105], [595, 105], [595, 295], [105, 295]];
      this.outerPoints = [[55, 55], [645, 55], [645, 345], [55, 345]];
    }

    draw() {
      // Background
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Infield decorations
      this.drawInfield();

      // Track surface
      ctx.fillStyle = colors.lightGray;
      ctx.beginPath();
      ctx.moveTo(this.outerPoints[0][0], this.outerPoints[0][1]);
      for (let pt of this.outerPoints) ctx.lineTo(pt[0], pt[1]);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colors.darkGray;
      ctx.beginPath();
      ctx.moveTo(this.innerPoints[0][0], this.innerPoints[0][1]);
      for (let pt of this.innerPoints) ctx.lineTo(pt[0], pt[1]);
      ctx.closePath();
      ctx.fill();

      // Skid marks
      for (let s of skidMarks) {
        ctx.save();
        ctx.globalAlpha = s.life * 0.35;
        ctx.fillStyle = '#111';
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        ctx.restore();
        s.life -= 0.003;
      }
      skidMarks = skidMarks.filter(s => s.life > 0);

      this.drawBrickWall(this.outerPoints);
      this.drawBrickWall(this.innerPoints);

      // Center dashed line
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([15, 15]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 80);
      ctx.lineTo(620, 80);
      ctx.lineTo(620, 320);
      ctx.lineTo(80, 320);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      // Checkered finish line
      const sq = 10;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? colors.white : colors.darkGray;
          ctx.fillRect(350 + j * sq, 300 + i * sq, sq, sq);
        }
      }

      // Finish line label
      ctx.save();
      ctx.translate(375, 298);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = colors.yellow;
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', 0, 0);
      ctx.restore();
    }

    drawInfield() {
      // Infield grass pattern
      ctx.fillStyle = '#1e2a1e';
      ctx.fillRect(105, 105, 490, 190);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 110; x < 595; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, 295); ctx.stroke();
      }
      for (let y = 110; y < 295; y += 30) {
        ctx.beginPath(); ctx.moveTo(105, y); ctx.lineTo(595, y); ctx.stroke();
      }

      // CarOnSale ASCII logo in infield
      ctx.save();
      ctx.shadowColor = colors.yellow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = colors.yellow;
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      const infieldLogo = [
        "  ___          ___      ___      _      ",
        " / __|__ _ _ / _ \\_ _ / __| __ _| |___",
        "| (__/ _` | | (_) | ' \\\\__ \\/ _` | / -_)",
        " \\___\\__,_|  \\___/|_||_|___/\\__,_|_\\___|"
      ];
      const startY = 148;
      for (let i = 0; i < infieldLogo.length; i++) {
        ctx.fillText(infieldLogo[i], 350, startY + i * 13);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = colors.lightBlue;
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText('RACE EDITION', 350, startY + infieldLogo.length * 13 + 6);
      ctx.restore();
    }

    drawBrickWall(points) {
      const brickH = 10, brickW = 20;
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const count = Math.floor(dist / brickW);
        for (let j = 0; j < count; j++) {
          ctx.save();
          ctx.translate(x1 + dx * j / count, y1 + dy * j / count);
          ctx.rotate(angle);
          ctx.fillStyle = j % 2 === 0 ? colors.brickRed : '#7a3522';
          ctx.fillRect(0, -brickH / 2, brickW, brickH);
          ctx.strokeStyle = colors.brickDark;
          ctx.lineWidth = 1;
          ctx.strokeRect(0, -brickH / 2, brickW, brickH);
          // mortar highlight
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(1, -brickH / 2 + 1, brickW - 2, 2);
          ctx.restore();
        }
      }
    }
  }

  // ── Input ──────────────────────────────────────
  const keys = {};
  document.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  // ── HUD ────────────────────────────────────────
  function drawHUD() {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, 42);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 42); ctx.lineTo(canvas.width, 42);
    ctx.stroke();

    // ASCII Logo in top bar
    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.fillText('[ CarOnSale RACE ]', canvas.width / 2, 26);

    // Lap indicators
    ctx.textAlign = 'left';
    ctx.font = '9px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText('LAP', 10, 22);

    for (let i = 1; i <= 3; i++) {
      const lx = 50 + (i - 1) * 22;
      ctx.fillStyle = car.lap > i ? colors.yellow : (car.lap === i ? colors.white : colors.lightGray);
      ctx.fillText(i === car.lap ? `[${i}]` : ` ${i} `, lx, 22);
    }

    // Time
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.lightBlue;
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText(`${gameStarted ? currentTime.toFixed(2) : '0.00'}s`, canvas.width - 10, 22);

    // Speedometer
    drawSpeedometer(car.speed);
  }

  // ── Draw Header logo ───────────────────────────
  function drawHeaderLogo(centerX, y) {
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.yellow;
    ctx.shadowColor = colors.yellow;
    ctx.shadowBlur = 6;
    ctx.fillText('[ CarOnSale ]', centerX, y);
    ctx.shadowBlur = 0;
  }

  // ── Countdown ──────────────────────────────────
  function startCountdown(cb) {
    let count = 3;
    countdown = count;
    const iv = setInterval(() => {
      count--;
      countdown = count;
      if (count <= 0) {
        clearInterval(iv);
        countdown = 0;
        cb();
      }
    }, 800);
  }

  function drawCountdown() {
    if (countdown > 0) {
      ctx.save();
      ctx.font = '60px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = countdown === 1 ? colors.green : colors.yellow;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 20;
      ctx.fillText(countdown, canvas.width / 2, canvas.height / 2 + 20);
      ctx.restore();
    }
  }

  // ── Menu ───────────────────────────────────────
  function drawMenu() {
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, 42);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 42); ctx.lineTo(canvas.width, 42); ctx.stroke();
    drawHeaderLogo(canvas.width / 2, 26);

    // Grid bg
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Big ASCII Art Logo - CarOnSale
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    const bigLogo = [
      "  ___          ___      ___      _      ",
      " / __|__ _ _ / _ \\ _ _ / __| __ _| |___ ",
      "| (__/ _` | | (_) | ' \\ \\__ \\/ _` | / -_)",
      " \\___\\__,_|  \\___/|_||_|___/\\__,_|_\\___|"
    ];
    ctx.save();
    ctx.shadowColor = colors.yellow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = colors.yellow;
    for (let i = 0; i < bigLogo.length; i++) {
      ctx.fillText(bigLogo[i], canvas.width / 2, 100 + i * 18);
    }
    ctx.restore();

    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = colors.lightBlue;
    ctx.fillText('RACE EDITION', canvas.width / 2, 180);

    // Subtitle
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText('3 LAPS · BEAT YOUR TIME', canvas.width / 2, 230);

    // Controls box
    ctx.fillStyle = 'rgba(255,212,82,0.08)';
    ctx.fillRect(200, 255, 300, 90);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.strokeRect(200, 255, 300, 90);

    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = colors.lightGray;
    const controls = ['↑  ACCELERATE', '↓  BRAKE / REVERSE', '← →  STEER', 'SPACE  BOOST'];
    controls.forEach((c, i) => {
      ctx.fillStyle = i % 2 === 0 ? colors.white : colors.lightBlue;
      ctx.fillText(c, canvas.width / 2, 272 + i * 16);
    });

    // Decorative mini car in menu
    ctx.save();
    ctx.translate(350, 360);
    drawMiniCar();
    ctx.restore();
  }

  function drawMiniCar() {
    const t = Date.now() / 400;
    ctx.translate(Math.sin(t) * 20, 0);
    ctx.fillStyle = colors.yellow;
    ctx.fillRect(-15, -8, 30, 16);
    ctx.fillStyle = colors.lightBlue;
    ctx.fillRect(-4, -6, 10, 12);
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(-13, -10, 5, 3);
    ctx.fillRect(-13, 7, 5, 3);
    ctx.fillRect(8, -10, 5, 3);
    ctx.fillRect(8, 7, 5, 3);
  }

  // ── Finished Screen ────────────────────────────
  function drawFinished() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Trophy ASCII
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.yellow;
    ctx.shadowColor = colors.yellow;
    ctx.shadowBlur = 10;
    const trophy = [" _____", "(     )", " )   (", "(_____)", "  | |  ", " _|_|_ "];
    trophy.forEach((l, i) => ctx.fillText(l, canvas.width / 2, 120 + i * 15));
    ctx.shadowBlur = 0;

    ctx.font = '22px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.fillText('RACE OVER!', canvas.width / 2, 240);

    ctx.font = '13px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText(`TIME: ${finalTime.toFixed(2)}s`, canvas.width / 2, 275);

    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = colors.lightBlue;
    let rating = finalTime < 30 ? 'LEGENDARY!' : finalTime < 50 ? 'GREAT DRIVE!' : 'KEEP RACING!';
    ctx.fillText(rating, canvas.width / 2, 305);

    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    startButton.style.display = 'flex';
    startButton.textContent = 'PLAY AGAIN';
  }

  // ── Game loop ──────────────────────────────────
  function startGame() {
    gameState = 'countdown';
    gameStarted = false;
    startButton.style.display = 'none';
    skidMarks = [];
    particles = [];
    car = new Car();
    track = new Track();
    startTime = null;
    currentTime = 0;
    finalTime = 0;

    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 1000 / 60);

    startCountdown(() => {
      gameState = 'playing';
    });
  }

  function update() {
    if (gameState === 'playing') {
      car.update();
      updateParticles();
      if (gameStarted) currentTime = (Date.now() - startTime) / 1000;
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';

    if (gameState === 'menu') {
      drawMenu();
    } else if (gameState === 'countdown' || gameState === 'playing' || gameState === 'finished') {
      track.draw();
      drawParticles();
      if (car) car.draw();
      drawHUD();

      if (gameState === 'countdown') drawCountdown();
      if (gameState === 'finished') drawFinished();
    }
  }

  startButton.onclick = startGame;
  startButton.style.display = 'flex';
  draw();
  // Animate menu car
  setInterval(() => { if (gameState === 'menu') draw(); }, 50);
}

document.addEventListener('DOMContentLoaded', initCarRaceGame);
</script>
</body>
</html>
