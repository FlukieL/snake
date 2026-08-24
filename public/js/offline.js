// Centralized online/offline detection. Tracks connectivity via
// navigator.onLine plus the browser's 'online'/'offline' events, shows a
// persistent banner while offline, and disables anything that requires a
// live network connection (leaderboard submission/fetching, Google
// Sign-In) until connectivity is restored - since this is a PWA meant to
// be fully playable offline once installed, but the leaderboard is
// inherently a server-backed feature that simply can't work without a
// network.

import { dom } from './dom.js';
import { state } from './state.js';

// Other modules (auth.js, leaderboard.js) check this instead of directly
// reading navigator.onLine, so all "are we online" checks stay consistent
// and testable from one place.
export function isOnline() {
    return state.isOnline;
}

// Registered by other modules that need to react immediately when
// connectivity changes (e.g. auth.js re-evaluating the submit button,
// leaderboard.js re-fetching scores the moment we're back online) rather
// than only reacting the next time the player happens to interact with
// that feature.
const listeners = [];
export function onConnectivityChange(fn) {
    listeners.push(fn);
}

// The banner is only ever shown on menu screens (main menu / game over) -
// while actively playing (state.inGame), it's hidden regardless of
// connectivity, since it overlaps the fixed top-right Pause button and
// gameplay itself doesn't depend on the network at all (only the
// leaderboard/submission features, which are only ever interacted with
// from a menu screen anyway). Exported so game.js can re-trigger this
// check on every screen transition (starting a run, pausing, game over,
// returning to the main menu) without offline.js needing to know about
// those transitions itself.
export function updateOfflineUI() {
    if (!dom.offlineBanner) return;
    // state.inGame stays true all the way through the Game Over screen
    // (only reset to false when returning to the main menu - see
    // game.js/returnToMainMenu), so "actively playing" specifically means
    // inGame && !gameOver && !gamePaused. The banner should still be
    // shown on the Game Over screen (its own scoreboard/sign-in section is
    // a menu-like feature that also needs the offline notice) and on the
    // Pause screen isn't a concern either way since the banner would just
    // overlay the already-open pause menu, not the gameplay canvas.
    const activelyPlaying = state.inGame && !state.gameOver && !state.gamePaused;
    const shouldShow = !state.isOnline && !activelyPlaying;
    dom.offlineBanner.style.display = shouldShow ? 'block' : 'none';
}

function setOnlineState(online) {
    if (state.isOnline === online) return;
    state.isOnline = online;
    updateOfflineUI();
    listeners.forEach(fn => fn(online));
}

export function initOfflineDetection() {
    state.isOnline = navigator.onLine;
    updateOfflineUI();

    window.addEventListener('online', () => setOnlineState(true));
    window.addEventListener('offline', () => setOnlineState(false));
}
