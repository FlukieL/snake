// Application entry point. Wires up all modules in the correct order,
// binds top-level UI event listeners (start/restart/pause/main-menu buttons,
// score-animation cleanup), and kicks off leaderboard loading.

import { dom } from './dom.js';
import { initAudioControls } from './audio.js';
import { initNokiaMode } from './nokiaMode.js';
import { initLeaderboard } from './leaderboard.js';
import { initAuth, submitCurrentScoreIfNeeded } from './auth.js';
import { initInput } from './input.js';
import {
    initializeGame,
    togglePause,
    startGameSession,
    returnToMainMenu
} from './game.js';

function initScoreAnimationCleanup() {
    dom.scoreCounter.addEventListener('animationend', () => {
        dom.scoreCounter.classList.remove('animateScore');
    });
}

function initMenuButtons() {
    dom.restartButton.addEventListener('click', () => {
        dom.gameOverScreen.style.display = 'none';
        submitCurrentScoreIfNeeded();
        initializeGame();
    });

    dom.startButton.addEventListener('click', startGameSession);

    dom.pauseButton.addEventListener('click', togglePause);

    dom.mainMenuButton.addEventListener('click', () => {
        returnToMainMenu(submitCurrentScoreIfNeeded);
    });
}

function initIOSPrompt() {
    const iosPrompt = document.getElementById('iosPrompt');
    const dismissPrompt = document.getElementById('dismissPrompt');
    if (!iosPrompt || !dismissPrompt) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
        iosPrompt.style.display = 'block';
    }
    dismissPrompt.addEventListener('click', () => {
        iosPrompt.style.display = 'none';
    });
}

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            // If an updated service worker is already waiting (e.g. this tab was
            // open during a deploy), activate it immediately.
            if (registration.waiting) {
                registration.waiting.postMessage('SKIP_WAITING');
            }

            // Watch for newly installed workers and activate them as soon as
            // they're ready, so users get the latest app/cache version without
            // needing to manually clear their cache.
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && registration.waiting) {
                        newWorker.postMessage('SKIP_WAITING');
                    }
                });
            });
        }).catch(() => {});

        // Once the new service worker takes control, reload so the page picks
        // up the freshly cached assets rather than running stale JS/CSS.
        let hasReloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hasReloaded) return;
            hasReloaded = true;
            window.location.reload();
        });
    });
}

function init() {
    initAudioControls();
    initNokiaMode();
    initLeaderboard();
    initAuth();
    initInput();
    initScoreAnimationCleanup();
    initMenuButtons();
    initIOSPrompt();
    initServiceWorker();
}

init();
