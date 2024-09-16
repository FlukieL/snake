const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const startGameButton = document.getElementById('startGame');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScore = document.getElementById('finalScore');
const highScoreForm = document.getElementById('highScoreForm');
const playerNameInput = document.getElementById('playerName');
const highScoreList = document.getElementById('highScoreList');
const highScoreDisplay = document.getElementById('highScoreDisplay'); // Get the high score display element
const backgroundMusic = document.getElementById('backgroundMusic'); // Get the background music element
const gameOverSound = document.getElementById('gameOverSound'); // Get the game over sound element

const gridSize = 20;
let snake = [{ x: 10, y: 10 }];
let food = {};
let direction = 'right';
let score = 0;
let gameOver = false;
let gameRunning = false; // Flag to track if the game is running

let touchStartX = null;
let touchStartY = null;

const touchThreshold = 30; // Minimum distance for a swipe to register

function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)),
        y: Math.floor(Math.random() * (canvas.height / gridSize))
    };
}

generateFood();

document.addEventListener('touchstart', (event) => {
    event.preventDefault(); // Prevent default touch behavior (scrolling)
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
});

document.addEventListener('touchmove', (event) => {
    event.preventDefault();
    if (!touchStartX || !touchStartY) return;

    let touchEndX = event.touches[0].clientX; // Use touches[0] for touchmove
    let touchEndY = event.touches[0].clientY;

    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > touchThreshold) {
        // Horizontal swipe
        direction = diffX > 0 ? 'right' : 'left';
    } else if (Math.abs(diffY) > touchThreshold) {
        // Vertical swipe
        direction = diffY > 0 ? 'down' : 'up';
    }

    // Reset touch start coordinates after processing the move
    touchStartX = null;
    touchStartY = null;
});

document.addEventListener('keydown', (event) => {
    if (gameOver) {
        // If game is over, Enter or Space restarts the game
        if (event.key === 'Enter' || event.key === ' ') {
            resetGame();
        }
    } else if (!gameRunning) {
        return; 
    } else {
        switch (event.key) {
            case 'ArrowUp': direction = (direction !== 'down') ? 'up' : direction; break;
            case 'ArrowDown': direction = (direction !== 'up') ? 'down' : direction; break;
            case 'ArrowLeft': direction = (direction !== 'right') ? 'left' : direction; break;
            case 'ArrowRight': direction = (direction !== 'left') ? 'right' : direction; break;
        }
    }
});

function gameLoop() {
    if (!gameOver && gameRunning) {
        menu.style.display = 'none';
        gameOverScreen.style.display = 'none';
    }

    if (gameOver) {
        finalScore.textContent = score;
        gameOverScreen.style.display = 'block';
        backgroundMusic.pause(); // Pause music on game over
        backgroundMusic.currentTime = 0; // Reset music to the beginning
        gameOverSound.play(); // Play game over sound
        return;
    }

    // Set canvas background to white
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const head = { x: snake[0].x, y: snake[0].y };

    switch (direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }

    // Collision detection with boundaries and itself
    if (head.x < 0 || head.x >= canvas.width / gridSize || head.y < 0 || head.y >= canvas.height / gridSize || checkCollision(head)) {
        gameOver = true;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score++;
        generateFood();
    } else {
        snake.pop();
    }

    // Drawing the snake
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#a5d6a7' : 'green'; // Head is light green, body is green
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);

        // Draw eyes and tongue only for the head
        if (index === 0) {
            // Eyes - Adjust position based on direction
            ctx.fillStyle = 'black';
            ctx.beginPath();
            if (direction === 'up') {
                ctx.arc((segment.x + 0.25) * gridSize, (segment.y + 0.75) * gridSize, gridSize / 8, 0, 2 * Math.PI); // Left eye
                ctx.arc((segment.x + 0.75) * gridSize, (segment.y + 0.75) * gridSize, gridSize / 8, 0, 2 * Math.PI); // Right eye
            } else if (direction === 'down') {
                ctx.arc((segment.x + 0.25) * gridSize, (segment.y + 0.25) * gridSize, gridSize / 8, 0, 2 * Math.PI);
                ctx.arc((segment.x + 0.75) * gridSize, (segment.y + 0.25) * gridSize, gridSize / 8, 0, 2 * Math.PI);
            } else if (direction === 'left') {
                ctx.arc((segment.x + 0.75) * gridSize, (segment.y + 0.25) * gridSize, gridSize / 8, 0, 2 * Math.PI);
                ctx.arc((segment.x + 0.75) * gridSize, (segment.y + 0.75) * gridSize, gridSize / 8, 0, 2 * Math.PI);
            } else if (direction === 'right') {
                ctx.arc((segment.x + 0.25) * gridSize, (segment.y + 0.25) * gridSize, gridSize / 8, 0, 2 * Math.PI);
                ctx.arc((segment.x + 0.25) * gridSize, (segment.y + 0.75) * gridSize, gridSize / 8, 0, 2 * Math.PI);
            }
            ctx.fill();

            // Tongue - Adjust position and size based on direction
            ctx.fillStyle = 'red';
            if (direction === 'up') {
                ctx.fillRect((segment.x + 0.5) * gridSize - gridSize / 10, (segment.y) * gridSize, gridSize / 5, gridSize / 4);
            } else if (direction === 'down') {
                ctx.fillRect((segment.x + 0.5) * gridSize - gridSize / 10, (segment.y + 0.8) * gridSize, gridSize / 5, gridSize / 4);
            } else if (direction === 'left') {
                ctx.fillRect((segment.x) * gridSize, (segment.y + 0.5) * gridSize - gridSize / 10, gridSize / 4, gridSize / 5);
            } else if (direction === 'right') {
                ctx.fillRect((segment.x + 0.8) * gridSize, (segment.y + 0.5) * gridSize - gridSize / 10, gridSize / 4, gridSize / 5);
            }
        }
    });

    ctx.fillStyle = 'red';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);

    setTimeout(() => {
        requestAnimationFrame(gameLoop);
    }, 100); // Adjust the delay (in milliseconds) here to control the game speed.
}

function checkCollision(head) {
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function resetGame() {
    gameOver = false;
    gameRunning = false; // Stop the game loop
    snake = [{ x: 10, y: 10 }];
    direction = 'right';
    score = 0;
    generateFood();
    menu.style.display = 'block'; // Show the menu
    gameOverScreen.style.display = 'none'; // Hide the game over screen
    displayHighScores(); // Update high score display on the main menu
}

// Function to get high scores from local storage
function getHighScores() {
    let highScores = localStorage.getItem('highScores');
    if (highScores) {
        return JSON.parse(highScores);
    } else {
        return [];
    }
}

// Function to display high scores on the page
function displayHighScores() {
    highScoreList.innerHTML = ""; // Clear the game over screen list
    highScoreDisplay.innerHTML = ""; // Clear the main menu display

    let highScores = getHighScores();
    let top3Scores = highScores.slice(0, 3); // Get the top 3 scores

    top3Scores.forEach(entry => {
        // Add to game over screen list
        let li = document.createElement('li');
        li.textContent = `${entry.name}: ${entry.score}`;
        highScoreList.appendChild(li);

        // Add to main menu display
        let p = document.createElement('p');
        p.textContent = `${entry.name}: ${entry.score}`;
        highScoreDisplay.appendChild(p);
    });
}

// Event listener for starting the game
startGameButton.addEventListener('click', () => {
    gameRunning = true; // Start the game loop
    gameLoop();
    backgroundMusic.play(); // Start music when the game starts
});

// Event listener for submitting a high score
highScoreForm.addEventListener('submit', (event) => {
    event.preventDefault(); // Prevent form submission from reloading the page

    let playerName = playerNameInput.value;
    let highScores = getHighScores();

    // Find the correct index to insert the new score to keep the list sorted
    let insertIndex = highScores.findIndex(entry => score > entry.score);
    if (insertIndex === -1) {
        insertIndex = highScores.length; // Insert at the end if the new score is the lowest
    }
    highScores.splice(insertIndex, 0, { name: playerName, score: score });

    // Keep only the top 3 scores
    highScores = highScores.slice(0, 3);

    localStorage.setItem('highScores', JSON.stringify(highScores));

    playerNameInput.value = ""; // Clear the input field
    displayHighScores();
    resetGame(); // Go back to the main menu
});

// Display high scores on page load
displayHighScores();