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
    const submitScoreButton = document.getElementById('submitScoreButton');
    const scoreCounter = document.getElementById('scoreCounter');
    const eatingSound = new Audio('/EatingSound.mp3');
    const gameOverSound = new Audio('/GameOverSound.mp3');
    const gameMusic = new Audio('/SnakeGameMusic.mp3');
    const pauseButton = document.getElementById('pauseButton');
    const mainMenuButton = document.getElementById('mainMenuButton');
    const muteMusicButton = document.getElementById('muteMusicButton');
    const muteEffectsButton = document.getElementById('muteEffectsButton');
    const muteMusicGameOverButton = document.getElementById('muteMusicGameOverButton');
    const muteEffectsGameOverButton = document.getElementById('muteEffectsGameOverButton');
    const muteMusicPauseButton = document.getElementById('muteMusicPauseButton');
    const muteEffectsPauseButton = document.getElementById('muteEffectsPauseButton');

    let gridSize = 20, cellCount = 20;
    let snake = [{ x: 10, y: 10 }];
    let previousSnake = [{ x: 10, y: 10 }];
    let food = { x: 5, y: 5 };
    let direction = 'right';
    let score = 0, gameOver = false, gamePaused = false, scoreSubmitted = false;
    let directionQueue = [];
    const MAX_QUEUE = 2;
    let lastTickTime = 0;
    const TICK_RATE = 12;
    const TICK_INTERVAL = 1000 / TICK_RATE;

    let musicMuted = loadMuteState('musicMuted', false);
    let effectsMuted = loadMuteState('effectsMuted', false);
    updateMuteButtonStates();

    function initializeGame() {
        gameOver = false; gamePaused = false; scoreSubmitted = false;
        snake = [{ x: 10, y: 10 }];
        previousSnake = [{ x: 10, y: 10 }];
        direction = 'right'; directionQueue = []; score = 0;
        scoreCounter.textContent = score;
        generateFood();
        gameMusic.currentTime = 0;
        if (!musicMuted) gameMusic.play().catch(() => {});
        gameMusic.loop = true;
        lastTickTime = 0;
        pauseScreen.style.display = 'none';
        requestAnimationFrame(gameLoop);
    }

    function gameLoop(currentTime) {
        if (!lastTickTime) lastTickTime = currentTime;
        if (!gameOver && !gamePaused) {
            const delta = currentTime - lastTickTime;
            if (delta >= TICK_INTERVAL) {
                previousSnake = snake.map(s => ({ x: s.x, y: s.y }));
                update();
                lastTickTime = currentTime - (delta % TICK_INTERVAL);
            }
            const t = Math.min((currentTime - lastTickTime) / TICK_INTERVAL, 1);
            draw(t);
        }
        if (!gameOver) requestAnimationFrame(gameLoop);
    }

    function resizeCanvas() {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.82;
        canvas.width = size; canvas.height = size;
        gridSize = canvas.width / cellCount;
    }

    function generateFood() {
        food = { x: Math.floor(Math.random() * cellCount), y: Math.floor(Math.random() * cellCount) };
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === food.x && snake[i].y === food.y) { generateFood(); return; }
        }
    }

    function wrapDelta(d) {
        if (Math.abs(d) > 1) return d > 0 ? d - cellCount : d + cellCount;
        return d;
    }

    function interpolatePosition(prev, curr, t) {
        const dx = wrapDelta(curr.x - prev.x);
        const dy = wrapDelta(curr.y - prev.y);
        return { x: prev.x + dx * t, y: prev.y + dy * t };
    }

    function draw(t) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < snake.length; i++) {
            const curr = snake[i];
            const prev = previousSnake[i] || curr;
            const pos = interpolatePosition(prev, curr, t);
            ctx.fillStyle = i === 0 ? 'darkgreen' : 'limegreen';
            drawRoundedRect(pos.x * gridSize, pos.y * gridSize, gridSize, gridSize, gridSize / 4);
            if (i === 0) drawHeadDetails(pos);
        }
        drawApple();
    }

    function drawHeadDetails(part) {
        const eyeWidth = gridSize / 5, eyeHeight = gridSize / 8;
        const eyeOffsetX = gridSize / 4, eyeOffsetY = gridSize / 6;
        let eyeX, eyeY1, eyeY2;
        switch (direction) {
            case 'right':
                eyeX = part.x * gridSize + eyeOffsetX;
                eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;
                eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;
                break;
            case 'left':
                eyeX = (part.x + 1) * gridSize - eyeOffsetX;
                eyeY1 = part.y * gridSize + eyeOffsetY * 1.3;
                eyeY2 = (part.y + 1) * gridSize - eyeOffsetY * 1.3;
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
        ctx.fillStyle = 'white';
        if (direction === 'left' || direction === 'right') {
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeHeight / 2, eyeWidth / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY2, eyeHeight / 2, eyeWidth / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeHeight / 4, eyeWidth / 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY2, eyeHeight / 4, eyeWidth / 4, 0, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 2, eyeHeight / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath(); ctx.ellipse(eyeX, eyeY1, eyeWidth / 4, eyeHeight / 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(eyeX + eyeOffsetX * 2, eyeY1, eyeWidth / 4, eyeHeight / 4, 0, 0, Math.PI * 2); ctx.fill();
        }

        const tongueLength = gridSize * 0.3, tongueWidth = gridSize * 0.06;
        const forkLength = gridSize * 0.1, forkAngle = Math.PI / 8;
        ctx.strokeStyle = 'red'; ctx.lineWidth = tongueWidth; ctx.lineCap = 'round';
        let startX = (part.x + 0.5) * gridSize, startY = (part.y + 0.5) * gridSize;
        let endX = startX, endY = startY;
        switch (direction) {
            case 'right': startX = (part.x + 1) * gridSize; endX = startX + tongueLength; startY = endY = (part.y + 0.6) * gridSize; break;
            case 'left': startX = part.x * gridSize; endX = startX - tongueLength; startY = endY = (part.y + 0.6) * gridSize; break;
            case 'up': startY = part.y * gridSize; endY = startY - tongueLength; startX = endX = (part.x + 0.5) * gridSize; break;
            case 'down': startY = (part.y + 1) * gridSize; endY = startY + tongueLength; startX = endX = (part.x + 0.5) * gridSize; break;
        }
        ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
        const angle = Math.atan2(endY - startY, endX - startX);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + Math.cos(angle + forkAngle) * forkLength, endY + Math.sin(angle + forkAngle) * forkLength);
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + Math.cos(angle - forkAngle) * forkLength, endY + Math.sin(angle - forkAngle) * forkLength);
        ctx.stroke();
    }

    function drawApple() {
        const cx = (food.x + 0.5) * gridSize, cy = (food.y + 0.5) * gridSize;
        const r = gridSize / 2.5;
        ctx.fillStyle = 'red';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'brown'; ctx.lineWidth = gridSize / 15;
        ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy - r - gridSize / 8); ctx.stroke();
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.ellipse(cx + gridSize / 16, cy - r - gridSize / 16, gridSize / 8, gridSize / 16, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
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
            if (head.x === snake[i].x && head.y === snake[i].y) return true;
        }
        return false;
    }

    function update() {
        if (directionQueue.length > 0) {
            const newDirection = directionQueue.shift();
            if (isValidDirectionChange(newDirection)) direction = newDirection;
        }

        const head = { x: snake[0].x, y: snake[0].y };
        switch (direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        if (head.x < 0) head.x = cellCount - 1;
        else if (head.x >= cellCount) head.x = 0;
        else if (head.y < 0) head.y = cellCount - 1;
        else if (head.y >= cellCount) head.y = 0;

        if (checkCollision(head)) {
            triggerGameOver();
            return;
        }

        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreCounter.textContent = score;
            scoreCounter.classList.add('animateScore');
            if (!effectsMuted) {
                eatingSound.currentTime = 0;
                eatingSound.play().catch(() => {});
                vibrateController(100);
            }
            generateFood();
        } else {
            snake.pop();
        }
    }

    function triggerGameOver() {
        gameOver = true;
        if (!effectsMuted) {
            gameOverSound.play().catch(() => {});
            vibrateController([200, 100, 200]);
        }
        gameMusic.pause();
        finalScore.innerText = score;
        gameOverScreen.style.display = 'flex';
        highScoreInput.value = '';
        renderHighScores(gameOverHighScoreList, cachedTopScores);
        fetchHighScores();
    }

    function queueDirection(newDir) {
        if (directionQueue.length < MAX_QUEUE) directionQueue.push(newDir);
    }

    scoreCounter.addEventListener('animationend', () => {
        scoreCounter.classList.remove('animateScore');
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !gameOver) {
            togglePause();
            return;
        }
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': queueDirection('up'); break;
            case 'ArrowDown': case 's': case 'S': queueDirection('down'); break;
            case 'ArrowLeft': case 'a': case 'A': queueDirection('left'); break;
            case 'ArrowRight': case 'd': case 'D': queueDirection('right'); break;
        }
    });

    restartButton.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        submitCurrentScoreIfNeeded();
        initializeGame();
    });

    startButton.addEventListener('click', () => {
        startGameScreen.style.display = 'none';
        canvas.style.display = 'block';
        scoreCounter.style.display = 'block';
        resizeCanvas();
        initializeGame();
        window.addEventListener('resize', resizeCanvas);
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
            if (!musicMuted) gameMusic.play().catch(() => {});
            requestAnimationFrame(gameLoop);
        }
    }

    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchmove', handleTouchMove, false);
    let xDown = null, yDown = null;

    function handleTouchStart(evt) {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }

    function handleTouchMove(evt) {
        if (!xDown || !yDown) return;
        const xUp = evt.touches[0].clientX;
        const yUp = evt.touches[0].clientY;
        const xDiff = xDown - xUp;
        const yDiff = yDown - yUp;
        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (xDiff > 0) { if (direction !== 'right') queueDirection('left'); }
            else { if (direction !== 'left') queueDirection('right'); }
        } else {
            if (yDiff > 0) { if (direction !== 'down') queueDirection('up'); }
            else { if (direction !== 'up') queueDirection('down'); }
        }
        xDown = null; yDown = null;
    }

    // Gamepad support
    let previousGamepadState = {};
    window.addEventListener('gamepadconnected', (event) => {
        previousGamepadState[event.gamepad.index] = {
            buttons: event.gamepad.buttons.map(b => b.pressed)
        };
    });
    window.addEventListener('gamepaddisconnected', (event) => {
        delete previousGamepadState[event.gamepad.index];
    });

    function handleGamepad() {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad && gamepad.index in previousGamepadState) {
                if (gamepad.buttons[0].pressed && !previousGamepadState[gamepad.index].buttons[0]) {
                    if (gameOver) {
                        gameOverScreen.style.display = 'none';
                        submitCurrentScoreIfNeeded();
                        initializeGame();
                    } else if (startGameScreen.style.display !== 'none' && getComputedStyle(startGameScreen).display !== 'none') {
                        startGameScreen.style.display = 'none';
                        canvas.style.display = 'block';
                        scoreCounter.style.display = 'block';
                        resizeCanvas();
                        initializeGame();
                        window.addEventListener('resize', resizeCanvas);
                        pauseButton.style.display = 'block';
                    }
                }

                if (gamepad.buttons[9].pressed && !previousGamepadState[gamepad.index].buttons[9] && !gameOver) {
                    togglePause();
                }

                if (gamepad.buttons[12].pressed && direction !== 'down') queueDirection('up');
                if (gamepad.buttons[13].pressed && direction !== 'up') queueDirection('down');
                if (gamepad.buttons[14].pressed && direction !== 'right') queueDirection('left');
                if (gamepad.buttons[15].pressed && direction !== 'left') queueDirection('right');

                if (gamepad.axes[0] > 0.5 && direction !== 'left') queueDirection('right');
                if (gamepad.axes[0] < -0.5 && direction !== 'right') queueDirection('left');
                if (gamepad.axes[1] > 0.5 && direction !== 'up') queueDirection('down');
                if (gamepad.axes[1] < -0.5 && direction !== 'down') queueDirection('up');

                previousGamepadState[gamepad.index] = {
                    buttons: gamepad.buttons.map(b => b.pressed)
                };
            }
        }
    }
    setInterval(handleGamepad, 50);

    let cachedTopScores = loadCachedHighScores();
    renderHighScores(highScoreList, cachedTopScores);

    function loadCachedHighScores() {
        try {
            const stored = localStorage.getItem('highScores');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCachedHighScores(scores) {
        try {
            localStorage.setItem('highScores', JSON.stringify(scores));
        } catch (e) { /* ignore */ }
    }

    function renderHighScores(listElement, scores) {
        listElement.innerHTML = '';
        if (!scores || scores.length === 0) {
            const li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'No scores yet';
            listElement.appendChild(li);
            return;
        }
        scores.slice(0, 5).forEach(entry => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = entry.name;
            const scoreSpan = document.createElement('span');
            scoreSpan.textContent = entry.score;
            li.appendChild(nameSpan);
            li.appendChild(scoreSpan);
            listElement.appendChild(li);
        });
    }

    async function fetchHighScores() {
        try {
            const res = await fetch('/api/scores');
            if (!res.ok) throw new Error('Bad response');
            const data = await res.json();
            cachedTopScores = data.scores || [];
            saveCachedHighScores(cachedTopScores);
            renderHighScores(highScoreList, cachedTopScores);
            renderHighScores(gameOverHighScoreList, cachedTopScores);
        } catch (err) {
            // Fall back to whatever we have cached locally
            renderHighScores(highScoreList, cachedTopScores);
            renderHighScores(gameOverHighScoreList, cachedTopScores);
        }
    }

    async function submitScore(name, scoreValue) {
        try {
            const res = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score: scoreValue })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // Server rejected (e.g. blank name or profanity) - surface it and don't fall back locally,
                // so a rejected/invalid name never appears in the leaderboard.
                showScoreSubmitError(data.error || 'Could not submit score');
                scoreSubmitted = false;
                return;
            }
            cachedTopScores = data.scores || cachedTopScores;
            saveCachedHighScores(cachedTopScores);
        } catch (err) {
            // Network/offline fallback: keep a local top-5 as a backup
            cachedTopScores.push({ name, score: scoreValue });
            cachedTopScores.sort((a, b) => b.score - a.score);
            cachedTopScores = cachedTopScores.slice(0, 5);
            saveCachedHighScores(cachedTopScores);
        }
        renderHighScores(highScoreList, cachedTopScores);
        renderHighScores(gameOverHighScoreList, cachedTopScores);
    }

    function showScoreSubmitError(message) {
        highScoreInput.classList.add('input-error');
        highScoreInput.placeholder = message;
        submitScoreButton.disabled = false;
        submitScoreButton.textContent = 'Submit Score';
        setTimeout(() => {
            highScoreInput.classList.remove('input-error');
            highScoreInput.placeholder = 'Enter your name';
        }, 3000);
    }

    function submitCurrentScoreIfNeeded() {
        if (scoreSubmitted || score <= 0) return;
        const playerName = highScoreInput.value.trim().slice(0, 16);
        if (!playerName) {
            showScoreSubmitError('Please enter a name');
            return;
        }
        scoreSubmitted = true;
        submitScore(playerName, score);
    }

    submitScoreButton.addEventListener('click', () => {
        const playerName = highScoreInput.value.trim();
        if (!playerName) {
            showScoreSubmitError('Please enter a name');
            return;
        }
        submitCurrentScoreIfNeeded();
        submitScoreButton.disabled = true;
        submitScoreButton.textContent = 'Submitted';
    });

    fetchHighScores();

    function toggleMusicMute() {
        musicMuted = !musicMuted;
        saveMuteState('musicMuted', musicMuted);
        updateMuteButtonStates();
        if (musicMuted) gameMusic.pause();
        else gameMusic.play().catch(() => {});
    }

    function toggleEffectsMute() {
        effectsMuted = !effectsMuted;
        saveMuteState('effectsMuted', effectsMuted);
        updateMuteButtonStates();
    }

    function updateMuteButtonStates() {
        const musicText = musicMuted ? 'Unmute Music' : 'Mute Music';
        muteMusicButton.textContent = musicText;
        muteMusicGameOverButton.textContent = musicText;
        muteMusicPauseButton.textContent = musicText;
        muteMusicButton.classList.toggle('muted', musicMuted);
        muteMusicGameOverButton.classList.toggle('muted', musicMuted);
        muteMusicPauseButton.classList.toggle('muted', musicMuted);

        const effectsText = effectsMuted ? 'Unmute Effects' : 'Mute Effects';
        muteEffectsButton.textContent = effectsText;
        muteEffectsGameOverButton.textContent = effectsText;
        muteEffectsPauseButton.textContent = effectsText;
        muteEffectsButton.classList.toggle('muted', effectsMuted);
        muteEffectsGameOverButton.classList.toggle('muted', effectsMuted);
        muteEffectsPauseButton.classList.toggle('muted', effectsMuted);
    }

    muteMusicButton.addEventListener('click', toggleMusicMute);
    muteEffectsButton.addEventListener('click', toggleEffectsMute);
    muteMusicGameOverButton.addEventListener('click', toggleMusicMute);
    muteEffectsGameOverButton.addEventListener('click', toggleEffectsMute);
    muteMusicPauseButton.addEventListener('click', toggleMusicMute);
    muteEffectsPauseButton.addEventListener('click', toggleEffectsMute);

    function loadMuteState(key, defaultValue) {
        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
    }

    function saveMuteState(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function vibrateController(duration) {
        const gamepads = navigator.getGamepads();
        if (gamepads[0] && gamepads[0].hapticActuators && gamepads[0].hapticActuators.length > 0) {
            gamepads[0].hapticActuators[0].pulse(1.0, Array.isArray(duration) ? duration[0] : duration);
        }
    }

    mainMenuButton.addEventListener('click', () => {
        gameOverScreen.style.display = 'none';
        submitCurrentScoreIfNeeded();
        startGameScreen.style.display = 'flex';
        canvas.style.display = 'none';
        scoreCounter.style.display = 'none';
        pauseButton.style.display = 'none';
    });
});
