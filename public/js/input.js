// Input handling: keyboard, touch swipe, and gamepad (with haptics),
// all funneling into the shared `queueDirection` / pause / restart actions.

import { dom } from './dom.js';
import { state } from './state.js';
import { queueDirection, togglePause, initializeGame, startGameSession } from './game.js';
import { submitCurrentScoreIfNeeded } from './auth.js';

// Returns the pause screen's buttons in visual top-to-bottom order, so
// arrow-key/gamepad navigation can cycle through them predictably.
function getPauseMenuButtons() {
    if (!dom.pauseScreen) return [];
    return Array.from(dom.pauseScreen.querySelectorAll('button'));
}

// Moves keyboard/gamepad focus to the next/previous button in the pause
// menu (wrapping around at either end), so the whole menu is navigable
// without a mouse/touch - matches the request for the pause menu to be
// usable via keyboard and controller, not just tap/click.
function movePauseMenuFocus(delta) {
    const buttons = getPauseMenuButtons();
    if (!buttons.length) return;
    const currentIndex = buttons.indexOf(document.activeElement);
    const nextIndex = currentIndex === -1
        ? 0
        : (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
}

function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !state.gameOver) {
            togglePause();
            return;
        }

        // While paused, arrow keys/WASD navigate the pause menu's buttons
        // instead of queuing a snake movement (which would have no visible
        // effect anyway since the game loop is stopped, but previously still
        // silently queued a direction that would apply the instant the game
        // resumed - a confusing surprise "instant turn" on resume).
        if (state.gamePaused) {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': e.preventDefault(); movePauseMenuFocus(-1); break;
                case 'ArrowDown': case 's': case 'S': e.preventDefault(); movePauseMenuFocus(1); break;
                case 'Enter': case ' ':
                    if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
                        e.preventDefault();
                        document.activeElement.click();
                    }
                    break;
            }
            return;
        }

        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': queueDirection('up'); break;
            case 'ArrowDown': case 's': case 'S': queueDirection('down'); break;
            case 'ArrowLeft': case 'a': case 'A': queueDirection('left'); break;
            case 'ArrowRight': case 'd': case 'D': queueDirection('right'); break;
        }
    });
}

function initTouch() {
    let xDown = null, yDown = null;

    document.addEventListener('touchstart', evt => {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', evt => {
        if (!xDown || !yDown) return;
        // Prevent iOS Safari's default scroll/rubber-band/bounce behavior
        // from fighting with swipe gestures during ACTIVE gameplay only -
        // without this, the browser tries to scroll the page on every swipe,
        // which is a major contributor to the sluggish/janky feel reported
        // specifically on iOS (Android/desktop don't have this same default
        // gesture conflict). Must use a non-passive listener for
        // preventDefault() to have any effect.
        // Deliberately checks !gameOver/!gamePaused too (not just inGame) -
        // state.inGame stays true all the way through the Game Over screen
        // (it's only reset when returning to the main menu), so gating on
        // inGame alone was also blocking scrolling on the Game Over
        // screen's scoreboard/sign-in content on iOS.
        if (state.inGame && !state.gameOver && !state.gamePaused) evt.preventDefault();
        const xUp = evt.touches[0].clientX;
        const yUp = evt.touches[0].clientY;
        const xDiff = xDown - xUp;
        const yDiff = yDown - yUp;
        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (xDiff > 0) { if (state.direction !== 'right') queueDirection('left'); }
            else { if (state.direction !== 'left') queueDirection('right'); }
        } else {
            if (yDiff > 0) { if (state.direction !== 'down') queueDirection('up'); }
            else { if (state.direction !== 'up') queueDirection('down'); }
        }
        xDown = null; yDown = null;
    }, { passive: false });
}

function initGamepad() {
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
                    if (state.gameOver) {
                        dom.gameOverScreen.style.display = 'none';
                        submitCurrentScoreIfNeeded();
                        initializeGame();
                    } else if (getComputedStyle(dom.startGameScreen).display !== 'none') {
                        startGameSession();
                    }
                }

                if (gamepad.buttons[9].pressed && !previousGamepadState[gamepad.index].buttons[9] && !state.gameOver) {
                    togglePause();
                }

                if (state.gamePaused) {
                    // While paused: D-pad/left-stick up/down navigate the pause
                    // menu's buttons, and A (button 0) activates whichever one
                    // is currently focused - mirrors the keyboard behavior so
                    // the pause menu is fully controller-navigable too.
                    const upPressed = gamepad.buttons[12].pressed || gamepad.axes[1] < -0.5;
                    const downPressed = gamepad.buttons[13].pressed || gamepad.axes[1] > 0.5;
                    const prevUp = previousGamepadState[gamepad.index].buttons[12] || previousGamepadState[gamepad.index].axisUp;
                    const prevDown = previousGamepadState[gamepad.index].buttons[13] || previousGamepadState[gamepad.index].axisDown;
                    if (upPressed && !prevUp) movePauseMenuFocus(-1);
                    if (downPressed && !prevDown) movePauseMenuFocus(1);
                    if (gamepad.buttons[0].pressed && !previousGamepadState[gamepad.index].buttons[0]) {
                        if (document.activeElement && document.activeElement.tagName === 'BUTTON' && dom.pauseScreen.contains(document.activeElement)) {
                            document.activeElement.click();
                        }
                    }
                    previousGamepadState[gamepad.index] = {
                        buttons: gamepad.buttons.map(b => b.pressed),
                        axisUp: gamepad.axes[1] < -0.5,
                        axisDown: gamepad.axes[1] > 0.5
                    };
                    continue;
                }

                if (gamepad.buttons[12].pressed && state.direction !== 'down') queueDirection('up');
                if (gamepad.buttons[13].pressed && state.direction !== 'up') queueDirection('down');
                if (gamepad.buttons[14].pressed && state.direction !== 'right') queueDirection('left');
                if (gamepad.buttons[15].pressed && state.direction !== 'left') queueDirection('right');

                if (gamepad.axes[0] > 0.5 && state.direction !== 'left') queueDirection('right');
                if (gamepad.axes[0] < -0.5 && state.direction !== 'right') queueDirection('left');
                if (gamepad.axes[1] > 0.5 && state.direction !== 'up') queueDirection('down');
                if (gamepad.axes[1] < -0.5 && state.direction !== 'down') queueDirection('up');

                previousGamepadState[gamepad.index] = {
                    buttons: gamepad.buttons.map(b => b.pressed)
                };
            }
        }
    }
    setInterval(handleGamepad, 50);
}

export function initInput() {
    initKeyboard();
    initTouch();
    initGamepad();
}
