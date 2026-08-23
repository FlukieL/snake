// Small shared UI-update helpers used by multiple modules (audio, nokiaMode).
// Kept separate/minimal to avoid circular imports between audio.js and nokiaMode.js.

import { dom } from './dom.js';
import { state } from './state.js';
import { constants } from './state.js';

export function updateMuteButtonUI() {
    const musicText = state.musicMuted ? 'Unmute Music' : 'Mute Music';
    dom.muteMusicButton.textContent = musicText;
    dom.muteMusicGameOverButton.textContent = musicText;
    dom.muteMusicPauseButton.textContent = musicText;
    dom.muteMusicButton.classList.toggle('muted', state.musicMuted);
    dom.muteMusicGameOverButton.classList.toggle('muted', state.musicMuted);
    dom.muteMusicPauseButton.classList.toggle('muted', state.musicMuted);

    const effectsText = state.effectsMuted ? 'Unmute Effects' : 'Mute Effects';
    dom.muteEffectsButton.textContent = effectsText;
    dom.muteEffectsGameOverButton.textContent = effectsText;
    dom.muteEffectsPauseButton.textContent = effectsText;
    dom.muteEffectsButton.classList.toggle('muted', state.effectsMuted);
    dom.muteEffectsGameOverButton.classList.toggle('muted', state.effectsMuted);
    dom.muteEffectsPauseButton.classList.toggle('muted', state.effectsMuted);
}

export function updateNokiaModeUI() {
    document.body.classList.toggle('nokia-mode', state.nokiaMode);
    const label = state.nokiaMode ? '\uD83D\uDCF1 Nokia Mode: On' : '\uD83D\uDCF1 Nokia Mode: Off';
    if (dom.nokiaModeButton) {
        dom.nokiaModeButton.textContent = label;
        dom.nokiaModeButton.classList.toggle('active', state.nokiaMode);
    }
    if (dom.nokiaModePauseButton) {
        dom.nokiaModePauseButton.textContent = label;
        dom.nokiaModePauseButton.classList.toggle('active', state.nokiaMode);
    }
    if (dom.nokiaAsciiLogo) {
        dom.nokiaAsciiLogo.textContent = state.nokiaMode ? constants.NOKIA_ASCII_LOGO : '';
    }
    // Nokia Mode is Classic-only and hides the Classic/Levels mode picker
    // entirely, so simplify the play button to just say "Play" rather than
    // "Play Classic" (which implies a choice that no longer exists here).
    if (dom.startButton) {
        dom.startButton.textContent = state.nokiaMode ? 'Play' : 'Play Classic';
    }
}
