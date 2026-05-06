// ── Supabase Config ───────────────────────────
const SUPABASE_URL = 'https://rwuogkjbpnhahdvudxax.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3dW9na2picG5oYWhkdnVkeGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzI3NzYsImV4cCI6MjA5MzY0ODc3Nn0.ZoNkmUpMivwl3GlHl63qhgRPrQ4nbnsniUCftakRghY';

async function supabaseFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return res.json();
}

// Wochenanfang (Montag 00:00 MEZ) als ISO-String
function getWeekStart() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const mez = new Date(utc + 3600000); // MEZ = UTC+1 (vereinfacht)
  const day = mez.getDay(); // 0=So, 1=Mo...
  const diff = (day === 0 ? -6 : 1 - day);
  mez.setDate(mez.getDate() + diff);
  mez.setHours(0, 0, 0, 0);
  return new Date(mez.getTime() - 3600000).toISOString(); // zurück zu UTC
}

async function saveScore(username, timeSeconds) {
  await supabaseFetch('/rest/v1/scores', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ username, time_seconds: timeSeconds })
  });
}

async function loadLeaderboard() {
  const weekStart = getWeekStart();
  const data = await supabaseFetch(
    `/rest/v1/scores?select=username,time_seconds&created_at=gte.${weekStart}&order=time_seconds.asc&limit=10`
  );
  return Array.isArray(data) ? data : [];
}

// ── Game ──────────────────────────────────────
function initCarRaceGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startButton = document.getElementById('startButton');

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
  let skidMarks = [];
  let particles = [];
  let leaderboard = [];
  let showLeaderboard = false;

  // Username aus localStorage oder null
  let username = localStorage.getItem('cos_username') || null;

  // ── Username Prompt ────────────────────────────
  function getUsername() {
    return new Promise(resolve => {
      // Overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.85);
        display:flex;align-items:center;justify-content:center;z-index:999;
        font-family:'Press Start 2P',monospace;
      `;
      overlay.innerHTML = `
        <div style="background:#2F343E;border:2px solid #FFD452;padding:32px;text-align:center;max-width:360px;width:90%;">
          <div style="color:#FFD452;font-size:11px;margin-bottom:8px;">CarOnSale Race</div>
          <div style="color:#fff;font-size:9px;margin-bottom:24px;line-height:1.8;">Wähle deinen Fahrernamen</div>
          <input id="usernameInput" maxlength="16" placeholder="NAME..." style="
            width:100%;background:#1a1d24;border:2px solid #FFD452;color:#FFD452;
            font-family:'Press Start 2P',monospace;font-size:12px;padding:10px;
            text-align:center;outline:none;margin-bottom:16px;box-sizing:border-box;
          "/>
          <div id="usernameError" style="color:#e74c3c;font-size:7px;margin-bottom:12px;min-height:12px;"></div>
          <button id="usernameConfirm" style="
            background:#FFD452;color:#2F343E;border:none;
            font-family:'Press Start 2P',monospace;font-size:10px;
            padding:12px 24px;cursor:pointer;width:100%;
            box-shadow:4px 4px 0 #b8951a;
          ">START</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#usernameInput');
      const btn = overlay.querySelector('#usernameConfirm');
      const err = overlay.querySelector('#usernameError');
      input.focus();

      const confirm = () => {
        const val = input.value.trim().toUpperCase();
        if (!val || val.length < 2) {
          err.textContent = 'Mind. 2 Zeichen!';
          return;
        }
        localStorage.setItem('cos_username', val);
        document.body.removeChild(overlay);
        resolve(val);
      };

      btn.onclick = confirm;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
    });
  }

  // ── Speedometer ───────────────────────────────
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

    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, Math.PI * 0.75, Math.PI * 2.25, false);
    ctx.strokeStyle = colors.lightGray;
    ctx.lineWidth = 4;
    ctx.stroke();

    const maxSpeed = 8;
    const pct = Math.min(Math.abs(speed) / maxSpeed, 1);
    const startA = Math.PI * 0.75;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, startA, startA + pct * Math.PI * 1.5, false);
    ctx.strokeStyle = pct > 0.7 ? colors.red : colors.yellow;
    ctx.lineWidth = 4;
    ctx.stroke();

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
        life: 1, color
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    for (let p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.04; p.vx *= 0.95; p.vy *= 0.95;
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
      this.x = 375; this.y = 320;
      this.angle = 0; this.speed = 0;
      this.lap = 1; this.checkpoint = 0;
      this.boosting = false; this.boostCooldown = 0;
    }

    update() {
      if (!gameStarted && (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'])) {
        gameStarted = true;
        startTime = Date.now();
      }

      const accel = this.boosting ? 0.4 : 0.2;
      if (keys['ArrowUp']) this.speed += accel;
      if (keys['ArrowDown']) this.speed -= 0.15;

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
        if (Math.abs(this.speed) > 3 && (keys['ArrowLeft'] || keys['ArrowRight'])) {
          skidMarks.push({ x: this.x, y: this.y, life: 1 });
          if (skidMarks.length > 200) skidMarks.shift();
        }
        this.x = newX; this.y = newY;
      } else {
        spawnParticles(this.x, this.y, colors.brickRed, 4);
        this.speed *= -0.3;
      }

      if (this.x > 350 && this.x < 400 && this.y > 300 && this.y < 340) {
        if (this.checkpoint === 1) {
          if (this.lap < 3) {
            this.lap++;
            spawnParticles(this.x, this.y, colors.yellow, 20);
          } else {
            gameState = 'finished';
            finalTime = currentTime;
            clearInterval(gameLoop);
            onRaceFinished(finalTime);
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
      ctx.save();
      ctx.translate(this.x + 3, this.y + 4);
      ctx.rotate(this.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

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
      ctx.fillStyle = colors.yellow;
      ctx.fillRect(-15, -8, 30, 16);
      ctx.fillStyle = colors.lightBlue;
      ctx.fillRect(-4, -6, 10, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-3, -5, 8, 10);
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(-13, -10, 5, 3);
      ctx.fillRect(-13, 7, 5, 3);
      ctx.fillRect(8, -10, 5, 3);
      ctx.fillRect(8, 7, 5, 3);
      ctx.fillStyle = '#666';
      ctx.fillRect(-11, -9, 2, 1);
      ctx.fillRect(9, -9, 2, 1);
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
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.drawInfield();

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

      const sq = 10;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? colors.white : colors.darkGray;
          ctx.fillRect(350 + j * sq, 300 + i * sq, sq, sq);
        }
      }

      ctx.save();
      ctx.translate(375, 298);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = colors.yellow;
      ctx.textAlign = 'center';
      ctx.fillText('FINISH', 0, 0);
      ctx.restore();
    }

    drawInfield() {
      ctx.fillStyle = '#1e2a1e';
      ctx.fillRect(105, 105, 490, 190);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 110; x < 595; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, 295); ctx.stroke();
      }
      for (let y = 110; y < 295; y += 30) {
        ctx.beginPath(); ctx.moveTo(105, y); ctx.lineTo(595, y); ctx.stroke();
      }

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

  // ── Nach Rennende ──────────────────────────────
  async function onRaceFinished(time) {
    // Username holen (aus localStorage oder neu eingeben)
    if (!username) {
      username = await getUsername();
    }
    // Score speichern
    await saveScore(username, Math.round(time * 1000) / 1000);
    // Bestenliste neu laden
    leaderboard = await loadLeaderboard();
    showLeaderboard = true;
  }

  // ── HUD ────────────────────────────────────────
  function drawHUD() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, 42);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 42); ctx.lineTo(canvas.width, 42);
    ctx.stroke();

    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.fillText('[ CarOnSale RACE ]', canvas.width / 2, 26);

    ctx.textAlign = 'left';
    ctx.font = '9px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText('LAP', 10, 22);

    for (let i = 1; i <= 3; i++) {
      const lx = 50 + (i - 1) * 22;
      ctx.fillStyle = car.lap > i ? colors.yellow : (car.lap === i ? colors.white : colors.lightGray);
      ctx.fillText(i === car.lap ? `[${i}]` : ` ${i} `, lx, 22);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = colors.lightBlue;
    ctx.font = '9px "Press Start 2P"';
    ctx.fillText(`${gameStarted ? currentTime.toFixed(2) : '0.00'}s`, canvas.width - 10, 22);

    drawSpeedometer(car.speed);

    // NOS Tank
    const boostPct = 1 - Math.min(car.boostCooldown / 120, 1);
    const tankX = 610, tankY = 345, tankW = 12, tankH = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(tankX - 2, tankY - tankH - 2, tankW + 4, tankH + 4);
    ctx.fillStyle = colors.lightGray;
    ctx.fillRect(tankX, tankY - tankH, tankW, tankH);
    const fillH = tankH * boostPct;
    ctx.fillStyle = boostPct === 1 ? colors.yellow : boostPct > 0.3 ? '#ff9900' : colors.red;
    ctx.fillRect(tankX, tankY - fillH, tankW, fillH);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.strokeRect(tankX, tankY - tankH, tankW, tankH);
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.textAlign = 'center';
    ctx.fillText('NOS', tankX + tankW / 2, tankY + 8);
  }

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
      if (count <= 0) { clearInterval(iv); countdown = 0; cb(); }
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

  // ── Leaderboard Overlay ────────────────────────
  function drawLeaderboardOverlay() {
    // Dunkles Panel
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(120, 50, 460, 320);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 2;
    ctx.strokeRect(120, 50, 460, 320);

    // Titel
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.yellow;
    ctx.shadowBlur = 8;
    ctx.fillText('WEEK TOP 10', canvas.width / 2, 80);
    ctx.shadowBlur = 0;

    // Wochenzeitraum
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = colors.lightBlue;
    const now = new Date();
    const dayNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    ctx.fillText(`KW ${getWeekNumber(now)} · Mo–So MEZ`, canvas.width / 2, 96);

    // Einträge
    if (leaderboard.length === 0) {
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = colors.lightGray;
      ctx.fillText('Noch keine Einträge', canvas.width / 2, 200);
    } else {
      leaderboard.forEach((entry, i) => {
        const y = 122 + i * 24;
        const isPlayer = entry.username === username;

        // Highlight für Spieler
        if (isPlayer) {
          ctx.fillStyle = 'rgba(255,212,82,0.12)';
          ctx.fillRect(130, y - 10, 440, 20);
        }

        // Rang
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillStyle = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.lightGray;
        const medal = i === 0 ? '01' : i === 1 ? '02' : i === 2 ? '03' : `${String(i+1).padStart(2,'0')}`;
        ctx.fillText(medal, 140, y + 4);

        // Name
        ctx.fillStyle = isPlayer ? colors.yellow : colors.white;
        ctx.fillText(entry.username.substring(0, 12), 175, y + 4);

        // Zeit
        ctx.textAlign = 'right';
        ctx.fillStyle = isPlayer ? colors.yellow : colors.lightBlue;
        ctx.fillText(`${Number(entry.time_seconds).toFixed(2)}s`, 550, y + 4);
      });
    }

    // Hinweis
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = colors.lightGray;
    ctx.textAlign = 'center';
    ctx.fillText('ENTER oder Button zum Neustart', canvas.width / 2, 358);
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // ── Menu ───────────────────────────────────────
  function drawMenu() {
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, 42);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 42); ctx.lineTo(canvas.width, 42); ctx.stroke();
    drawHeaderLogo(canvas.width / 2, 26);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

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

    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText('3 LAPS · BEAT YOUR TIME', canvas.width / 2, 218);

    // Bestenliste Button im Menü
    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = colors.lightGray;
    ctx.fillText('[ L ] BESTENLISTE', canvas.width / 2, 244);

    ctx.fillStyle = 'rgba(255,212,82,0.08)';
    ctx.fillRect(200, 258, 300, 90);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.strokeRect(200, 258, 300, 90);

    ctx.font = '7px "Press Start 2P"';
    const controls = ['↑  ACCELERATE', '↓  BRAKE / REVERSE', '← →  STEER', 'SPACE  BOOST'];
    controls.forEach((c, i) => {
      ctx.fillStyle = i % 2 === 0 ? colors.white : colors.lightBlue;
      ctx.fillText(c, canvas.width / 2, 275 + i * 16);
    });

    ctx.save();
    ctx.translate(350, 370);
    drawMiniCar();
    ctx.restore();

    // Username anzeigen falls gesetzt
    if (username) {
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = colors.lightGray;
      ctx.textAlign = 'right';
      ctx.fillText(`FAHRER: ${username}`, canvas.width - 10, canvas.height - 10);
    }
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

    if (showLeaderboard) {
      drawLeaderboardOverlay();
    } else {
      // Warte-Animation während Score gespeichert wird
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.yellow;
      ctx.fillText('RACE OVER!', canvas.width / 2, 200);
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = colors.lightGray;
      ctx.fillText(`TIME: ${finalTime.toFixed(2)}s`, canvas.width / 2, 230);
      ctx.fillText('Speichere Ergebnis...', canvas.width / 2, 260);
    }

    startButton.style.display = 'flex';
    startButton.textContent = 'PLAY AGAIN';
  }

  // ── Game loop ──────────────────────────────────
  async function startGame() {
    // Username beim ersten Start abfragen
    if (!username) {
      username = await getUsername();
    }

    gameState = 'countdown';
    gameStarted = false;
    showLeaderboard = false;
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

    startCountdown(() => { gameState = 'playing'; });
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

  // L-Taste öffnet Bestenliste im Menü
  document.addEventListener('keydown', async e => {
    if (e.key === 'l' || e.key === 'L') {
      if (gameState === 'menu') {
        leaderboard = await loadLeaderboard();
        showLeaderboard = true;
        gameState = 'finished';
        draw();
      }
    }
    if (e.key === 'Enter' && gameState === 'finished') {
      startGame();
    }
  });

  startButton.onclick = startGame;
  positionButton(startButton);

  document.fonts.ready.then(() => {
    draw();
    setInterval(() => { if (gameState === 'menu') draw(); }, 50);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initCarRaceGame();
});
