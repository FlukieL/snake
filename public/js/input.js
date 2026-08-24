// Input handling: keyboard, touch swipe, and gamepad (with haptics),
// all funneling into the shared `queueDirection` / pause / restart actions.
// Also provides a unified keyboard/gamepad navigation system for all three
// menu screens (main menu, pause, game over), with an explicit CSS class
// for the currently-focused button so it's always clearly visible
// regardless of how focus arrived (browsers are inconsistent about when
// the native :focus-visible pseudo-class triggers for gamepad-driven
// focus() calls, which is why a highlighted button wasn't reliably shown).

import { dom } from './dom.js';
import { state } from './state.js';
import { queueDirection, togglePause, initializeGame, startGameSession } from './game.js';
import { submitCurrentScoreIfNeeded } from './auth.js';

const MENU_FOCUS_CLASS = 'menu-focus-visible';

// Returns whichever menu screen is currently visible, or null if none is
// (i.e. actively playing). Checked in priority order since more than one
// screen element can technically be display:block at once during
// transitions - pause/game-over always take priority over the main menu.
function getActiveMenuScreen() {
    // The power-up info modal is a separate overlay sibling of the main
    // menu screens (not nested inside any of them), so it must be checked
    // first and take priority - otherwise navigation kept resolving to the
    // main menu underneath it (whose buttons are still technically visible/
    // focusable since the modal only visually overlays them rather than
    // hiding them), silently moving focus among covered/invisible elements
    // instead of the modal's own "Got it" button. This was the cause of
    // navigation appearing to "stop working" after opening the power-up
    // info modal from the Levels Mode menu panel.
    if (dom.powerupInfoModal && dom.powerupInfoModal.offsetParent !== null) return dom.powerupInfoModal;
    if (state.gamePaused && dom.pauseScreen) return dom.pauseScreen;
    if (state.gameOver && dom.gameOverScreen) return dom.gameOverScreen;
    if (!state.inGame && dom.startGameScreen) return dom.startGameScreen;
    return null;
}

// Returns all currently-visible, focusable elements (buttons and links)
// within a given menu screen, in visual top-to-bottom DOM order. Filters
// out hidden elements (e.g. the Nokia Mode toggle, which is display:none
// while in Levels Mode) - focus() silently fails on a display:none
// element, so including one in the list would make navigation get stuck
// unable to move past/skip over it.
function getMenuFocusables(screen) {
    if (!screen) return [];
    return Array.from(screen.querySelectorAll('button, a[href]'))
        .filter(el => el.offsetParent !== null);
}

// Explicitly marks `el` as the visibly-focused menu item (adding our own
// class alongside the native focus() call), clearing the marker from any
// previously-focused element first so only one is ever highlighted.
function setMenuFocus(el) {
    if (!el) return;
    document.querySelectorAll('.' + MENU_FOCUS_CLASS).forEach(prev => {
        if (prev !== el) prev.classList.remove(MENU_FOCUS_CLASS);
    });
    el.focus();
    el.classList.add(MENU_FOCUS_CLASS);
}

// Focuses the first focusable item in whichever menu screen is currently
// active. Called whenever a screen becomes visible (game over, pause) so
// keyboard/gamepad navigation has an obvious, immediate starting point
// rather than requiring an extra keypress first.
export function focusFirstMenuItem() {
    const screen = getActiveMenuScreen();
    const items = getMenuFocusables(screen);
    if (!items.length) return;

    // On the main menu specifically, default focus to the active mode's
    // "Play" button rather than whichever element happens to be first in
    // DOM order - the Classic/Levels mode-tab buttons are positioned
    // before the Play button in the markup, so a plain "first item" default
    // was highlighting the Classic tab instead of the much more useful
    // Play button (matching what a player almost always wants to do next).
    if (screen === dom.startGameScreen) {
        const activePanel = Array.from(screen.querySelectorAll('.mode-panel'))
            .find(panel => panel.offsetParent !== null);
        const playButton = activePanel && activePanel.querySelector('.menu-button');
        if (playButton && items.includes(playButton)) {
            setMenuFocus(playButton);
            return;
        }
    }

    setMenuFocus(items[0]);
}

// Moves keyboard/gamepad focus to the next/previous focusable item within
// whichever menu screen is currently active (wrapping around at either
// end), so every menu is fully navigable without a mouse/touch.
function moveMenuFocus(delta) {
    const screen = getActiveMenuScreen();
    const items = getMenuFocusables(screen);
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    const nextIndex = currentIndex === -1
        ? 0
        : (currentIndex + delta + items.length) % items.length;
    setMenuFocus(items[nextIndex]);
}

// Keeps our explicit focus-highlight class in sync whenever focus moves by
// any means (mouse click, Tab key, programmatic focus() elsewhere in the
// app) - not just through moveMenuFocus() above - so the highlight never
// gets out of sync with the browser's actual focus target.
function initFocusTracking() {
    document.addEventListener('focusin', e => {
        document.querySelectorAll('.' + MENU_FOCUS_CLASS).forEach(prev => {
            if (prev !== e.target) prev.classList.remove(MENU_FOCUS_CLASS);
        });
        if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A')) {
            e.target.classList.add(MENU_FOCUS_CLASS);
        }
    });
    document.addEventListener('focusout', e => {
        e.target.classList.remove(MENU_FOCUS_CLASS);
    });
}

function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !state.gameOver) {
            togglePause();
            return;
        }

        const activeMenuScreen = getActiveMenuScreen();

        // Whenever any menu screen is showing, arrow keys/WASD navigate its
        // buttons instead of queuing a snake movement (which would have no
        // visible effect during a menu anyway, but previously could still
        // silently queue a direction that applied the instant gameplay
        // resumed/started - a confusing surprise "instant turn").
        if (activeMenuScreen) {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W': e.preventDefault(); moveMenuFocus(-1); break;
                case 'ArrowDown': case 's': case 'S': e.preventDefault(); moveMenuFocus(1); break;
                case 'Enter': case ' ':
                    if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) {
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
                const activeMenuScreen = getActiveMenuScreen();

                if (activeMenuScreen) {
                    // Any menu screen is showing: D-pad/left-stick up/down
                    // navigate its buttons, and A (button 0) activates
                    // whichever one currently has focus - mirrors the
                    // keyboard behavior so every menu is fully
                    // controller-navigable too.
                    const upPressed = gamepad.buttons[12].pressed || gamepad.axes[1] < -0.5;
                    const downPressed = gamepad.buttons[13].pressed || gamepad.axes[1] > 0.5;
                    const prevUp = previousGamepadState[gamepad.index].buttons[12] || previousGamepadState[gamepad.index].axisUp;
                    const prevDown = previousGamepadState[gamepad.index].buttons[13] || previousGamepadState[gamepad.index].axisDown;
                    if (upPressed && !prevUp) moveMenuFocus(-1);
                    if (downPressed && !prevDown) moveMenuFocus(1);
                    if (gamepad.buttons[0].pressed && !previousGamepadState[gamepad.index].buttons[0]) {
                        if (document.activeElement &&
                            (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A') &&
                            activeMenuScreen.contains(document.activeElement)) {
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
    initFocusTracking();
    initKeyboard();
    initTouch();
    initGamepad();
}
