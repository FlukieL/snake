// Input handling: keyboard, touch swipe, and gamepad (with haptics),
// all funneling into the shared `queueDirection` / pause / restart actions.

import { dom } from './dom.js';
import { state } from './state.js';
import { queueDirection, togglePause, initializeGame, startGameSession } from './game.js';
import { submitCurrentScoreIfNeeded } from './auth.js';

function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !state.gameOver) {
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
}

function initTouch() {
    let xDown = null, yDown = null;

    document.addEventListener('touchstart', evt => {
        xDown = evt.touches[0].clientX;
        yDown = evt.touches[0].clientY;
    }, false);

    document.addEventListener('touchmove', evt => {
        if (!xDown || !yDown) return;
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
    }, false);
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
