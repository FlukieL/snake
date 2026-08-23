// Google Sign-In integration and score submission. The verified Google name
// is used server-side as the leaderboard entry name - never client text -
// to prevent impersonation.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { refreshAfterSubmit } from './leaderboard.js';

export function resetSubmitUI() {
    state.scoreSubmitted = false;
    dom.submitScoreButton.disabled = !state.googleIdToken;
    dom.submitScoreButton.textContent = state.googleIdToken ? 'Submit Score' : 'Sign in with Google to submit';
}

function showScoreSubmitError(message) {
    dom.submitScoreButton.disabled = false;
    dom.submitScoreButton.textContent = message;
    setTimeout(() => {
        dom.submitScoreButton.textContent = state.googleIdToken ? 'Submit Score' : 'Sign in with Google to submit';
    }, 3000);
}

async function submitScore(scoreValue) {
    try {
        const res = await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: state.googleIdToken, score: scoreValue })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            // Server rejected (e.g. invalid/expired token) - surface it and don't fall back
            // locally, so a rejected/invalid submission never appears in the leaderboard.
            showScoreSubmitError(data.error || 'Could not submit score');
            state.scoreSubmitted = false;
            return;
        }
        refreshAfterSubmit(data.scores);
    } catch (err) {
        // Network failure: we deliberately do NOT fake a local entry here, since without
        // contacting the server we can't have a verified name.
        showScoreSubmitError('Network error - could not submit score');
        state.scoreSubmitted = false;
    }
}

export function submitCurrentScoreIfNeeded() {
    if (state.scoreSubmitted || state.score <= 0) return;
    if (!state.googleIdToken) return; // can't submit without a verified identity
    state.scoreSubmitted = true;
    submitScore(state.score);
}

function handleGoogleCredential(response) {
    state.googleIdToken = response.credential;
    try {
        const payloadB64 = response.credential.split('.')[1];
        const json = JSON.parse(decodeURIComponent(escape(window.atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))));
        state.googleDisplayName = json.name || json.given_name || 'Player';
    } catch (e) {
        state.googleDisplayName = 'Player';
    }
    dom.signedInAsEl.textContent = `Signed in as ${state.googleDisplayName}`;
    dom.signedInAsEl.style.display = 'block';
    dom.googleSignInContainer.style.display = 'none';
    dom.submitScoreButton.disabled = false;
    dom.submitScoreButton.textContent = 'Submit Score';

    // Auto-submit the pending score as soon as the player signs in, so they don't
    // need a separate manual click after authenticating.
    if (state.gameOver && state.score > 0 && !state.scoreSubmitted) {
        submitCurrentScoreIfNeeded();
        dom.submitScoreButton.disabled = true;
        dom.submitScoreButton.textContent = 'Submitted';
    }
}

function initGoogleSignIn() {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        // Google script may not have loaded yet - retry shortly.
        setTimeout(initGoogleSignIn, 300);
        return;
    }
    window.google.accounts.id.initialize({
        client_id: constants.GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false
    });
    window.google.accounts.id.renderButton(dom.googleSignInContainer, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with'
    });
}

export function initAuth() {
    initGoogleSignIn();
    dom.submitScoreButton.addEventListener('click', () => {
        if (!state.googleIdToken) return;
        submitCurrentScoreIfNeeded();
        dom.submitScoreButton.disabled = true;
        dom.submitScoreButton.textContent = 'Submitted';
    });
}
