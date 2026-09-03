// Nokia Mode toggle logic: persists the setting, updates the UI, plays a
// toggle chirp, and mutes music by default when switching on.

import { dom } from './dom.js';
import { state } from './state.js';
import { loadBoolState, saveState } from './storage.js';
import { closeSettingsModal, updateNokiaModeUI } from './ui.js';
import { playNokiaToggleSound, setMusicVolume } from './audio.js';

state.nokiaMode = loadBoolState('nokiaMode', false);

function toggleNokiaMode() {
    state.nokiaMode = !state.nokiaMode;
    saveState('nokiaMode', state.nokiaMode);
    updateNokiaModeUI();
    playNokiaToggleSound(state.nokiaMode);

    // Retain the intentionally quiet, beeps-only handset feel without
    // advancing the normal Off → Low → Medium → High volume cycle.
    if (state.nokiaMode) {
        setMusicVolume(0);
    }

    // The visual mode change is immediately obvious on the main screen;
    // dismiss Preferences so the player returns there as soon as it toggles.
    closeSettingsModal();
}

export function initNokiaMode() {
    dom.nokiaModeButton?.addEventListener('click', toggleNokiaMode);
    updateNokiaModeUI();
}
