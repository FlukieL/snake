document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const startGameScreen = document.getElementById('startGameScreen');
    const pauseScreen = document.getElementById('pauseScreen');
    const finalScore = document.getElementById('finalScore');
    const restartButton = document.getElementById('restartButton');
    const startButton = document.getElementById('startButton');
    const highScoreList = document.getElementById('highScoreList');
    const gameOverHighScoreList = document.getElementById('gameOverHighScoreList');
    const highScoreInput = document.getElementById('highScoreInput');
    const scoreCounter = document.getElementById('scoreCounter'); // Score counter element
    const eatingSound = new Audio('EatingSound.mp3');
    const gameOverSound = new Audio('GameOverSound.mp3');
    const gameMusic = new Audio('SnakeGameMusic.mp3');
    const pauseButton = document.getElementById('pauseButton');
    
    // Mute buttons
    const muteMusicButton = document.getElementById('muteMusicButton');
    const muteEffectsButton = document.getElementById('muteEffectsButton');
    const muteMusicGameOverButton = document.getElementById('muteMusicGameOverButton');
    const muteEffectsGameOverButton = document.getElementById('muteEffectsGameOverButton');
    const muteMusicPauseButton = document.getElementById('muteMusicPauseButton');
    const muteEffectsPauseButton = document.getElementById('muteEffectsPauseButton');
    
    
    let gridSize = 20;
    let snake = [{ x: 10, y: 10 }];
    let food = {};
    let direction = 'right';
    let score = 0;
    let gameOver = false;
    let gamePaused = false;
    let gameLoopInterval;
    let directionQueue = []; // Queue to store direction changes
    let lastFrameTime = 0; // Time of the last frame
    const frameRate = 10; // Target frame rate (frames per second)
    
    let highScores = loadHighScores();
    let musicMuted = loadMuteState('musicMuted', false); // Load music mute state
    let effectsMuted = loadMuteState('effectsMuted', false); // Load effects mute state
    
    // Update button states on load
    updateMuteButtonStates();
    
    function initializeGame() {
        gameOver = false;
        gamePaused = false;
        snake = [{ x: 10, y: 10 }];
        direction = 'right';
        directionQueue = []; // Reset direction queue
        score = 0;
        scoreCounter.textContent = score; // Reset score counter
        generateFood();
        gameMusic.currentTime = 0;
        if (!musicMuted) {
            gameMusic.play();
        }
        gameMusic.loop = true;
        clearInterval(gameLoopInterval); // Clear any existing interval
        lastFrameTime = 0; // Reset last frame time
        requestAnimationFrame(gameLoop); // Start the game loop
        pauseScreen.style.display = 'none'; // Hide pause screen
    }
    
    function gameLoop(currentTime) {
        if (!gameOver && !gamePaused) { // Only update if not game over or paused
            // Calculate time difference since last frame
            const deltaTime = currentTime - lastFrameTime;
    
            // Update game state at the target frame rate
            if (deltaTime >= 1000 / frameRate) {
                update();
                lastFrameTime = currentTime - (deltaTime % (1000 / frameRate)); // Adjust for smoother animation
            }
        }
    
        requestAnimationFrame(gameLoop); // Request the next frame
    }
    
    function resizeCanvas() {
        canvas.width = Math.min(window.innerWidth, window.innerHeight) * 0.8; // 80% of smaller dimension
        canvas.height = canvas.width;
        gridSize = canvas.width / 20; // Adjust grid size based on canvas size
    }
    
    function generateFood() {
        food = {
            x: Math.floor(Math.random() * (canvas.width / gridSize)),
            y: Math.floor(Math.random() * (canvas.height / gridSize))
        };
    
        // Check if food spawns on snake
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === food.x && snake[i].y === food.y) {
                generateFood(); // Regenerate if overlapping
                return; // Exit function after regeneration
            }
        }
    }
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw snake
        for (let i = 0; i < snake.length; i++) {
            const part = snake[i];
            ctx.fillStyle = i === 0 ? 'darkgreen' : 'limegreen';
            
            // Draw rounded rectangle for each snake part
            drawRoundedRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize, gridSize / 4);
            
            // Draw eyes and tongue for the head
            if (i === 0) {
                const eyeWidth = gridSize / 5;
                const eyeHeight = gridSize / 8;
                const eyeOffsetX = gridSize / 4;
                const eyeOffsetY = gridSize / 6;

                let eyeX, eyeY1, eyeY2;

                switch (direction) {
                    case 'right':
                        eyeX = part.x * gridSize + eyeOffsetX;
                        eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;  // Slightly reduced distance
                        eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;  // Slightly reduced distance
                        break;
                    case 'left':
                        eyeX = (part.x + 1) * gridSize - eyeOffsetX;
                        eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;  // Slightly reduced distance
                        eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;  // Slightly reduced distance
                        break;
                    case 'up':
                        eyeX = (part.x + 0.5) * gridSize - eyeOffsetX;
                        eyeY1 = eyeY2 = (part.y + 1) * gridSize - eyeOffsetY;
                        break;
                    case 'down':
                        eyeX = (part.x + 0.5) * gridSize - eyeOffsetX;
                        eyeY1 = eyeY2 = part.y * gridSize + eyeOffsetY;
                        break;
                }

                // Draw eyes
                ctx.fillStyle = 'white';
                if (direction === 'left' || direction === 'right') {
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY1, eyeHeight / 2, eyeWidth / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY2, eyeHeight / 2, eyeWidth / 2, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY1, eyeHeight / 4, eyeWidth / 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY2, eyeHeight / 4, eyeWidth / 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY1, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    ctx.ellipse(eyeX, eyeY1, eyeWidth / 4, eyeHeight / 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 4, eyeHeight / 4, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Draw tongue
                const tongueLength = gridSize * 0.3;
                const tongueWidth = gridSize * 0.06;
                const forkLength = gridSize * 0.1;
                const forkAngle = Math.PI / 8;

                ctx.strokeStyle = 'red';
                ctx.lineWidth = tongueWidth;
                ctx.lineCap = 'round';

                let startX = (part.x + 0.5) * gridSize;
                let startY = (part.y + 0.5) * gridSize;
                let endX = startX;
                let endY = startY;

                switch (direction) {
                    case 'right': 
                        startX = (part.x + 1) * gridSize;
                        endX = startX + tongueLength;
                        startY = endY = (part.y + 0.6) * gridSize;
                        break;
                    case 'left': 
                        startX = part.x * gridSize;
                        endX = startX - tongueLength;
                        startY = endY = (part.y + 0.6) * gridSize;
                        break;
                    case 'up': 
                        startY = part.y * gridSize;
                        endY = startY - tongueLength;
                        startX = endX = (part.x + 0.5) * gridSize;
                        break;
                    case 'down': 
                        startY = (part.y + 1) * gridSize;
                        endY = startY + tongueLength;
                        startX = endX = (part.x + 0.5) * gridSize;
                        break;
                }

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                let angle = Math.atan2(endY - startY, endX - startX);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX + Math.cos(angle + forkAngle) * forkLength, endY + Math.sin(angle + forkAngle) * forkLength);
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX + Math.cos(angle - forkAngle) * forkLength, endY + Math.sin(angle - forkAngle) * forkLength);
                ctx.stroke();
            }
        }
        
        // Draw food
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc((food.x + 0.5) * gridSize, (food.y + 0.5) * gridSize, gridSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function update() {
        // Get the next direction from the queue, if available
        if (directionQueue.length > 0) {
            const newDirection = directionQueue.shift();
            if (isValidDirectionChange(newDirection)) {
                direction = newDirection;
            }
        }
    
        const head = { x: snake[0].x, y: snake[0].y };
        switch (direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }
        // Looping
        if (head.x < 0) {
            head.x = Math.floor(canvas.width / gridSize) - 1;
        } else if (head.x >= canvas.width / gridSize) {
            head.x = 0;
        } else if (head.y < 0) {
            head.y = Math.floor(canvas.height / gridSize) - 1;
        } else if (head.y >= canvas.height / gridSize) {
            head.y = 0;
        }
        if (checkCollision(head)) {
            gameOver = true;
            if (!effectsMuted) {
                gameOverSound.play();
                vibrateController([200, 100, 200]); // Vibrate on game over
            }
            gameMusic.pause();
            finalScore.innerText = score;
            gameOverScreen.style.display = 'flex';
            highScoreInput.value = ''; // Clear the input field
            return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreCounter.textContent = score; // Update score counter
            scoreCounter.classList.add('animateScore'); // Add animation class
            if (!effectsMuted) {
                eatingSound.play();
                vibrateController(100); // Vibrate on eating
            }
            generateFood();
        } else {
            snake.pop();
        }
        draw();
    
        // Remove animation class after animation ends
    }
    
    // Function to check if the new direction is valid (opposite direction is not allowed)
    function isValidDirectionChange(newDirection) {
        return !(
            (direction === 'up' && newDirection === 'down') ||
            (direction === 'down' && newDirection === 'up') ||
            (direction === 'left' && newDirection === 'right') ||
            (direction === 'right' && newDirection === 'left')
        );
    }
    
    function checkCollision(head) {
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        return false;
    }
    
    // Event Listeners
    scoreCounter.addEventListener('animationend', () => {
        scoreCounter.classList.remove('animateScore');
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !gameOver) {
            togglePause();
        } else {
            switch (e.key) {
                case 'ArrowUp': case 'w': directionQueue.push('up'); break;
                case 'ArrowDown': case 's': directionQueue.push('down'); break;
                case 'ArrowLeft': case 'a': directionQueue.push('left'); break;
                case 'ArrowRight': case 'd': directionQueue.push('right'); break;
            }
        }
    });
    
    restartButton.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        updateHighScores(score);
        initializeGame();
    });
    
    startButton.addEventListener('click', () => {
        startGameScreen.style.display = 'none';
        canvas.style.display = 'block';
        scoreCounter.style.display = 'block'; // Show score counter
        initializeGame();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        // Show pause button on all devices
        pauseButton.style.display = 'block';
    });
    
    pauseButton.addEventListener('click', togglePause);
    
    function togglePause() {
        gamePaused = !gamePaused;
        pauseButton.textContent = gamePaused ? 'Resume' : 'Pause';
        pauseScreen.style.display = gamePaused ? 'flex' : 'none';
        if (gamePaused) {
            gameMusic.pause();
        } else {
            if (!musicMuted) {
                gameMusic.play();
            }
        }
    }
    
    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, false);
    let xDown = null;
    let yDown = null;
    
    function handleTouchStart(evt) {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }
    
    function handleTouchMove(evt) {
        if (!xDown || !yDown) {
            return;
        }
        const xUp = evt.touches[0].clientX;
        const yUp = evt.touches[0].clientY;
        const xDiff = xDown - xUp;
        const yDiff = yDown - yUp;
        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (xDiff > 0) {
                if (direction !== 'right') directionQueue.push('left');
            } else {
                if (direction !== 'left') directionQueue.push('right');
            }
        } else {
            if (yDiff > 0) {
                if (direction !== 'down') directionQueue.push('up');
            } else {
                if (direction !== 'up') directionQueue.push('down');
            }
        }
        xDown = null;
        yDown = null;
    }
    
    
    // Game Controller
    let previousGamepadState = {};
    window.addEventListener('gamepadconnected', (event) => {
        console.log('A gamepad connected:', event.gamepad);
        previousGamepadState[event.gamepad.index] = {
            buttons: event.gamepad.buttons.map(button => button.pressed),
        };
    });
    
    window.addEventListener('gamepaddisconnected', (event) => {
        console.log('A gamepad disconnected:', event.gamepad);
        delete previousGamepadState[event.gamepad.index];
    });
    
    function handleGamepad() {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.index in previousGamepadState) {
                // A Button (Start / Restart)
                if (gamepad.buttons[0].pressed && !previousGamepadState[gamepad.index].buttons[0]) {
                    if (gameOver) {
                        gameOverScreen.style.display = 'none';
                        updateHighScores(score);
                        initializeGame();
                    } else if (startGameScreen.style.display === 'block') {
                        startGameScreen.style.display = 'none';
                        canvas.style.display = 'block';
                        scoreCounter.style.display = 'block';
                        initializeGame();
                        resizeCanvas();
                        window.addEventListener('resize', resizeCanvas);
                    }
                }
    
                // Start Button (Pause)
                if (gamepad.buttons[9].pressed && !previousGamepadState[gamepad.index].buttons[9] && !gameOver) {
                    togglePause();
                }
    
                // D-Pad
                if (gamepad.buttons[12].pressed && direction !== 'down') directionQueue.push('up');
                if (gamepad.buttons[13].pressed && direction !== 'up') directionQueue.push('down');
                if (gamepad.buttons[14].pressed && direction !== 'right') directionQueue.push('left');
                if (gamepad.buttons[15].pressed && direction !== 'left') directionQueue.push('right');
    
                // Analog Stick
                if (gamepad.axes[0] > 0.5 && direction !== 'left') directionQueue.push('right');
                if (gamepad.axes[0] < -0.5 && direction !== 'right') directionQueue.push('left');
                if (gamepad.axes[1] > 0.5 && direction !== 'up') directionQueue.push('down');
                if (gamepad.axes[1] < -0.5 && direction !== 'down') directionQueue.push('up');
    
                // Update previous gamepad state for next frame
                previousGamepadState[gamepad.index] = {
                    buttons: gamepad.buttons.map(button => button.pressed),
                };
            }
        }
    }
    
    setInterval(handleGamepad, 50); // Check gamepad input every 50ms
    
    function loadHighScores() {
        let storedHighScores = localStorage.getItem('highScores');
        return storedHighScores ? JSON.parse(storedHighScores) : [];
    }
    
    function saveHighScores() {
        localStorage.setItem('highScores', JSON.stringify(highScores));
    }
    
    function displayHighScores() {
        highScoreList.innerHTML = '';
        gameOverHighScoreList.innerHTML = '';
        const topThreeScores = highScores.slice(0, 3);
        topThreeScores.map(scoreData => {
            const listItem = document.createElement('li');
            listItem.textContent = `${scoreData.name}: ${scoreData.score}`;
            highScoreList.appendChild(listItem);
            const gameoverListItem = listItem.cloneNode(true);
            gameOverHighScoreList.appendChild(gameoverListItem);
        })
    }
    
    function updateHighScores(newScore) {
        let playerName = highScoreInput.value.trim();
        playerName = playerName ? playerName : 'Unknown Player';
        highScores.push({ name: playerName, score: newScore });
        highScores.sort((a, b) => b.score - a.score);
        highScores = highScores.slice(0, 3);
        saveHighScores();
        displayHighScores();
    }
    
    
    displayHighScores();
    
    // Mute/Unmute Functions
    function toggleMusicMute() {
        musicMuted = !musicMuted;
        saveMuteState('musicMuted', musicMuted); // Save music mute state
        updateMuteButtonStates(); // Update button states
        if (musicMuted) {
            gameMusic.pause();
        } else {
            gameMusic.play();
        }
    }
    
    function toggleEffectsMute() {
        effectsMuted = !effectsMuted;
        saveMuteState('effectsMuted', effectsMuted); // Save effects mute state
        updateMuteButtonStates(); // Update button states
    }
    
    // Function to update the text and styling of mute buttons
    function updateMuteButtonStates() {
        // Music buttons
        const musicButtonText = musicMuted ? 'Unmute Music' : 'Mute Music';
        muteMusicButton.textContent = musicButtonText;
        muteMusicGameOverButton.textContent = musicButtonText;
        muteMusicPauseButton.textContent = musicButtonText;
        // Add or remove 'muted' class based on musicMuted state
        muteMusicButton.classList.toggle('muted', musicMuted);
        muteMusicGameOverButton.classList.toggle('muted', musicMuted);
        muteMusicPauseButton.classList.toggle('muted', musicMuted);
    
        // Effects buttons
        const effectsButtonText = effectsMuted ? 'Unmute Effects' : 'Mute Effects';
        muteEffectsButton.textContent = effectsButtonText;
        muteEffectsGameOverButton.textContent = effectsButtonText;
        muteEffectsPauseButton.textContent = effectsButtonText;
        // Add or remove 'muted' class based on effectsMuted state
        muteEffectsButton.classList.toggle('muted', effectsMuted);
        muteEffectsGameOverButton.classList.toggle('muted', effectsMuted);
        muteEffectsPauseButton.classList.toggle('muted', effectsMuted);
    }
    
    // Add event listeners to mute buttons
    muteMusicButton.addEventListener('click', toggleMusicMute);
    muteEffectsButton.addEventListener('click', toggleEffectsMute);
    muteMusicGameOverButton.addEventListener('click', toggleMusicMute);
    muteEffectsGameOverButton.addEventListener('click', toggleEffectsMute);
    muteMusicPauseButton.addEventListener('click', toggleMusicMute);
    muteEffectsPauseButton.addEventListener('click', toggleEffectsMute);
    
    // Local Storage Functions
    function loadMuteState(key, defaultValue) {
        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
    }
    
    function saveMuteState(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
    
    // Vibration function for controller
    function vibrateController(duration) {
        const gamepads = navigator.getGamepads();
        if (gamepads[0] && gamepads[0].hapticActuators && gamepads[0].hapticActuators.length > 0) {
            gamepads[0].hapticActuators[0].pulse(1.0, duration);
        }
    }
    
    function drawRoundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        ctx.fill();
    }

    function drawRotatedEllipse(x, y, width, height, rotation) {
        ctx.beginPath();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(width / 2, height / 2);
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.restore();
        ctx.fill();
    }
});