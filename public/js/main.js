// Application entry point. Wires up all modules in the correct order,
// binds top-level UI event listeners (start/restart/pause/main-menu buttons,
// score-animation cleanup), and kicks off leaderboard loading.

import { dom } from './dom.js';
import { state } from './state.js';
import { initOfflineDetection } from './offline.js';
import { initAudioControls } from './audio.js';
import { initHaptics } from './haptics.js';
import { initNokiaMode } from './nokiaMode.js';
import { initLeaderboard } from './leaderboard.js';
import { initAuth, submitCurrentScoreIfNeeded } from './auth.js';
import { initInput } from './input.js';
import { initPowerupInfo } from './powerupInfo.js';
import { initLogoAnimation } from './logoAnimation.js';
import { initSettingsUI } from './ui.js';
import {
    initializeGame,
    togglePause,
    startGameSession,
    returnToMainMenu,
    exitToMainMenuFromPause
} from './game.js';

function initScoreAnimationCleanup() {
    dom.scoreCounter.addEventListener('animationend', () => {
        dom.scoreCounter.classList.remove('animateScore');
    });
}

function initExitConfirmation() {
    let onConfirm = null;

    function closeExitConfirmation() {
        dom.confirmExitModal.style.display = 'none';
        onConfirm = null;
    }

    function requestExit(callback) {
        onConfirm = callback;
        dom.confirmExitModal.style.display = 'flex';
        requestAnimationFrame(() => dom.cancelExitButton.focus());
    }

    dom.cancelExitButton?.addEventListener('click', closeExitConfirmation);
    dom.confirmExitButton?.addEventListener('click', () => {
        const callback = onConfirm;
        closeExitConfirmation();
        callback?.();
    });
    dom.confirmExitModal?.addEventListener('click', event => {
        if (event.target === dom.confirmExitModal) closeExitConfirmation();
    });

    return requestExit;
}

function initMenuButtons() {
    const requestExit = initExitConfirmation();
    dom.restartButton.addEventListener('click', () => {
        dom.gameOverScreen.style.display = 'none';
        dom.gameHud.style.display = 'flex';
        submitCurrentScoreIfNeeded();
        initializeGame(state.gameMode);
    });

    dom.startButton.addEventListener('click', () => startGameSession('classic'));

    if (dom.startLevelsButton) {
        dom.startLevelsButton.addEventListener('click', () => startGameSession('levels'));
    }

    dom.pauseButton.addEventListener('click', togglePause);

    // Resuming is done exclusively via the pause screen's own "Resume"
    // button now (rather than the floating top-right button toggling its
    // own label), so there's a single unambiguous way to unpause.
    if (dom.resumeButton) {
        dom.resumeButton.addEventListener('click', togglePause);
    }

    dom.mainMenuButton.addEventListener('click', () => {
        returnToMainMenu(submitCurrentScoreIfNeeded);
    });

    if (dom.mainMenuPauseButton) {
        dom.mainMenuPauseButton.addEventListener('click', () => {
            requestExit(() => exitToMainMenuFromPause(submitCurrentScoreIfNeeded));
        });
    }
}

function initPwaInstall() {
    const installButton = dom.installPwaButton;
    const iosPrompt = document.getElementById('iosPrompt');
    const dismissPrompt = document.getElementById('dismissPrompt');
    if (!installButton) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isMobile = isIOS || /Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let deferredInstallPrompt = null;

    // The install UI is deliberately mobile-only and is never shown inside
    // the installed app itself. iOS does not provide beforeinstallprompt, so
    // its button opens concise Safari-specific installation instructions.
    if (!isMobile || isStandalone) return;

    if (isIOS) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', () => {
            if (iosPrompt) iosPrompt.style.display = 'block';
        });
        if (dismissPrompt) {
            dismissPrompt.addEventListener('click', () => {
                if (iosPrompt) iosPrompt.style.display = 'none';
            });
        }
        return;
    }

    // Chromium exposes this event only when the browser considers the page
    // installable. Saving it lets a user-initiated button click show Chrome's
    // native install dialog; browsers never allow that dialog to be forced.
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installButton.style.display = 'block';
    });

    installButton.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installButton.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        installButton.style.display = 'none';
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
            //
            // Note: we'll also use this as the signal that a *real* update was
            // installed, to avoid reloading on controllerchange in situations
            // that aren't actually updates (first control, tab restore, etc.).
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed') {
                        sawUpdateInstalled = true;
                    }
                    if (newWorker.state === 'installed' && registration.waiting) {
                        newWorker.postMessage('SKIP_WAITING');
                    }
                });
            });
        }).catch(() => {});

        // Avoid auto-reloading on every `controllerchange`.
        //
        // `controllerchange` fires whenever the page becomes controlled by a
        // different service worker. That happens on genuine updates, but it
        // also happens in normal scenarios (first control after registration,
        // browser restoring a tab, etc.). Auto-reloading in those cases can look
        // like a "random refresh" even though the cache is already up to date.
        //
        // Instead, only reload when we can positively identify a *real* update:
        //  - we already had a controller (so this isn't the first time control
        //    was taken), AND
        //  - this tab's registration observed a new worker reach "installed".
        //
        // Additionally, still defer the reload until the user is safely on the
        // main menu to avoid kicking them out mid-game.
        let hasReloaded = false;
        let updateReady = false;
        let sawUpdateInstalled = false;
        const hadControllerOnLoad = !!navigator.serviceWorker.controller;

        function reloadIfSafe() {
            if (hasReloaded || !updateReady) return;
            const onMainMenu = getComputedStyle(dom.startGameScreen).display !== 'none';
            if (onMainMenu && !state.inGame) {
                hasReloaded = true;
                window.location.reload();
            }
        }

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hadControllerOnLoad) return;
            if (!sawUpdateInstalled) return;

            updateReady = true;
            reloadIfSafe();
        });

        // Re-check whenever the player might have returned to the main menu.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') reloadIfSafe();
        });
        setInterval(reloadIfSafe, 2000);
    });
}

function init() {
    // Must run first - other modules (leaderboard.js, auth.js) check
    // state.isOnline during their own init to decide whether to attempt
    // network requests at all.
    initOfflineDetection();
    initAudioControls();
    initHaptics();
    initNokiaMode();
    initLeaderboard();
    initAuth();
    initInput();
    initPowerupInfo();
    initSettingsUI();
    initLogoAnimation();
    initScoreAnimationCleanup();
    initMenuButtons();
    initPwaInstall();
    initServiceWorker();
}

init();
