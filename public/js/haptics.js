// Mobile vibration support. All calls are guarded because the Vibration API is
// optional, may be unavailable in installed browsers, and is unsupported by iOS Safari.

import { dom } from './dom.js';
import { state } from './state.js';
import { loadBoolState, saveState } from './storage.js';

const isMobileDevice = () =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches);

export function supportsVibration() {
    return isMobileDevice() && typeof navigator.vibrate === 'function';
}

function updateVibrationButtonUI() {
    if (!dom.vibrationButton) return;
    const available = supportsVibration();
    dom.vibrationButton.style.display = available ? 'flex' : 'none';

    const value = dom.vibrationButton.querySelector('.setting-value');
    if (value) value.textContent = state.vibrationEnabled ? 'On' : 'Off';
    dom.vibrationButton.classList.toggle('muted', !state.vibrationEnabled);
}

export function initHaptics() {
    // Default to enabled for new visitors, while respecting a previously saved choice.
    state.vibrationEnabled = loadBoolState('vibrationEnabled', true);
    updateVibrationButtonUI();

    dom.vibrationButton?.addEventListener('click', () => {
        state.vibrationEnabled = !state.vibrationEnabled;
        saveState('vibrationEnabled', state.vibrationEnabled);
        updateVibrationButtonUI();

        // A short confirmation pulse gives immediate feedback when enabling.
        if (state.vibrationEnabled) navigator.vibrate?.(20);
    });
}

function vibrate(pattern) {
    if (!state.vibrationEnabled || !supportsVibration()) return;
    navigator.vibrate(pattern);
}

export function vibrateFruit() {
    vibrate(18);
}

export function vibratePowerup() {
    vibrate([20, 35, 35]);
}

export function vibrateDeath() {
    vibrate([70, 45, 110]);
}
