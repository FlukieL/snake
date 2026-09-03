// Audio subsystem: manages music/effect muting, MP3 playback, and the
// Web Audio API synthesizer used for Nokia Mode's retro beep effects.

import { dom } from './dom.js';
import { state } from './state.js';
import { loadBoolState, loadState, saveState } from './storage.js';
import { updateMuteButtonUI } from './ui.js';

const MUSIC_VOLUME_LEVELS = [
    { label: 'Off', value: 0 },
    { label: 'Low', value: 0.25 },
    { label: 'Medium', value: 0.55 },
    { label: 'High', value: 0.85 }
];

const EFFECTS_VOLUME_LEVELS = MUSIC_VOLUME_LEVELS;

const storedMusicVolume = Number(loadState('musicVolume', NaN));
state.musicVolume = MUSIC_VOLUME_LEVELS.some(level => level.value === storedMusicVolume)
    ? storedMusicVolume
    : (loadBoolState('musicMuted', false) ? 0 : 0.25);
state.musicMuted = state.musicVolume === 0;

const storedEffectsVolume = Number(loadState('effectsVolume', NaN));
state.effectsVolume = EFFECTS_VOLUME_LEVELS.some(level => level.value === storedEffectsVolume)
    ? storedEffectsVolume
    // Existing users retain an explicit mute choice; everyone else starts at Medium.
    : (loadBoolState('effectsMuted', false) ? 0 : 0.55);
state.effectsMuted = state.effectsVolume === 0;

function currentMusicLevel() {
    return MUSIC_VOLUME_LEVELS.find(level => level.value === state.musicVolume) || MUSIC_VOLUME_LEVELS[2];
}

function currentEffectsLevel() {
    return EFFECTS_VOLUME_LEVELS.find(level => level.value === state.effectsVolume) || EFFECTS_VOLUME_LEVELS[2];
}

function applyMusicVolume() {
    dom.gameMusic.volume = state.musicVolume;
}

function applyEffectsVolume() {
    dom.eatingSound.volume = state.effectsVolume;
    dom.gameOverSound.volume = state.effectsVolume;
}

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
    gain.gain.value = (volume != null ? volume : 0.15) * state.effectsVolume;
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
    [660, 550, 440, 330].forEach((frequency, index) => {
        setTimeout(() => playBeep(frequency, 0.16, 'square', 0.2), index * 130);
    });
}

export function playNokiaToggleSound(turningOn) {
    const notes = turningOn ? [660, 990] : [990, 660];
    playBeep(notes[0], 0.06, 'square', 0.16);
    setTimeout(() => playBeep(notes[1], 0.08, 'square', 0.16), 70);
}

export function playEatSound() {
    if (state.effectsMuted) return;
    if (state.nokiaMode) playNokiaEatSound();
    else {
        dom.eatingSound.currentTime = 0;
        dom.eatingSound.play().catch(() => {});
    }
    vibrateController(100);
}

export function playGameOverSound() {
    if (state.effectsMuted) return;
    if (state.nokiaMode) playNokiaGameOverSound();
    else dom.gameOverSound.play().catch(() => {});
    vibrateController([200, 100, 200]);
}

export function playPowerupSound() {
    if (state.effectsMuted) return;
    playBeep(1046, 0.08, 'sine', 0.2);
    setTimeout(() => playBeep(1568, 0.1, 'sine', 0.2), 70);
    vibrateController(60);
}

export function playLevelUpSound() {
    if (state.effectsMuted) return;
    [523, 659, 784, 1046].forEach((frequency, index) => {
        setTimeout(() => playBeep(frequency, 0.14, 'triangle', 0.22), index * 90);
    });
    vibrateController(120);
}

export function playExtraLifeSound() {
    if (state.effectsMuted) return;
    [784, 988, 1175, 1568].forEach((frequency, index) => {
        setTimeout(() => playBeep(frequency, 0.12, 'sine', 0.22), index * 80);
    });
    vibrateController(150);
}

export function playLoseLifeSound() {
    if (state.effectsMuted) return;
    [440, 349, 262].forEach((frequency, index) => {
        setTimeout(() => playBeep(frequency, 0.18, 'sawtooth', 0.18), index * 110);
    });
    vibrateController([150, 80, 150]);
}

export function vibrateController(duration) {
    const gamepads = navigator.getGamepads();
    if (gamepads[0]?.hapticActuators?.length > 0) {
        gamepads[0].hapticActuators[0].pulse(1.0, Array.isArray(duration) ? duration[0] : duration);
    }
}

export function isGameplayActive() {
    return state.inGame && !state.gamePaused && !state.gameOver;
}

const LEVELS_MUSIC_PLAYBACK_RATE = 0.92;
export function applyMusicPitchForMode() {
    const rate = state.gameMode === 'levels' ? LEVELS_MUSIC_PLAYBACK_RATE : 1;
    dom.gameMusic.playbackRate = rate;
    dom.gameMusic.preservesPitch = false;
    dom.gameMusic.mozPreservesPitch = false;
    dom.gameMusic.webkitPreservesPitch = false;
}

export function setMusicVolume(volume) {
    const level = MUSIC_VOLUME_LEVELS.find(candidate => candidate.value === volume) || MUSIC_VOLUME_LEVELS[2];
    state.musicVolume = level.value;
    state.musicMuted = level.value === 0;
    saveState('musicVolume', state.musicVolume);
    saveState('musicMuted', state.musicMuted);
    applyMusicVolume();
    updateMuteButtonUI();

    if (state.musicMuted) {
        dom.gameMusic.pause();
    } else if (isGameplayActive()) {
        dom.gameMusic.play().catch(() => {});
    }
}

export function cycleMusicVolume() {
    const currentIndex = MUSIC_VOLUME_LEVELS.findIndex(level => level.value === state.musicVolume);
    const nextLevel = MUSIC_VOLUME_LEVELS[(currentIndex + 1) % MUSIC_VOLUME_LEVELS.length];
    setMusicVolume(nextLevel.value);
}

export function toggleMusicMute() {
    cycleMusicVolume();
}

export function setEffectsVolume(volume) {
    const level = EFFECTS_VOLUME_LEVELS.find(candidate => candidate.value === volume) || EFFECTS_VOLUME_LEVELS[2];
    state.effectsVolume = level.value;
    state.effectsMuted = level.value === 0;
    saveState('effectsVolume', state.effectsVolume);
    // Keep the old key updated for compatibility with previous installs.
    saveState('effectsMuted', state.effectsMuted);
    applyEffectsVolume();
    updateMuteButtonUI();
}

export function cycleEffectsVolume() {
    const currentIndex = EFFECTS_VOLUME_LEVELS.findIndex(level => level.value === state.effectsVolume);
    const nextLevel = EFFECTS_VOLUME_LEVELS[(currentIndex + 1) % EFFECTS_VOLUME_LEVELS.length];
    setEffectsVolume(nextLevel.value);
}

export function toggleEffectsMute() {
    cycleEffectsVolume();
}

export function initAudioControls() {
    applyMusicVolume();
    applyEffectsVolume();
    updateMuteButtonUI();
    dom.muteMusicButton?.addEventListener('click', cycleMusicVolume);
    dom.muteEffectsButton?.addEventListener('click', cycleEffectsVolume);
}

export function getMusicVolumeLabel() {
    return currentMusicLevel().label;
}

export function getEffectsVolumeLabel() {
    return currentEffectsLevel().label;
}
