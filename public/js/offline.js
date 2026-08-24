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

function updateOfflineUI() {
    if (!dom.offlineBanner) return;
    dom.offlineBanner.style.display = state.isOnline ? 'none' : 'block';
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
