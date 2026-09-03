// Shared UI updates and lightweight modal/notification helpers.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { scheduleSliderRealignment } from './leaderboard.js';

let toastTimer = null;

function setSettingValue(button, value, isMuted = false) {
    if (!button) return;
    const valueEl = button.querySelector('.setting-value');
    if (valueEl) valueEl.textContent = value;
    button.classList.toggle('muted', isMuted);
}

export function updateMuteButtonUI() {
    const musicLabel = state.musicVolume === 0
        ? 'Off'
        : state.musicVolume === 0.25
            ? 'Low'
            : state.musicVolume === 0.85
                ? 'High'
                : 'Medium';
    const effectsLabel = state.effectsVolume === 0
        ? 'Off'
        : state.effectsVolume === 0.25
            ? 'Low'
            : state.effectsVolume === 0.85
                ? 'High'
                : 'Medium';
    setSettingValue(dom.muteMusicButton, musicLabel, state.musicMuted);
    setSettingValue(dom.muteEffectsButton, effectsLabel, state.effectsMuted);
}

export function updateNokiaModeUI() {
    document.body.classList.toggle('nokia-mode', state.nokiaMode);
    setSettingValue(dom.nokiaModeButton, state.nokiaMode ? 'On' : 'Off', !state.nokiaMode);

    if (dom.nokiaAsciiLogo) {
        dom.nokiaAsciiLogo.textContent = state.nokiaMode ? constants.NOKIA_ASCII_LOGO : '';
    }
    if (dom.startButton) {
        dom.startButton.innerHTML = state.nokiaMode ? 'Play <span aria-hidden="true">→</span>' : 'Play Classic <span aria-hidden="true">→</span>';
    }
}

export function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), 2600);
}

export function openSettingsModal() {
    if (!dom.settingsModal) return;
    updateMuteButtonUI();
    updateNokiaModeUI();
    dom.settingsModal.style.display = 'flex';
    requestAnimationFrame(() => dom.settingsCloseButton?.focus());
}

export function closeSettingsModal() {
    if (!dom.settingsModal) return;
    dom.settingsModal.style.display = 'none';
    scheduleSliderRealignment();
}

export function initSettingsUI() {
    const settingsTriggers = [dom.settingsButton, dom.settingsPauseButton, dom.settingsGameOverButton];
    settingsTriggers.filter(Boolean).forEach(button => button.addEventListener('click', openSettingsModal));

    dom.settingsCloseButton?.addEventListener('click', closeSettingsModal);
    dom.settingsModal?.addEventListener('click', event => {
        if (event.target === dom.settingsModal) closeSettingsModal();
    });
}
