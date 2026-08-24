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

// Levels Mode: a short bright chime for collecting a power-up.
export function playPowerupSound() {
    if (state.effectsMuted) return;
    playBeep(1046, 0.08, 'sine', 0.2);
    setTimeout(() => playBeep(1568, 0.1, 'sine', 0.2), 70);
    vibrateController(60);
}

// Levels Mode: an ascending fanfare for advancing to the next level.
export function playLevelUpSound() {
    if (state.effectsMuted) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.14, 'triangle', 0.22), i * 90));
    vibrateController(120);
}

// Levels Mode: a cheerful jingle when an extra life is earned.
export function playExtraLifeSound() {
    if (state.effectsMuted) return;
    const notes = [784, 988, 1175, 1568];
    notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.12, 'sine', 0.22), i * 80));
    vibrateController(150);
}

// Levels Mode: a low descending buzz when a life is lost (but the game continues).
export function playLoseLifeSound() {
    if (state.effectsMuted) return;
    const notes = [440, 349, 262];
    notes.forEach((f, i) => setTimeout(() => playBeep(f, 0.18, 'sawtooth', 0.18), i * 110));
    vibrateController([150, 80, 150]);
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

// Levels Mode plays the same music track at a slightly lower pitch than
// Classic Mode, giving it a subtly different, moodier feel without needing
// a separate audio file. `preservesPitch = false` makes changing
// playbackRate also shift the pitch (rather than time-stretching to keep
// the original pitch), so a rate < 1 sounds both slower AND lower - like
// slowing down a tape/record rather than just changing tempo.
const LEVELS_MUSIC_PLAYBACK_RATE = 0.92; // ~-1.4 semitones lower than Classic
export function applyMusicPitchForMode() {
    const rate = state.gameMode === 'levels' ? LEVELS_MUSIC_PLAYBACK_RATE : 1;
    dom.gameMusic.playbackRate = rate;
    // Cross-browser property name variants for disabling pitch correction.
    dom.gameMusic.preservesPitch = false;
    dom.gameMusic.mozPreservesPitch = false;
    dom.gameMusic.webkitPreservesPitch = false;
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
