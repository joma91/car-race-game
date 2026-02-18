let canvas, ctx, car, track, startTime, elapsedTime, lapCount, gameRunning, startButton, playAgainButton;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    startButton = document.getElementById('startButton');
    playAgainButton = document.getElementById('playAgainButton');

    startButton.onclick = startGame;
    playAgainButton.onclick = resetGame;

    // Draw the initial menu screen
    drawMenuScreen();

    console.log('Game initialized and ready to start');
});

function drawMenuScreen() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Welcome to Car Racing Game', canvas.width / 2, canvas.height / 2 - 30);
    ctx.font = '20px Arial';
    ctx.fillText('Click Start Game to begin', canvas.width / 2, canvas.height / 2 + 20);
}

function startGame() {
    console.log('Game starting...');
    startButton.style.display = 'none';
    playAgainButton.style.display = 'none';
    
    track = new Track();
    car = new Car();
    lapCount = 0;
    gameRunning = true;
    startTime = null;
    elapsedTime = 0;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    gameLoop();
    console.log('Game loop started');
}

function resetGame() {
    console.log('Resetting game...');
    startGame();
}

function gameLoop() {
    if (!gameRunning) return;

    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (startTime === null && (car.vx !== 0 || car.vy !== 0)) {
        startTime = performance.now();
    }

    if (startTime !== null) {
        elapsedTime = performance.now() - startTime;
    }

    car.update();
    checkCollision();
    checkLap();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    track.draw();
    car.draw();

    // Draw lap count and timer
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Lap: ${lapCount}/3`, 50, 30);
    ctx.fillText(`Time: ${(elapsedTime / 1000).toFixed(2)}s`, canvas.width - 100, 30);
}

function Car() {
    this.x = 400;
    this.y = 200;
    this.width = 20;
    this.height = 40;
    this.angle = 0;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.acceleration = 0.2;
    this.deceleration = 0.1;
    this.maxSpeed = 5;
    this.rotationSpeed = 0.1;

    this.update = function() {
        if (keys.ArrowUp) this.speed += this.acceleration;
        if (keys.ArrowDown) this.speed -= this.acceleration;
        if (!keys.ArrowUp && !keys.ArrowDown) {
            if (this.speed > 0) this.speed -= this.deceleration;
            if (this.speed < 0) this.speed += this.deceleration;
        }

        this.speed = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.speed));

        if (keys.ArrowLeft) this.angle -= this.rotationSpeed;
        if (keys.ArrowRight) this.angle += this.rotationSpeed;

        this.vx = Math.sin(this.angle) * this.speed;
        this.vy = -Math.cos(this.angle) * this.speed;

        this.x += this.vx;
        this.y += this.vy;
    }

    this.draw = function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = 'red';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();
    }
}

function Track() {
    this.innerRadius = 100;
    this.outerRadius = 200;
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;

    this.draw = function() {
        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.outerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.innerRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw start/finish line
        ctx.fillStyle = 'white';
        ctx.fillRect(this.centerX - 2, this.centerY - this.outerRadius, 4, this.outerRadius - this.innerRadius);

        // Draw checkered pattern
        const squareSize = 10;
        const startX = this.centerX - 2;
        const startY = this.centerY - this.outerRadius;
        const height = this.outerRadius - this.innerRadius;
        
        for (let i = 0; i < height / squareSize; i++) {
            if (i % 2 === 0) {
                ctx.fillStyle = 'black';
            } else {
                ctx.fillStyle = 'white';
            }
            ctx.fillRect(startX, startY + i * squareSize, 4, squareSize);
        }
    }
}

const keys = {};

function handleKeyDown(e) {
    keys[e.code] = true;
}

function handleKeyUp(e) {
    keys[e.code] = false;
}

function checkCollision() {
    const dx = car.x - track.centerX;
    const dy = car.y - track.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < track.innerRadius || distance > track.outerRadius) {
        car.x -= car.vx;
        car.y -= car.vy;
        car.speed = 0;
    }
}

function checkLap() {
    const dx = car.x - track.centerX;
    const dy = car.y - track.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance >= track.innerRadius && distance <= track.outerRadius) {
        if (car.x > track.centerX && car.x < track.centerX + 5 && car.y < track.centerY) {
            lapCount++;
            if (lapCount === 3) {
                endGame();
            }
        }
    }
}

function endGame() {
    gameRunning = false;
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Race Completed!`, canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillText(`Total Time: ${(elapsedTime / 1000).toFixed(2)}s`, canvas.width / 2, canvas.height / 2);

    showPlayAgainButton();
}

function showPlayAgainButton() {
    playAgainButton.style.display = 'block';
    playAgainButton.style.position = 'absolute';
    playAgainButton.style.left = '50%';
    playAgainButton.style.top = '60%'; // Geändert von 50% auf 60%
    playAgainButton.style.transform = 'translate(-50%, -50%)';
}
