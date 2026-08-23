// Audio subsystem: manages music/effect muting, MP3 playback, and the
// Web Audio API synthesizer used for Nokia Mode's retro beep effects.

import { dom } from './dom.js';
import { state } from './state.js';
import { loadBoolState, saveState } from './storage.js';
import { updateMuteButtonUI } from './ui.js';

state.musicMuted = loadBoolState('musicMuted', false);
state.effectsMuted = loadBoolState('effectsMuted', false);

let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}

export function playBeep(freq, duration, type, volume) {
    const ac = getAudioContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume != null ? volume : 0.15;
    osc.connect(gain);
    gain.connect(ac.destination);
    const now = ac.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
}

export function playNokiaEatSound() {
    playBeep(880, 0.07, 'square', 0.18);
    setTimeout(() => playBeep(1320, 0.08, 'square', 0.18), 60);
}

export function playNokiaGameOverSound() {
    const notes = [660, 550, 440, 330];
    notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.16, 'square', 0.2), i * 130));
}

export function playNokiaToggleSound(turningOn) {
    if (turningOn) {
        playBeep(660, 0.06, 'square', 0.16);
        setTimeout(() => playBeep(990, 0.08, 'square', 0.16), 70);
    } else {
        playBeep(990, 0.06, 'square', 0.16);
        setTimeout(() => playBeep(660, 0.08, 'square', 0.16), 70);
    }
}

export function playEatSound() {
    if (state.effectsMuted) return;
    if (state.nokiaMode) {
        playNokiaEatSound();
    } else {
        dom.eatingSound.currentTime = 0;
        dom.eatingSound.play().catch(() => {});
    }
    vibrateController(100);
}

export function playGameOverSound() {
    if (state.effectsMuted) return;
    if (state.nokiaMode) {
        playNokiaGameOverSound();
    } else {
        dom.gameOverSound.play().catch(() => {});
    }
    vibrateController([200, 100, 200]);
}

export function vibrateController(duration) {
    const gamepads = navigator.getGamepads();
    if (gamepads[0] && gamepads[0].hapticActuators && gamepads[0].hapticActuators.length > 0) {
        gamepads[0].hapticActuators[0].pulse(1.0, Array.isArray(duration) ? duration[0] : duration);
    }
}

export function isGameplayActive() {
    return state.inGame && !state.gamePaused && !state.gameOver;
}

export function toggleMusicMute() {
    state.musicMuted = !state.musicMuted;
    saveState('musicMuted', state.musicMuted);
    updateMuteButtonUI();
    if (state.musicMuted) {
        dom.gameMusic.pause();
    } else if (isGameplayActive()) {
        dom.gameMusic.play().catch(() => {});
    }
}

export function toggleEffectsMute() {
    state.effectsMuted = !state.effectsMuted;
    saveState('effectsMuted', state.effectsMuted);
    updateMuteButtonUI();
}

export function initAudioControls() {
    updateMuteButtonUI();
    dom.muteMusicButton.addEventListener('click', toggleMusicMute);
    dom.muteEffectsButton.addEventListener('click', toggleEffectsMute);
    dom.muteMusicGameOverButton.addEventListener('click', toggleMusicMute);
    dom.muteEffectsGameOverButton.addEventListener('click', toggleEffectsMute);
    dom.muteMusicPauseButton.addEventListener('click', toggleMusicMute);
    dom.muteEffectsPauseButton.addEventListener('click', toggleEffectsMute);
}
