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
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCHours(monday.getUTCHours() - 1);
  return monday.toISOString();
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function saveScore(username, goals) {
  await supabaseFetch('/rest/v1/kick_scores', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ username, goals_scored: goals })
  });
}

async function loadLeaderboard() {
  const data = await supabaseFetch(
    `/rest/v1/kick_leaderboard?select=username,goals_scored`
  );
  return Array.isArray(data) ? data : [];
}

// ── Game Init ─────────────────────────────────
function initSoccerGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startButton = document.getElementById('startButton');
  const buttonRow = document.getElementById('buttonRow');
  const btnRestart = document.getElementById('btnRestart');

  // FIX 1: canvas is now 900×500 (declared in HTML); W/H read from it
  const W = canvas.width;   // 900
  const H = canvas.height;  // 500

  const colors = {
    yellow: '#FFD452', yellowDim: '#b8951a',
    darkGray: '#2F343E', lightGray: '#474B57',
    white: '#FFFFFF', lightBlue: '#BAC5E5',
    green: '#2d7a2d', greenLight: '#357a35', greenDark: '#1a4d1a',
    red: '#e74c3c', netGray: 'rgba(255,255,255,0.25)',
    grass1: '#2d6e2d', grass2: '#276227'
  };

  // ── State ─────────────────────────────────────
  let gameState = 'menu';
  let goals = 0, timeLeft = 30, timerInterval = null;
  let countdown = 0, finalGoals = 0;
  let leaderboard = [], showLeaderboard = false;
  const _urlParams = new URLSearchParams(window.location.search);
  const _pidFromUrl = _urlParams.get('pid');
  if (_pidFromUrl) localStorage.setItem('cos_kick_username', _pidFromUrl);
  let username = _pidFromUrl || localStorage.getItem('cos_kick_username') || null;
  let inputActive = false;
  let particles = [], confetti = [];
  let streakCount = 0, streakBonus = false, streakTimer = 0;
  let gameLoop = null;
  let missedShot = false, missedTimer = 0;
  let goalFlash = 0;
  let spectatorTimer = 0;

  // ── Player ────────────────────────────────────
  let player = null;
  class Player {
    constructor() {
      this.x = W / 2;
      this.y = H - 120;
      this.speed = 4;
      this.hasBall = true;
      this.powerCharging = false;
      this.power = 0;
    }
    update() {
      if (!player.hasBall) return;
      if (keys['ArrowLeft'])  this.x = Math.max(60, this.x - this.speed);
      if (keys['ArrowRight']) this.x = Math.min(W - 60, this.x + this.speed);
      if (keys['ArrowUp'] && !shot) {
        this.powerCharging = true;
        this.power = Math.min(1, this.power + 0.025);
      } else if (this.powerCharging && !shot) {
        // released – wait for Space
      }
    }
    draw() {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x + 3, this.y + 18, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, 10, 5, 12);
      ctx.fillRect(1, 10, 5, 12);
      ctx.fillStyle = colors.yellow;
      ctx.fillRect(-9, -2, 18, 14);
      ctx.fillStyle = colors.darkGray;
      ctx.font = '5px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('1', 0, 8);
      ctx.fillStyle = '#f0c080';
      ctx.fillRect(-5, -14, 10, 12);
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(-5, -14, 10, 4);
      ctx.restore();

      if (this.hasBall && !shot) drawBall(this.x, this.y + 22, 7);

      if (this.powerCharging && !shot) {
        const bw = 70, bh = 10;
        const bx = this.x - bw / 2, by = this.y - 44;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = colors.lightGray;
        ctx.fillRect(bx, by, bw, bh);
        const pct = this.power;
        ctx.fillStyle = pct > 0.8 ? colors.red : pct > 0.5 ? '#ff9900' : colors.yellow;
        ctx.fillRect(bx, by, bw * pct, bh);
        ctx.strokeStyle = colors.yellow;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.font = '5px "Press Start 2P"';
        ctx.fillStyle = colors.white;
        ctx.textAlign = 'center';
        ctx.fillText('POWER', this.x, by - 4);
      }
    }
  }

  // ── Goalkeeper ────────────────────────────────
  let keeper = null;
  class Goalkeeper {
    constructor() {
      this.x = W / 2;
      this.y = 90;
      this.targetX = W / 2;
      this.speed = 2.5 + Math.random() * 1.5;
      this.reactionDelay = 18 + Math.floor(Math.random() * 20);
      this.reactionTimer = 0;
      this.diving = false;
      this.diveDir = 0;
      this.saved = false;
    }
    trackBall() {
      if (this.diving) return;
      this.reactionTimer++;
      if (this.reactionTimer >= this.reactionDelay && shot) {
        this.targetX = shot.x + (Math.random() - 0.5) * 120;
        this.reactionTimer = 0;
      }
      if (!shot) {
        if (Math.random() < 0.04) this.targetX = 160 + Math.random() * (W - 320);
        if (Math.random() < 0.005) this.targetX = Math.random() < 0.5 ? 170 : W - 170;
      }
      const dx = this.targetX - this.x;
      if (Math.abs(dx) > 1) this.x += Math.sign(dx) * Math.min(this.speed, Math.abs(dx));
      this.x = Math.max(180, Math.min(W - 180, this.x));
    }
    draw() {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(this.x + 3, this.y + 18, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(this.x, this.y);
      if (this.diving) ctx.rotate(this.diveDir * 0.5);
      ctx.fillStyle = '#2255cc';
      ctx.fillRect(-6, 10, 5, 12);
      ctx.fillRect(1, 10, 5, 12);
      ctx.fillStyle = '#1a8a3a';
      ctx.fillRect(-9, -2, 18, 14);
      ctx.fillStyle = '#ffa500';
      ctx.fillRect(-12, 2, 4, 6);
      ctx.fillRect(8, 2, 4, 6);
      ctx.fillStyle = '#f0c080';
      ctx.fillRect(-5, -14, 10, 12);
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(-6, -15, 12, 4);
      ctx.restore();
    }
    checkSave(bx, by, br) {
      if (this.saved) return false;
      const dx = bx - this.x, dy = by - this.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22 + br) {
        this.saved = true;
        this.diving = true;
        this.diveDir = Math.sign(dx);
        setTimeout(() => { this.diving = false; this.saved = false; }, 600);
        return true;
      }
      return false;
    }
  }

  // ── Shot / Ball ───────────────────────────────
  let shot = null;
  function fireShot(px, power, chip) {
    if (!player || !player.hasBall || shot) return;
    player.hasBall = false;
    player.powerCharging = false;
    const angle = chip
      ? -Math.PI / 2 - 0.3 + (Math.random() - 0.5) * 0.4
      : -Math.PI / 2 + (px - W / 2) / (W / 2) * 0.5;
    const spd = chip ? 4 + power * 3 : 5 + power * 8;
    shot = {
      x: px, y: player.y + 10,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r: 8, chip, arc: chip ? -0.08 : 0,
      spin: (Math.random() - 0.5) * 0.3
    };
  }

  function updateShot() {
    if (!shot) return;
    shot.x += shot.vx;
    shot.y += shot.vy;
    shot.vy += shot.arc;
    shot.arc += 0.004;

    if (shot.y < 140 && keeper) {
      if (keeper.checkSave(shot.x, shot.y, shot.r)) {
        spawnParticles(shot.x, shot.y, colors.red, 12);
        streakCount = 0; streakBonus = false;
        shot = null; resetRound(); return;
      }
    }

    if (shot.y < 78 && shot.x > 220 && shot.x < W - 220) {
      onGoal(); return;
    }

    if (shot.y < 20 || shot.x < 20 || shot.x > W - 20 || shot.y > H + 20) {
      spawnParticles(shot.x, Math.max(20, shot.y), '#888', 8);
      streakCount = 0; streakBonus = false;
      missedShot = true; missedTimer = 90;
      shot = null; resetRound();
    }
  }

  function drawBall(x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.white;
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSoccerBall(x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    const pts = 5, ir = r * 0.38;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      i === 0 ? ctx.moveTo(x + Math.cos(a)*ir, y + Math.sin(a)*ir)
              : ctx.lineTo(x + Math.cos(a)*ir, y + Math.sin(a)*ir);
    }
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * r * 0.62;
      const py = y + Math.sin(a) * r * 0.62;
      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const pa = a + (j / 5) * Math.PI * 2;
        const pr = r * 0.26;
        j === 0 ? ctx.moveTo(px + Math.cos(pa)*pr, py + Math.sin(pa)*pr)
                : ctx.lineTo(px + Math.cos(pa)*pr, py + Math.sin(pa)*pr);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function onGoal() {
    const pts = streakBonus ? 2 : 1;
    goals += pts;
    streakCount++;
    goalFlash = 20;
    spawnParticles(shot.x, shot.y, colors.yellow, 25);
    if (streakCount >= 3) {
      streakBonus = true; streakTimer = 300;
      spawnParticles(W / 2, H / 2, colors.yellow, 40);
    }
    shot = null; resetRound();
  }

  function resetRound() {
    setTimeout(() => {
      if (gameState !== 'playing') return;
      player = new Player();
      keeper = new Goalkeeper();
    }, 600);
  }

  // ── Particles ─────────────────────────────────
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 1, color });
    }
  }
  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    for (let p of particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.04; p.vx *= 0.93; p.vy *= 0.93; }
  }
  function drawParticles() {
    for (let p of particles) {
      ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6); ctx.restore();
    }
  }

  // ── Confetti ──────────────────────────────────
  function spawnConfetti() {
    for (let i = 0; i < 150; i++) confetti.push({
      x: Math.random() * W, y: -10 - Math.random() * 80,
      vx: (Math.random()-0.5)*3, vy: 2+Math.random()*3,
      color: ['#FFD452','#fff','#BAC5E5','#4CAF50','#e74c3c'][Math.floor(Math.random()*5)],
      size: 4+Math.random()*6, life: 1
    });
  }
  function updateConfetti() {
    confetti = confetti.filter(c => c.life > 0);
    for (let c of confetti) { c.x += c.vx; c.y += c.vy; c.life -= 0.007; }
  }
  function drawConfetti() {
    for (let c of confetti) {
      ctx.save(); ctx.globalAlpha = c.life; ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.size, c.size / 2); ctx.restore();
    }
  }

  // ── Spectators ────────────────────────────────
  const spectatorPositions = [55,85,115,145,175,205,240, 630,660,690,720,750,780,815];
  const spectatorFrames = [['o','|','/ \\'],['\\o/','|','/\\']];
  function drawSpectators() {
    spectatorTimer++;
    spectatorPositions.forEach((sx, i) => {
      const wave = Math.sin(spectatorTimer * 0.07 + i * 0.8) > 0.3;
      const celebrating = goalFlash > 0 || streakBonus;
      const frame = (wave || celebrating) ? 1 : 0;
      const col = i % 3 === 0 ? colors.yellow : i % 3 === 1 ? colors.lightBlue : colors.white;
      ctx.save();
      ctx.font = '8px monospace';
      ctx.fillStyle = col;
      ctx.textAlign = 'center';
      spectatorFrames[frame].forEach((line, li) => {
        ctx.fillText(line, sx, H - 28 + li * 10);
      });
      ctx.restore();
    });
  }

  // ── Pitch ─────────────────────────────────────
  function drawPitch() {
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#252930';
    ctx.fillRect(0, 0, W, H - 60);

    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? colors.grass1 : colors.grass2;
      ctx.fillRect(0, H - 60 - i * 40, W, 40);
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 + 90, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2 + 90); ctx.lineTo(W, H / 2 + 90);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(180, 65, W - 360, 150);
    ctx.strokeRect(290, 65, W - 580, 70);

    // Goal posts — scaled for 900px wide canvas
    const gx = 220, gw = W - 440, gh = 60;
    ctx.fillStyle = colors.white;
    ctx.fillRect(gx - 6, 40, 6, gh + 10);
    ctx.fillRect(gx + gw, 40, 6, gh + 10);
    ctx.fillRect(gx - 6, 38, gw + 12, 5);

    ctx.strokeStyle = colors.netGray;
    ctx.lineWidth = 1;
    for (let x = gx; x <= gx + gw; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 43); ctx.lineTo(x, 43 + gh); ctx.stroke();
    }
    for (let y = 43; y <= 43 + gh; y += 12) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke();
    }

    if (goalFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (goalFlash / 20) * 0.4;
      ctx.fillStyle = colors.yellow;
      ctx.fillRect(gx, 40, gw, gh);
      ctx.restore();
      goalFlash--;
    }

    ctx.fillStyle = '#1e2228';
    ctx.fillRect(0, H - 60, W, 60);
  }

  // ── HUD ───────────────────────────────────────
  function drawHUD() {
    // HUD bar
    ctx.fillStyle = 'rgba(0,0,0,0.90)';
    ctx.fillRect(0, 0, W, 42);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 42); ctx.lineTo(W, 42); ctx.stroke();

    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.fillText('[ CarOnSale KICK ]', W / 2, 24);

    // Goals
    ctx.textAlign = 'left';
    ctx.font = '11px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.fillText('⚽', 12, 24);
    ctx.fillStyle = colors.yellow;
    ctx.fillText(String(goals).padStart(2, '0'), 36, 24);

    // FIX 4: Timer — larger, pill background, urgent colour
    const timerStr = `${String(timeLeft).padStart(2, '0')}s`;
    const urgent = timeLeft <= 10;
    const timerX = W - 14;
    const timerY = 12;
    const timerW = 68, timerH = 22;
    // Pill background
    ctx.fillStyle = urgent ? 'rgba(231,76,60,0.30)' : 'rgba(186,197,229,0.12)';
    ctx.beginPath();
    ctx.roundRect(timerX - timerW, timerY, timerW, timerH, 4);
    ctx.fill();
    ctx.strokeStyle = urgent ? colors.red : colors.lightBlue;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(timerX - timerW, timerY, timerW, timerH, 4);
    ctx.stroke();
    // Timer text
    ctx.font = urgent ? 'bold 12px "Press Start 2P"' : '11px "Press Start 2P"';
    ctx.fillStyle = urgent ? colors.red : colors.lightBlue;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(timerStr, timerX - 6, timerY + timerH / 2);
    ctx.textBaseline = 'middle'; // reset after

    if (streakBonus) {
      const pulse = Math.sin(Date.now() * 0.01) > 0;
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = pulse ? colors.yellow : colors.red;
      ctx.textAlign = 'center';
      ctx.fillText('🔥 x2 STREAK!', W / 2, 56);
      streakTimer--;
      if (streakTimer <= 0) { streakBonus = false; streakCount = 0; }
    }

    if (missedShot && missedTimer > 0) {
      ctx.font = '9px "Press Start 2P"';
      ctx.fillStyle = colors.red;
      ctx.globalAlpha = missedTimer / 90;
      ctx.textAlign = 'center';
      ctx.fillText('MISSED!', W / 2, H / 2 + 50);
      ctx.globalAlpha = 1;
      missedTimer--;
      if (missedTimer <= 0) missedShot = false;
    }

    if (!shot && player && player.hasBall && gameState === 'playing') {
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      if (!player.powerCharging) {
        ctx.fillText('↑ HOLD FOR POWER  ·  SPACE = SHOOT  ·  ↓ = CHIP', W / 2, H - 72);
      } else {
        ctx.fillText('SPACE = SHOOT  ·  ↓ = CHIP', W / 2, H - 72);
      }
    }
  }

  // ── FIGlet dot-matrix "CarOnSale" ──
  function drawFiglet(centerX, topY) {
    const glyphs = {
      'C': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]],
      'a': [[0,1,1,1,0],[0,0,0,0,1],[0,1,1,1,1],[1,0,0,0,1],[1,0,0,1,1],[0,1,1,0,1],[0,0,0,0,0]],
      'r': [[0,0,0,0,0],[1,0,1,1,0],[1,1,0,0,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,0,0,0,0]],
      'O': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
      'n': [[0,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
      'S': [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
      'l': [[1,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,1,1,0]],
      'e': [[0,1,1,1,0],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
    };
    const letters = ['C','a','r','O','n','S','a','l','e'];
    const dotW = 5, dotH = 4, dotGapX = 2, dotGapY = 2;
    const colW = dotW + dotGapX, rowH = dotH + dotGapY;
    const letterW = 5 * colW, letterGap = 6;
    const totalW = letters.length * letterW + (letters.length - 1) * letterGap;
    const startX = centerX - totalW / 2;
    ctx.save();
    letters.forEach((ch, li) => {
      const glyph = glyphs[ch]; if (!glyph) return;
      const lx = startX + li * (letterW + letterGap);
      glyph.forEach((row, ri) => {
        row.forEach((on, ci) => {
          const px = lx + ci * colW, py = topY + ri * rowH;
          if (on) { ctx.shadowColor = '#FFD452'; ctx.shadowBlur = 7; ctx.fillStyle = '#FFD452'; }
          else { ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,212,82,0.09)'; }
          ctx.fillRect(px, py, dotW, dotH);
        });
      });
    });
    ctx.shadowBlur = 0; ctx.restore();
  }

  // ── Menu ──────────────────────────────────────
  function drawMenu() {
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W, 48);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 48); ctx.lineTo(W, 48); ctx.stroke();
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.yellow; ctx.shadowBlur = 6;
    ctx.fillText('[ CarOnSale KICK ]', W / 2, 30);
    ctx.shadowBlur = 0;

    drawFiglet(W / 2, 62);

    ctx.font = '13px "Press Start 2P"';
    ctx.fillStyle = colors.white;
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.lightBlue; ctx.shadowBlur = 6;
    ctx.fillText('K I C K', W / 2, 180);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(130, 194); ctx.lineTo(W - 130, 194); ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '9px "Press Start 2P"';
    ctx.fillStyle = colors.lightBlue;
    ctx.fillText('30 sec  ·  score goals  ·  beat the keeper', W / 2, 216);

    // FIX 3 + FIX 5: controls table — all arrows same font/size, consistent alignment
    const controls = [
      ['◀  ▶', 'MOVE'],
      ['↑ hold', 'POWER'],
      ['SPACE', 'SHOOT'],
      ['↓ hold', 'CHIP'],
    ];
    const boxX = 170, boxY = 234, boxW = W - 340, boxH = 116;
    ctx.fillStyle = 'rgba(255,212,82,0.07)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const rowHt = boxH / controls.length;
    const keyW = 80, keyH = 18;
    const arrowGap = 18, descGap = 14;
    const centerX2 = boxX + boxW / 2;
    const rowStartX = centerX2 - (keyW / 2 + arrowGap + descGap + 30);

    controls.forEach(([key, desc], i) => {
      const rowY = boxY + i * rowHt + rowHt / 2;
      const keyX = rowStartX;
      const keyY2 = rowY - keyH / 2;

      ctx.fillStyle = 'rgba(255,212,82,0.18)';
      ctx.fillRect(keyX, keyY2, keyW, keyH);
      ctx.strokeStyle = colors.yellow;
      ctx.lineWidth = 1;
      ctx.strokeRect(keyX, keyY2, keyW, keyH);

      // FIX 3: all key labels use the SAME font — no mixed unicode sizing issues
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = colors.yellow;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(key, keyX + keyW / 2, rowY);

      ctx.fillStyle = colors.lightGray;
      ctx.fillText('→', keyX + keyW + arrowGap, rowY);

      ctx.fillStyle = colors.white;
      ctx.textAlign = 'left';
      ctx.fillText(desc, keyX + keyW + arrowGap + descGap, rowY);
    });
    ctx.textBaseline = 'middle';

    ctx.font = '7px "Press Start 2P"';
    ctx.fillStyle = colors.red;
    ctx.textAlign = 'center';
    ctx.fillText('🔥  3 goals in a row  =  x2 points!', W / 2, 370);

    const bt = Date.now() / 500;
    const bBounce = Math.abs(Math.sin(bt)) * 32;
    const ballR = 12;
    const floorY = H - ballR - 2;
    drawSoccerBall(W / 2, floorY - bBounce, ballR);
  }

  // ── Leaderboard Overlay ───────────────────────
  function drawLeaderboardOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(80, 50, W - 160, H - 100);
    ctx.strokeStyle = colors.yellow;
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 50, W - 160, H - 100);

    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = colors.yellow;
    ctx.textAlign = 'center';
    ctx.shadowColor = colors.yellow; ctx.shadowBlur = 8;
    ctx.fillText('TOP 10', W / 2, 76);
    ctx.shadowBlur = 0;

    const now = new Date();
    const dd = String(now.getDate()).padStart(2,'0');
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const yyyy = now.getFullYear();
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = colors.lightBlue;
    ctx.fillText(`${dd}.${mm}.${yyyy}`, W / 2, 94);

    if (leaderboard.length === 0) {
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = colors.lightGray;
      ctx.fillText('No entries yet', W / 2, H / 2);
    } else {
      const ordinals = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th'];
      const anonLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      let anonIdx = 0;
      const anonMap = {};
      leaderboard.forEach(entry => {
        if (entry.username !== username && !anonMap[entry.username]) {
          anonMap[entry.username] = 'Player ' + anonLetters[anonIdx++ % anonLetters.length];
        }
      });
      leaderboard.forEach((entry, i) => {
        const y = 114 + i * 24;
        const isMe = entry.username === username;
        if (isMe) {
          ctx.fillStyle = 'rgba(255,212,82,0.22)';
          ctx.fillRect(88, y - 9, W - 176, 22);
        }
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'left';
        const rankLabel = ordinals[i] || `${i+1}th`;
        ctx.fillStyle = i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':colors.lightGray;
        ctx.fillText(rankLabel, 96, y + 4);
        if (isMe) {
          ctx.fillStyle = colors.yellow;
          ctx.shadowColor = colors.yellow; ctx.shadowBlur = 6;
          ctx.fillText('You', 150, y + 4);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = colors.lightGray;
          ctx.fillText(anonMap[entry.username], 150, y + 4);
        }
        ctx.textAlign = 'right';
        ctx.fillStyle = isMe ? colors.yellow : colors.lightBlue;
        ctx.fillText(`${entry.goals_scored} ⚽`, W - 96, y + 4);
      });
    }
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = colors.lightGray;
    ctx.textAlign = 'center';
    ctx.fillText('ENTER = PLAY AGAIN', W / 2, H - 60);
  }

  // ── Leaderboard Page ──────────────────────────
  function showLeaderboardPage() {
    const w = window.open('', '_blank');
    const kw = getWeekNumber(new Date());
    const rows = leaderboard.length === 0
      ? `<tr><td colspan="3" style="text-align:center;color:#474B57;padding:32px;">No entries this week yet</td></tr>`
      : leaderboard.map((e, i) => {
          const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;
          const hl = e.username===username?'background:rgba(255,212,82,0.12);':'';
          return `<tr style="${hl}">
            <td style="color:${i<3?'#FFD452':'#474B57'};padding:12px 16px;">${medal}</td>
            <td style="color:${e.username===username?'#FFD452':'#fff'};padding:12px 16px;">${e.username}</td>
            <td style="color:#BAC5E5;padding:12px 16px;text-align:right;">${e.goals_scored} ⚽</td>
          </tr>`;
        }).join('');
    w.document.write(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><title>CarOnSale KICK – Top 10 Week ${kw}</title>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
      <style>*{margin:0;padding:0;box-sizing:border-box;}
      body{background:#1a1d24;color:#fff;font-family:'Press Start 2P',monospace;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           min-height:100vh;padding:40px 20px;}
      .card{background:#2F343E;border:2px solid #FFD452;
            box-shadow:0 0 30px rgba(255,212,82,0.3);padding:40px;max-width:560px;width:100%;}
      h1{color:#FFD452;font-size:14px;text-align:center;margin-bottom:8px;
         text-shadow:0 0 12px rgba(255,212,82,0.6);}
      .sub{color:#474B57;font-size:7px;text-align:center;margin-bottom:32px;}
      table{width:100%;border-collapse:collapse;font-size:9px;}
      thead tr{border-bottom:1px solid #FFD452;}
      thead th{color:#FFD452;padding:8px 16px;text-align:left;font-size:7px;}
      thead th:last-child{text-align:right;}
      tbody tr{border-bottom:1px solid rgba(255,255,255,0.05);}
      tbody tr:hover{background:rgba(255,255,255,0.04);}
      .hint{margin-top:28px;color:#474B57;font-size:6px;text-align:center;line-height:2.2;}
      .back{display:block;margin-top:20px;text-align:center;color:#474B57;
            font-size:7px;cursor:pointer;text-decoration:none;}
      .back:hover{color:#FFD452;}</style>
    </head><body><div class="card">
      <h1>KICK TOP 10</h1>
      <p class="sub">Week ${kw} · Mon 00:00 – Sun 23:59</p>
      <table><thead><tr><th>RANK</th><th>PLAYER</th><th>GOALS</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="hint">Scores reset every Monday at 00:00</p>
      <a class="back" onclick="window.close()">← back to game</a>
    </div></body></html>`);
    w.document.close();
  }

  // ── Username ──────────────────────────────────
  function getUsername() {
    return new Promise(resolve => {
      inputActive = true;
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        font-family:'Press Start 2P',monospace;`;
      overlay.innerHTML = `
        <div style="background:#2F343E;border:2px solid #FFD452;padding:32px;
                    text-align:center;max-width:360px;width:90%;
                    box-shadow:0 0 30px rgba(255,212,82,0.4);">
          <div style="color:#FFD452;font-size:12px;margin-bottom:10px;">CarOnSale KICK</div>
          <div style="color:#fff;font-size:8px;margin-bottom:24px;line-height:2;">Pick your name</div>
          <input id="usernameInput" maxlength="16" placeholder="NAME..."
            autocomplete="off" spellcheck="false"
            style="width:100%;background:#1a1d24;border:2px solid #FFD452;
                   color:#FFD452;font-family:'Press Start 2P',monospace;
                   font-size:12px;padding:12px;text-align:center;
                   outline:none;margin-bottom:8px;box-sizing:border-box;letter-spacing:2px;"/>
          <div id="usernameError" style="color:#e74c3c;font-size:7px;margin-bottom:14px;min-height:16px;line-height:2;"></div>
          <button id="usernameConfirm"
            style="background:#FFD452;color:#2F343E;border:none;
                   font-family:'Press Start 2P',monospace;font-size:10px;
                   padding:14px 24px;cursor:pointer;width:100%;box-shadow:4px 4px 0 #b8951a;">
            KICK OFF!
          </button>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#usernameInput');
      const btn   = overlay.querySelector('#usernameConfirm');
      const err   = overlay.querySelector('#usernameError');
      setTimeout(() => input.focus(), 100);
      input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key==='Enter') doConfirm(); });
      input.addEventListener('keyup', e => e.stopPropagation());
      function doConfirm() {
        const val = input.value.trim().toUpperCase();
        if (!val || val.length < 2) { err.textContent = 'Min. 2 characters!'; input.focus(); return; }
        localStorage.setItem('cos_kick_username', val);
        document.body.removeChild(overlay);
        inputActive = false;
        resolve(val);
      }
      btn.onclick = doConfirm;
    });
  }

  // ── Touch Controls ────────────────────────────
  function setupTouchControls() {
    const wrapper = document.getElementById('touchControls');
    if (!wrapper) return;
    function getButtonsUnderTouches(e) {
      const active = new Set();
      for (let touch of e.touches) {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && el.dataset.key) active.add(el.dataset.key);
      }
      return active;
    }
    function applyTouches(e) {
      e.preventDefault();
      const active = getButtonsUnderTouches(e);
      ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].forEach(k => { keys[k] = active.has(k); });
      wrapper.querySelectorAll('[data-key]').forEach(btn => {
        btn.classList.toggle('tactive', active.has(btn.dataset.key));
      });
    }
    wrapper.addEventListener('touchstart', applyTouches, { passive: false });
    wrapper.addEventListener('touchmove',  applyTouches, { passive: false });
    wrapper.addEventListener('touchend',   applyTouches, { passive: false });
    wrapper.addEventListener('touchcancel',applyTouches, { passive: false });
  }

  // ── Font check ────────────────────────────────
  function waitForFont(cb) {
    const c2 = document.createElement('canvas');
    c2.width = 200; c2.height = 30;
    const ctx2 = c2.getContext('2d');
    ctx2.font = '8px monospace';
    const fw = ctx2.measureText('CarOnSale').width;
    let attempts = 0;
    const check = () => {
      ctx2.font = '8px "Press Start 2P"';
      if (ctx2.measureText('CarOnSale').width !== fw || attempts > 30) cb();
      else { attempts++; setTimeout(check, 100); }
    };
    check();
  }

  // ── Input ─────────────────────────────────────
  const keys = {};
  document.addEventListener('keydown', e => {
    if (inputActive) return;
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();

    if (e.code === 'Space' && gameState === 'playing' && player && player.hasBall) {
      fireShot(player.x, player.power, false);
    }
    if (e.code === 'ArrowDown' && gameState === 'playing' && player && player.hasBall && player.powerCharging) {
      fireShot(player.x, player.power, true);
    }
    if (!inputActive && (e.key==='l'||e.key==='L') && gameState==='menu') {
      loadLeaderboard().then(data => {
        leaderboard = data; showLeaderboard = true;
        gameState = 'finished';
        buttonRow.style.display = 'flex';
        startButton.style.display = 'none';
        draw();
      });
    }
    if (e.key==='Enter' && gameState==='finished') startGame();
  });
  document.addEventListener('keyup', e => {
    if (inputActive) return;
    keys[e.code] = false;
  });

  // ── Countdown ─────────────────────────────────
  // FIX 4: slower countdown (1 s per step) + "GET READY" label
  function startCountdown(cb) {
    let count = 3; countdown = count;
    const iv = setInterval(() => {
      count--; countdown = count;
      if (count <= 0) { clearInterval(iv); countdown = 0; cb(); }
    }, 1000); // was 800ms
  }

  function drawCountdown() {
    if (countdown > 0) {
      ctx.save();
      // "GET READY" label above the number
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.lightBlue;
      ctx.shadowColor = colors.lightBlue; ctx.shadowBlur = 10;
      ctx.fillText('GET READY', W / 2, H / 2 - 30);
      ctx.shadowBlur = 0;

      ctx.font = '72px "Press Start 2P"';
      ctx.fillStyle = countdown === 1 ? colors.green : colors.yellow;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 24;
      ctx.fillText(String(countdown), W / 2, H / 2 + 36);
      ctx.restore();
    }
  }

  // ── Finished ──────────────────────────────────
  function drawFinished() {
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillRect(0, 0, W, H);
    updateConfetti(); drawConfetti();
    if (showLeaderboard) {
      drawLeaderboardOverlay();
    } else {
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.yellow;
      ctx.fillText('FINAL WHISTLE!', W / 2, H / 2 - 36);
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = colors.lightGray;
      ctx.fillText(`GOALS: ${finalGoals} ⚽`, W / 2, H / 2 + 4);
      ctx.fillText('Saving score...', W / 2, H / 2 + 36);
    }
  }

  // ── After game ────────────────────────────────
  async function onGameFinished() {
    clearInterval(timerInterval);
    gameState = 'finished';
    finalGoals = goals;
    if (gameLoop) clearInterval(gameLoop);
    startButton.style.display = 'none';
    buttonRow.style.display = 'flex';
    if (!username) username = await getUsername();
    try {
      await saveScore(username, finalGoals);
      leaderboard = await loadLeaderboard();
      const myRank = leaderboard.findIndex(e =>
        e.username === username && Number(e.goals_scored) === finalGoals
      );
      if (myRank >= 0 && myRank < 3) spawnConfetti();
    } catch (e) {
      console.error('Error:', e);
      leaderboard = [{ username, goals_scored: finalGoals }];
    }
    showLeaderboard = true;
    draw();
  }

  // ── Start Game ────────────────────────────────
  async function startGame() {
    if (!username) username = await getUsername();
    gameState = 'countdown';
    showLeaderboard = false;
    goals = 0; timeLeft = 30;
    streakCount = 0; streakBonus = false; streakTimer = 0;
    particles = []; confetti = [];
    shot = null; player = null; keeper = null;
    startButton.style.display = 'none';
    buttonRow.style.display = 'none';
    if (gameLoop) clearInterval(gameLoop);
    if (timerInterval) clearInterval(timerInterval);
    gameLoop = setInterval(update, 1000 / 60);
    startCountdown(() => {
      gameState = 'playing';
      player = new Player();
      keeper = new Goalkeeper();
      timerInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        timeLeft--;
        if (timeLeft <= 0) onGameFinished();
      }, 1000);
    });
  }

  // ── Main Loop ─────────────────────────────────
  function update() {
    if (gameState === 'playing') {
      if (player) player.update();
      if (keeper) keeper.trackBall();
      updateShot();
      updateParticles();
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    if (gameState === 'menu') {
      drawMenu();
    } else if (gameState === 'countdown' || gameState === 'playing' || gameState === 'finished') {
      drawPitch();
      drawSpectators();
      drawParticles();
      if (keeper) keeper.draw();
      if (player) player.draw();
      if (shot) drawBall(shot.x, shot.y, shot.r);
      drawHUD();
      if (gameState === 'countdown') drawCountdown();
      if (gameState === 'finished') drawFinished();
    }
  }

  startButton.onclick = startGame;
  btnRestart.onclick = startGame;

  setupTouchControls();
  waitForFont(() => {
    draw();
    setInterval(() => { if (gameState === 'menu') draw(); }, 50);
  });
}

document.addEventListener('DOMContentLoaded', initSoccerGame);
