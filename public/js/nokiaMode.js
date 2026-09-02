// Nokia Mode toggle logic: persists the setting, updates the UI, plays a
// toggle chirp, and mutes music by default when switching on.

import { dom } from './dom.js';
import { state } from './state.js';
import { loadBoolState, saveState } from './storage.js';
import { updateNokiaModeUI } from './ui.js';
import { playNokiaToggleSound, toggleMusicMute } from './audio.js';

state.nokiaMode = loadBoolState('nokiaMode', false);

function toggleNokiaMode() {
    state.nokiaMode = !state.nokiaMode;
    saveState('nokiaMode', state.nokiaMode);
    updateNokiaModeUI();
    playNokiaToggleSound(state.nokiaMode);

    // Retain the intentionally quiet, beeps-only handset feel.
    if (state.nokiaMode && !state.musicMuted) {
        toggleMusicMute();
    }
}

export function initNokiaMode() {
    dom.nokiaModeButton?.addEventListener('click', toggleNokiaMode);
    updateNokiaModeUI();
}
