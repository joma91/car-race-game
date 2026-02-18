function initCarRaceGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startButton = document.getElementById('startButton');

  // Adjust canvas size to fit viewport
  canvas.width = Math.min(700, window.innerWidth - 20);
  canvas.height = Math.min(400, window.innerHeight - 20);

  // Colors from CarOnSale branding
  const colors = {
    yellow: '#FFD452',
    darkGray: '#2F343E',
    lightGray: '#474B57',
    white: '#FFFFFF',
    lightBlue: '#BAC5E5',
    brickRed: '#8e402a',
    brickDark: '#302018'
  };

  // Game variables
  let gameLoop;
  let car;
  let track;
  let startTime;
  let currentTime;
  let finalTime;
  let gameState = 'menu';
  let gameStarted = false;

  // Car object
  class Car {
    constructor() {
      this.x = canvas.width / 2;
      this.y = canvas.height * 0.8;
      this.angle = 0;
      this.speed = 0;
      this.lap = 1;
      this.checkpoint = 0;
    }

    update() {
      if (!gameStarted && (keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight)) {
        gameStarted = true;
        startTime = Date.now();
      }

      if (keys.ArrowUp) this.speed += 0.2;
      if (keys.ArrowDown) this.speed -= 0.1;
      if (keys.ArrowLeft) this.angle -= 0.05;
      if (keys.ArrowRight) this.angle += 0.05;

      this.speed *= 0.98;

      let newX = this.x + Math.cos(this.angle) * this.speed;
      let newY = this.y + Math.sin(this.angle) * this.speed;

      if (this.isOnTrack(newX, newY)) {
        this.x = newX;
        this.y = newY;
      } else {
        this.speed = 0;
      }

      if (this.x > canvas.width * 0.45 && this.x < canvas.width * 0.55 && this.y > canvas.height * 0.75 && this.y < canvas.height * 0.85) {
        if (this.checkpoint === 1) {
          if (this.lap < 3) {
            this.lap++;
          } else if (this.lap === 3) {
            gameState = 'finished';
            finalTime = currentTime;
          }
        }
        this.checkpoint = 0;
      } else if (this.x > canvas.width * 0.85 && this.y > canvas.height * 0.35 && this.y < canvas.height * 0.5) {
        this.checkpoint = 1;
      }
    }

    isOnTrack(x, y) {
      const outerMargin = 0.08;
      const innerMargin = 0.15;
      return (x > canvas.width * outerMargin && x < canvas.width * (1 - outerMargin) &&
              y > canvas.height * outerMargin && y < canvas.height * (1 - outerMargin)) &&
             !(x > canvas.width * innerMargin && x < canvas.width * (1 - innerMargin) &&
               y > canvas.height * innerMargin && y < canvas.height * (1 - innerMargin));
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      
      ctx.fillStyle = colors.yellow;
      ctx.beginPath();
      ctx.moveTo(-15, -8);
      ctx.lineTo(15, -8);
      ctx.lineTo(15, 8);
      ctx.lineTo(-15, 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(-10, -7, 5, 14);
      ctx.fillRect(5, -7, 5, 14);
      ctx.fillRect(-5, -8, 10, 2);
      ctx.fillRect(-5, 6, 10, 2);

      ctx.fillRect(-12, -10, 4, 2);
      ctx.fillRect(-12, 8, 4, 2);
      ctx.fillRect(8, -10, 4, 2);
      ctx.fillRect(8, 8, 4, 2);

      ctx.restore();
    }
  }

  // Track object
  class Track {
    constructor() {
      const margin = 0.15;
      this.innerPoints = [
        [canvas.width * margin, canvas.height * margin],
        [canvas.width * (1 - margin), canvas.height * margin],
        [canvas.width * (1 - margin), canvas.height * (1 - margin)],
        [canvas.width * margin, canvas.height * (1 - margin)]
      ];
      const outerMargin = 0.08;
      this.outerPoints = [
        [canvas.width * outerMargin, canvas.height * outerMargin],
        [canvas.width * (1 - outerMargin), canvas.height * outerMargin],
        [canvas.width * (1 - outerMargin), canvas.height * (1 - outerMargin)],
        [canvas.width * outerMargin, canvas.height * (1 - outerMargin)]
      ];
    }

    draw() {
      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = colors.lightGray;
      ctx.beginPath();
      ctx.moveTo(this.outerPoints[0][0], this.outerPoints[0][1]);
      for (let point of this.outerPoints) {
        ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = colors.darkGray;
      ctx.beginPath();
      ctx.moveTo(this.innerPoints[0][0], this.innerPoints[0][1]);
      for (let point of this.innerPoints) {
        ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
      ctx.fill();

      this.drawBrickWall(this.outerPoints);
      this.drawBrickWall(this.innerPoints);

      ctx.strokeStyle = colors.white;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.11, canvas.height * 0.11);
      ctx.lineTo(canvas.width * 0.89, canvas.height * 0.11);
      ctx.lineTo(canvas.width * 0.89, canvas.height * 0.89);
      ctx.lineTo(canvas.width * 0.11, canvas.height * 0.89);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      const squareSize = canvas.width * 0.014;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? colors.white : colors.darkGray;
          ctx.fillRect(canvas.width * 0.5 + j * squareSize, canvas.height * 0.75 + i * squareSize, squareSize, squareSize);
        }
      }
    }

    drawBrickWall(points) {
      const brickHeight = canvas.height * 0.025;
      const brickWidth = canvas.width * 0.028;

      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        const bricksCount = Math.floor(distance / brickWidth);
        
        for (let j = 0; j < bricksCount; j++) {
          ctx.save();
          ctx.translate(x1 + dx * j / bricksCount, y1 + dy * j / bricksCount);
          ctx.rotate(angle);
          
          ctx.fillStyle = colors.brickRed;
          ctx.fillRect(0, -brickHeight / 2, brickWidth, brickHeight);
          
          ctx.strokeStyle = colors.brickDark;
          ctx.lineWidth = 1;
          ctx.strokeRect(0, -brickHeight / 2, brickWidth, brickHeight);
          
          ctx.restore();
        }
      }
    }
  }

  // Input handling
  const keys = {};
  document.addEventListener('keydown', (e) => keys[e.code] = true);
  document.addEventListener('keyup', (e) => keys[e.code] = false);

  function startGame() {
    console.log('Starting game...');
    gameState = 'playing';
    gameStarted = false;
    startButton.style.display = 'none';
    car = new Car();
    track = new Track();
    startTime = null;
    currentTime = 0;
    finalTime = 0;
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 1000 / 60);
  }

  function update() {
    if (gameState === 'playing') {
      car.update();
      if (gameStarted) {
        currentTime = (Date.now() - startTime) / 1000;
      }
    }
    draw();
  }

  function draw() {
    console.log('Drawing...');
    if (gameState === 'menu') {
      drawMenu();
    } else {
      track.draw();
      car.draw();

      ctx.fillStyle = colors.white;
      ctx.font = `${canvas.height * 0.05}px Arial`;
      ctx.fillText(`Lap: ${car.lap}/3`, canvas.width * 0.02, canvas.height * 0.17);
      ctx.fillText(`Time: ${gameStarted ? currentTime.toFixed(2) : '0.00'}s`, canvas.width * 0.02, canvas.height * 0.25);

      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.1);
      ctx.font = `bold ${canvas.height * 0.06}px Arial`;
      ctx.fillStyle = colors.white;
      ctx.textAlign = 'center';
      ctx.fillText('CAR ON SALE', canvas.width / 2, canvas.height * 0.07);
      ctx.textAlign = 'left';

      if (gameState === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.white;
        ctx.font = `${canvas.height * 0.1}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('Race Finished!', canvas.width / 2, canvas.height * 0.4);
        ctx.font = `${canvas.height * 0.075}px Arial`;
        ctx.fillText(`Total Time: ${finalTime.toFixed(2)}s`, canvas.width / 2, canvas.height * 0.55);
        ctx.textAlign = 'left';

        startButton.style.display = 'block';
        startButton.textContent = 'Play Again';
        // Adjust button position
        startButton.style.position = 'absolute';
        startButton.style.left = '50%';
        startButton.style.top = '75%';
        startButton.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  function drawMenu() {
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.white;
    ctx.font = `bold ${canvas.height * 0.1}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Car Race Game', canvas.width / 2, canvas.height * 0.4);

    ctx.font = `${canvas.height * 0.05}px Arial`;
    ctx.fillText('Click "Start Game" to begin', canvas.width / 2, canvas.height * 0.5);

    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.1);
    ctx.font = `bold ${canvas.height * 0.06}px Arial`;
    ctx.fillStyle = colors.white;
    ctx.textAlign = 'center';
    ctx.fillText('CAR ON SALE', canvas.width / 2, canvas.height * 0.07);
  }

  // Initial setup
  startButton.onclick = startGame;
  draw(); // Initial draw to show the menu
}

// Call the initialization function when the script loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded and parsed');
  initCarRaceGame();
});

// Add this line for debugging
console.log('Script loaded');
