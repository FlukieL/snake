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

    // Turning Nokia Mode on mutes the music by default, matching the silent/beeps-only
    // feel of the original handset. Turning it off does not automatically unmute.
    if (state.nokiaMode && !state.musicMuted) {
        toggleMusicMute();
    }
}

export function initNokiaMode() {
    if (dom.nokiaModeButton) dom.nokiaModeButton.addEventListener('click', toggleNokiaMode);
    if (dom.nokiaModePauseButton) dom.nokiaModePauseButton.addEventListener('click', toggleNokiaMode);
    updateNokiaModeUI();
}
