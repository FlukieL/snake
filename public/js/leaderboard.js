// Leaderboard rendering and data fetching: scoreboard lists, rank badges,
// the animated top-player banner, and tab switching between All Time/Weekly.
// Supports two independent leaderboards - "classic" (by score) and "levels"
// (by highest level reached, then score) - each with their own cache/tabs.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { loadCachedHighScores, saveCachedHighScores } from './storage.js';
import { isOnline, onConnectivityChange } from './offline.js';

state.cachedScoresByPeriod = {
    alltime: loadCachedHighScores('classic_alltime'),
    weekly: loadCachedHighScores('classic_weekly')
};
state.cachedLevelsScoresByPeriod = {
    alltime: loadCachedHighScores('levels_alltime'),
    weekly: loadCachedHighScores('levels_weekly')
};

function formatScoreDate(isoLikeString) {
    if (!isoLikeString) return '';
    // D1's datetime('now') returns "YYYY-MM-DD HH:MM:SS" (UTC, no 'Z'/'T').
    const normalized = isoLikeString.includes('T') ? isoLikeString : isoLikeString.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
}

function createRankBadge(rank) {
    const medal = constants.RANK_MEDALS[rank];
    if (!medal) return null;
    const badge = document.createElement('span');
    badge.className = 'rank-badge rank-' + medal;
    badge.textContent = rank;
    return badge;
}

function animateTopPlayerBanner(bannerEl, topEntry, mode) {
    bannerEl.innerHTML = '';
    if (!topEntry) {
        bannerEl.style.display = 'none';
        return;
    }
    bannerEl.style.display = 'flex';

    const trophy = document.createElement('span');
    trophy.className = 'banner-trophy';
    trophy.textContent = '\uD83C\uDFC6';
    bannerEl.appendChild(trophy);

    const infoWrap = document.createElement('span');
    infoWrap.className = 'score-info banner-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'score-name banner-name';

    topEntry.name.split('').forEach((ch, i) => {
        const span = document.createElement('span');
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.className = 'banner-letter';
        span.style.color = constants.BANNER_LETTER_COLORS[i % constants.BANNER_LETTER_COLORS.length];
        span.style.animationDelay = `${i * 0.12}s`;
        nameSpan.appendChild(span);
    });
    infoWrap.appendChild(nameSpan);

    const dateText = formatScoreDate(topEntry.created_at);
    if (dateText) {
        const dateSpan = document.createElement('span');
        dateSpan.className = 'score-date';
        dateSpan.textContent = dateText;
        infoWrap.appendChild(dateSpan);
    }

    bannerEl.appendChild(infoWrap);

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'score-value';
    scoreSpan.textContent = mode === 'levels' ? `Lv.${topEntry.level} · ${topEntry.score}` : topEntry.score;
    bannerEl.appendChild(scoreSpan);
}

function renderHighScores(listElement, scores, mode) {
    listElement.innerHTML = '';
    if (!scores || scores.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No scores yet';
        listElement.appendChild(li);
        return;
    }
    // Skip rank #1 (already shown in the banner above) and show the next 5 instead.
    scores.slice(1, 6).forEach((entry, i) => {
        const rank = i + 2;
        const li = document.createElement('li');

        const infoWrap = document.createElement('span');
        infoWrap.className = 'score-info';

        const badge = createRankBadge(rank);
        if (badge) infoWrap.appendChild(badge);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'score-name';
        nameSpan.textContent = entry.name;
        infoWrap.appendChild(nameSpan);

        const dateText = formatScoreDate(entry.created_at);
        if (dateText) {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'score-date';
            dateSpan.textContent = dateText;
            infoWrap.appendChild(dateSpan);
        }

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score-value';
        scoreSpan.textContent = mode === 'levels' ? `Lv.${entry.level} · ${entry.score}` : entry.score;

        li.appendChild(infoWrap);
        li.appendChild(scoreSpan);
        listElement.appendChild(li);
    });
}

function bannerElFor(listElement) {
    if (listElement === dom.highScoreList) return document.getElementById('homeTopPlayerBanner');
    if (listElement === dom.gameOverHighScoreList) return document.getElementById('gameOverTopPlayerBanner');
    if (listElement === dom.levelsHighScoreList) return document.getElementById('homeLevelsTopPlayerBanner');
    if (listElement === dom.levelsGameOverHighScoreList) return document.getElementById('gameOverLevelsTopPlayerBanner');
    return null;
}

function modeFor(listElement) {
    if (listElement === dom.levelsHighScoreList || listElement === dom.levelsGameOverHighScoreList) return 'levels';
    return 'classic';
}

export function renderScoreboard(listElement, scores, modeOverride) {
    const mode = modeOverride || modeFor(listElement);
    renderHighScores(listElement, scores, mode);
    const banner = bannerElFor(listElement);
    if (banner) animateTopPlayerBanner(banner, scores && scores[0], mode);
}

function cacheFor(mode) {
    return mode === 'levels' ? state.cachedLevelsScoresByPeriod : state.cachedScoresByPeriod;
}

function activePeriodFor(mode) {
    return mode === 'levels' ? state.activeLevelsPeriod : state.activePeriod;
}

function listElementsFor(mode) {
    return mode === 'levels'
        ? { home: dom.levelsHighScoreList, gameOver: dom.levelsGameOverHighScoreList, homeKey: 'levelsHighScoreList', gameOverKey: 'levelsGameOverHighScoreList' }
        : { home: dom.highScoreList, gameOver: dom.gameOverHighScoreList, homeKey: 'highScoreList', gameOverKey: 'gameOverHighScoreList' };
}

export async function fetchHighScores(period, mode) {
    mode = mode || 'classic';
    const cache = cacheFor(mode);
    // Skip the network attempt entirely while offline - there's no point
    // waiting on a fetch that's certain to fail, and this avoids an
    // unnecessary delay/console error on every scoreboard render while
    // offline. Falls straight through to rendering whatever's cached.
    if (isOnline()) {
        try {
            const res = await fetch(`/api/scores?period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}`);
            if (!res.ok) throw new Error('Bad response');
            const data = await res.json();
            cache[period] = data.scores || [];
            saveCachedHighScores(`${mode}_${period}`, cache[period]);
        } catch (err) {
            // Fall back to whatever we have cached locally for this period
        }
    }
    const active = activePeriodFor(mode);
    const els = listElementsFor(mode);
    if (active[els.homeKey] === period) renderScoreboard(els.home, cache[period], mode);
    if (active[els.gameOverKey] === period) renderScoreboard(els.gameOver, cache[period], mode);
}

// Re-fetches every leaderboard/period combination the moment connectivity
// is restored, so the scoreboard catches up with any scores submitted by
// other players while this device was offline, without requiring the
// player to manually switch tabs or restart the game.
function refetchAllOnReconnect() {
    fetchHighScores('alltime', 'classic');
    fetchHighScores('weekly', 'classic');
    fetchHighScores('alltime', 'levels');
    fetchHighScores('weekly', 'levels');
}

export function refreshAfterSubmit(newScores, mode) {
    mode = mode || 'classic';
    const cache = cacheFor(mode);
    // A successful submission always changes the all-time leaderboard, and may also
    // affect the weekly one - refresh both from the server to stay accurate.
    cache.alltime = newScores || cache.alltime;
    saveCachedHighScores(`${mode}_alltime`, cache.alltime);
    const active = activePeriodFor(mode);
    const els = listElementsFor(mode);
    if (active[els.homeKey] === 'alltime') renderScoreboard(els.home, cache.alltime, mode);
    if (active[els.gameOverKey] === 'alltime') renderScoreboard(els.gameOver, cache.alltime, mode);
    fetchHighScores('weekly', mode);
}

// Inserts a sliding-pill indicator element into a tab container (if not
// already present) and positions it under whichever button currently has
// the `.active` class. Called both on init and after every tab switch so
// the pill smoothly glides to the newly active button via CSS transitions.
function ensureSlider(tabsEl) {
    let slider = tabsEl.querySelector('.tab-slider');
    if (!slider) {
        slider = document.createElement('div');
        slider.className = 'tab-slider';
        tabsEl.insertBefore(slider, tabsEl.firstChild);
    }
    return slider;
}

function positionSlider(tabsEl, activeBtn) {
    if (!activeBtn) return;
    const slider = ensureSlider(tabsEl);
    // Use offsetLeft/offsetWidth (relative to the tabs container's padding
    // box) so the pill lines up exactly under the button regardless of
    // container width/number of tabs.
    slider.style.left = `${activeBtn.offsetLeft}px`;
    slider.style.width = `${activeBtn.offsetWidth}px`;
}

// Re-measures and repositions every scoreboard tab-slider pill that's
// currently visible (offsetLeft/offsetWidth are only meaningful once an
// element is actually laid out - a slider positioned while its container
// was display:none collapses to 0 width/left, making the active tab look
// unselected). Called whenever a previously-hidden screen containing
// scoreboard tabs becomes visible, e.g. showing the Game Over screen.
export function realignVisibleSliders() {
    document.querySelectorAll('.scoreboard-tabs, .mode-tabs').forEach(tabsEl => {
        if (tabsEl.offsetParent === null) return; // still hidden - skip for now
        const activeBtn = tabsEl.querySelector('.tab-btn.active, .mode-tab-btn.active');
        positionSlider(tabsEl, activeBtn);
    });
}

export function initLeaderboardTabs() {
    document.querySelectorAll('.scoreboard-tabs').forEach(tabsEl => {
        const targetId = tabsEl.getAttribute('data-target');
        const mode = tabsEl.getAttribute('data-mode') || 'classic';
        const listElement = document.getElementById(targetId);
        const buttons = tabsEl.querySelectorAll('.tab-btn');

        // Position the pill under the initially-active tab once the layout
        // has been painted (offsetLeft/Width need real layout dimensions).
        requestAnimationFrame(() => positionSlider(tabsEl, tabsEl.querySelector('.tab-btn.active')));

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.getAttribute('data-period');
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                positionSlider(tabsEl, btn);
                activePeriodFor(mode)[targetId] = period;
                renderScoreboard(listElement, cacheFor(mode)[period], mode);
                fetchHighScores(period, mode);
            });
        });
    });

    // Re-align all sliders on resize, since button widths/offsets change
    // with the container's responsive width.
    window.addEventListener('resize', () => {
        document.querySelectorAll('.scoreboard-tabs, .mode-tabs').forEach(tabsEl => {
            const activeBtn = tabsEl.querySelector('.tab-btn.active, .mode-tab-btn.active');
            positionSlider(tabsEl, activeBtn);
        });
    });
}

// Toggle between the Classic/Levels mode panels (and their scoreboards) on the main menu.
// Nokia Mode is a Classic-only visual theme, so its toggle button is hidden
// whenever the Levels panel is selected (it has no effect in Levels Mode).
export function initModeTabs() {
    if (!dom.scoreboardModeTabs) return;
    const modeButtons = dom.scoreboardModeTabs.querySelectorAll('.mode-tab-btn');

    requestAnimationFrame(() => positionSlider(dom.scoreboardModeTabs, dom.scoreboardModeTabs.querySelector('.mode-tab-btn.active')));

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            positionSlider(dom.scoreboardModeTabs, btn);
            document.querySelectorAll('[data-mode-panel]').forEach(panel => {
                panel.style.display = panel.getAttribute('data-mode-panel') === mode ? 'block' : 'none';
            });
            // The newly-revealed panel's own scoreboard tabs (All Time/This Week)
            // may have had their slider positioned while still hidden (offsetLeft/
            // offsetWidth are 0 for display:none elements), leaving the pill
            // stuck at 0 width and looking "unselected". Re-measure it now that
            // the panel is visible.
            requestAnimationFrame(() => {
                document.querySelectorAll(`[data-mode-panel="${mode}"] .scoreboard-tabs`).forEach(tabsEl => {
                    positionSlider(tabsEl, tabsEl.querySelector('.tab-btn.active'));
                });
            });
            if (dom.nokiaModeButton) {
                dom.nokiaModeButton.style.display = mode === 'levels' ? 'none' : 'block';
            }
            // Apply the purple Levels theme to the whole page as soon as the
            // Levels panel is selected on the main menu, not just in-game.
            document.body.classList.toggle('levels-mode', mode === 'levels');
            // Nokia Mode is Classic-only: if it happens to be enabled, visually
            // suppress it while viewing/playing Levels Mode (its persisted
            // setting/state.nokiaMode is left untouched, so it resumes the
            // moment the player switches back to Classic).
            if (mode === 'levels') {
                document.body.classList.remove('nokia-mode');
            } else if (state.nokiaMode) {
                document.body.classList.add('nokia-mode');
            }
        });
    });
}

export function initLeaderboard() {
    renderScoreboard(dom.highScoreList, state.cachedScoresByPeriod.alltime, 'classic');
    renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod.alltime, 'classic');
    renderScoreboard(dom.levelsHighScoreList, state.cachedLevelsScoresByPeriod.alltime, 'levels');
    renderScoreboard(dom.levelsGameOverHighScoreList, state.cachedLevelsScoresByPeriod.alltime, 'levels');
    initLeaderboardTabs();
    initModeTabs();
    fetchHighScores('alltime', 'classic');
    fetchHighScores('weekly', 'classic');
    fetchHighScores('alltime', 'levels');
    fetchHighScores('weekly', 'levels');

    onConnectivityChange((online) => {
        if (online) refetchAllOnReconnect();
    });
}
