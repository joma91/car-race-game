function initCarRaceGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const startButton = document.getElementById('startButton');

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
      this.x = 375;
      this.y = 320;
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

      if (this.x > 350 && this.x < 400 && this.y > 300 && this.y < 340) {
        if (this.checkpoint === 1) {
          if (this.lap < 3) {
            this.lap++;
          } else if (this.lap === 3) {
            gameState = 'finished';
            finalTime = currentTime;
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
      this.innerPoints = [
        [105, 105], [595, 105], [595, 295], [105, 295]
      ];
      this.outerPoints = [
        [55, 55], [645, 55], [645, 345], [55, 345]
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
      ctx.moveTo(80, 80);
      ctx.lineTo(620, 80);
      ctx.lineTo(620, 320);
      ctx.lineTo(80, 320);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      const squareSize = 10;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 5; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? colors.white : colors.darkGray;
          ctx.fillRect(350 + j * squareSize, 300 + i * squareSize, squareSize, squareSize);
        }
      }
    }

    drawBrickWall(points) {
      const brickHeight = 10;
      const brickWidth = 20;

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
    // Reset button styles
    startButton.style.position = '';
    startButton.style.left = '';
    startButton.style.bottom = '';
    startButton.style.transform = '';
    startButton.style.width = '';
    startButton.style.height = '';
    startButton.style.fontSize = '';
    startButton.style.padding = '';
    startButton.style.border = '';
    startButton.style.backgroundColor = '';
    startButton.style.color = '';
    startButton.style.cursor = '';
    
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
      ctx.font = '20px Arial';
      ctx.fillText(`Lap: ${car.lap}/3`, 10, 70);
      ctx.fillText(`Time: ${gameStarted ? currentTime.toFixed(2) : '0.00'}s`, 10, 100);

      ctx.fillStyle = colors.darkGray;
      ctx.fillRect(0, 0, canvas.width, 40);
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = colors.white;
      ctx.fillText('CAR ON SALE', 270, 28);

      if (gameState === 'finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = colors.white;
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Race Finished!', canvas.width / 2, 180);
        ctx.font = '30px Arial';
        ctx.fillText(`Total Time: ${finalTime.toFixed(2)}s`, canvas.width / 2, 230);
        ctx.textAlign = 'left';

        startButton.style.display = 'block';
        startButton.textContent = 'Play Again';
        startButton.style.position = 'absolute';
        startButton.style.left = '50%';
        startButton.style.bottom = '20px';
        startButton.style.transform = 'translateX(-50%)';
        startButton.style.width = '150px';
        startButton.style.height = '40px';
        startButton.style.fontSize = '18px';
        startButton.style.padding = '5px 10px';
        startButton.style.border = 'none';
        startButton.style.backgroundColor = colors.yellow;
        startButton.style.color = colors.darkGray;
        startButton.style.cursor = 'pointer';
      }
    }
  }

  function drawMenu() {
    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.white;
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Car Race Game', canvas.width / 2, 150);

    ctx.font = '20px Arial';
    ctx.fillText('Click "Start Game" to begin', canvas.width / 2, 200);

    ctx.fillStyle = colors.darkGray;
    ctx.fillRect(0, 0,
