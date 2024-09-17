const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const startGameButton = document.getElementById('startGame');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScore = document.getElementById('finalScore');
const highScoreForm = document.getElementById('highScoreForm');
const playerNameInput = document.getElementById('playerName');
const highScoreList = document.getElementById('highScoreList');
const highScoreDisplay = document.getElementById('highScoreDisplay'); 
const backgroundMusic = document.getElementById('backgroundMusic'); 
const gameOverSound = document.getElementById('gameOverSound');
const gameContainer = document.getElementById('game-container');
const eatingSound = document.getElementById('eatingSound');
const gameSpeedInput = document.getElementById('gameSpeed');
const gridSizeInput = document.getElementById('gridSize');
const muteMusicCheckbox = document.getElementById('muteMusic');

let snake;
let food;
let score;
let gameOver;
let gameRunning;

let gridSize = 20;
let gameSpeed = 100; 
let direction = 'right';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game objects
    snake = [{ x: 10, y: 10 }];
    food = generateFood();
    score = 0;
    gameOver = false;
    gameRunning = false;

    // Event listeners
    startGameButton.addEventListener('click', startGame);
    highScoreForm.addEventListener('submit', submitHighScore);
    document.addEventListener('keydown', handleKeyPress);
    gameContainer.addEventListener('touchstart', handleTouchStart, false);
    gameContainer.addEventListener('touchmove', handleTouchMove, false);
    displayHighScores();

    // Mute music checkbox event listener
    muteMusicCheckbox.addEventListener('change', () => {
        backgroundMusic.muted = muteMusicCheckbox.checked;
    });
});

gameSpeedInput.addEventListener('input', () => {
    updateGameSpeed();
});
gridSizeInput.addEventListener('input', () => {
    updateGridSize();
});

function startGame() {
    resetGame();
    gameRunning = true; 
    gameLoop();
    if (!muteMusicCheckbox.checked) { // Play music only if not muted
        backgroundMusic.play();
    }
    startGameButton.style.display = 'none'; 
}

function gameLoop() {
    if (!gameOver && gameRunning) {
        menu.style.display = 'none';
        gameOverScreen.style.display = 'none';
    }

    if (gameOver) {
        handleGameOver();
        return;
    }

    update();
    draw();

    setTimeout(() => {
        requestAnimationFrame(gameLoop);
    }, gameSpeed); 
}

function update() {
    const head = { x: snake[0].x, y: snake[0].y };

    moveSnake(head);
    checkCollision(head);

    if (head.x === food.x && head.y === food.y) {
        eatFood();
    } else {
        snake.pop();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSnake();
    drawFood();
    drawScore();
}

function moveSnake(head) {
    switch (direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }

    snake.unshift(head);
}

function checkCollision(head) {
    if (head.x < 0 || head.x >= canvas.width / gridSize || head.y < 0 || head.y >= canvas.height / gridSize || checkSelfCollision(head)) {
        gameOver = true;
    }
}

function checkSelfCollision(head) {
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function eatFood() {
    score++;
    eatingSound.currentTime = 0;
    eatingSound.play();
    food = generateFood();
}

function generateFood() {
    return {
        x: Math.floor(Math.random() * (canvas.width / gridSize)),
        y: Math.floor(Math.random() * (canvas.height / gridSize))
    };
}

function handleGameOver() {
    finalScore.textContent = score;
    gameOverScreen.style.display = 'block';
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    gameOverSound.play();
}

function resetGame() {
    gameOver = false;
    gameRunning = false;
    snake = [{ x: 10, y: 10 }];
    direction = 'right';
    score = 0;
    generateFood();
    menu.style.display = 'block';
    gameOverScreen.style.display = 'none';
    startGameButton.style.display = 'block'; 
    displayHighScores();
}

function submitHighScore(event) {
    event.preventDefault();

    let highScores = getHighScores();
    let insertIndex = highScores.findIndex(entry => score > entry.score);
    if (insertIndex === -1) {
        insertIndex = highScores.length;
    }
    highScores.splice(insertIndex, 0, { name: playerNameInput.value, score: score });

    highScores = highScores.slice(0, 3);

    localStorage.setItem('highScores', JSON.stringify(highScores));

    playerNameInput.value = '';
    displayHighScores();
    resetGame();
}

function getHighScores() {
    let highScores = localStorage.getItem('highScores');
    if (highScores) {
        return JSON.parse(highScores);
    } else {
        return [];
    }
}

function displayHighScores() {
    highScoreList.innerHTML = '';
    highScoreDisplay.innerHTML = '';

    let highScores = getHighScores();
    let top3Scores = highScores.slice(0, 3);

    top3Scores.forEach(entry => {
        let li = document.createElement('li');
        li.textContent = `${entry.name}: ${entry.score}`;
        highScoreList.appendChild(li);

        let p = document.createElement('p');
        p.textContent = `${entry.name}: ${entry.score}`;
        highScoreDisplay.appendChild(p);
    });
}

function handleKeyPress(event) {
    if (gameOver) {
        if (event.key === 'Enter' || event.key === ' ') {
            resetGame();
        }
    } else if (!gameRunning) {
        return;
    } else {
        switch (event.key) {
            case 'w': case 'ArrowUp': if (direction !== 'down') direction = 'up'; break;
            case 's': case 'ArrowDown': if (direction !== 'up') direction = 'down'; break;
            case 'a': case 'ArrowLeft': if (direction !== 'right') direction = 'left'; break;
            case 'd': case 'ArrowRight': if (direction !== 'left') direction = 'right'; break;
        }
    }
}

let touchStartX = null;
let touchStartY = null;
const touchThreshold = 30;

function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches ? event.touches[0] : event;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!touchStartX || !touchStartY) return;

    const touch = event.touches ? event.touches[0] : event;
    let touchEndX = touch.clientX;
    let touchEndY = touch.clientY;

    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > touchThreshold) {
        direction = diffX > 0 ? 'right' : 'left';
    } else if (Math.abs(diffY) > touchThreshold) {
        direction = diffY > 0 ? 'down' : 'up';
    }

    touchStartX = null;
    touchStartY = null;
}
function updateGameSpeed(){
    gameSpeed = (11 - gameSpeedInput.value) * 10; // Adjust the formula for desired speed range
}
function updateGridSize() {
gridSize = parseInt(gridSizeInput.value, 10);
canvas.width = gridSize * 20; // Adjust canvas width based on grid size
canvas.height = gridSize * 20; // Adjust canvas height based on grid size
}

function drawSnake() {
    ctx.fillStyle = 'green';
    snake.forEach(segment => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
    });
}

function drawFood() {
    ctx.fillStyle = 'red';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
}

function drawScore() {
    ctx.font = "16px 'Product Sans', sans-serif";
    ctx.fillStyle = 'white';
    ctx.fillText("Score: " + score, 10, 20);
}