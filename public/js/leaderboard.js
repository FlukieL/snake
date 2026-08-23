// Leaderboard rendering and data fetching: scoreboard lists, rank badges,
// the animated top-player banner, and tab switching between All Time/Weekly.
// Supports two independent leaderboards - "classic" (by score) and "levels"
// (by highest level reached, then score) - each with their own cache/tabs.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { loadCachedHighScores, saveCachedHighScores } from './storage.js';

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
    try {
        const res = await fetch(`/api/scores?period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}`);
        if (!res.ok) throw new Error('Bad response');
        const data = await res.json();
        cache[period] = data.scores || [];
        saveCachedHighScores(`${mode}_${period}`, cache[period]);
    } catch (err) {
        // Fall back to whatever we have cached locally for this period
    }
    const active = activePeriodFor(mode);
    const els = listElementsFor(mode);
    if (active[els.homeKey] === period) renderScoreboard(els.home, cache[period], mode);
    if (active[els.gameOverKey] === period) renderScoreboard(els.gameOver, cache[period], mode);
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

export function initLeaderboardTabs() {
    document.querySelectorAll('.scoreboard-tabs').forEach(tabsEl => {
        const targetId = tabsEl.getAttribute('data-target');
        const mode = tabsEl.getAttribute('data-mode') || 'classic';
        const listElement = document.getElementById(targetId);
        tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.getAttribute('data-period');
                tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activePeriodFor(mode)[targetId] = period;
                renderScoreboard(listElement, cacheFor(mode)[period], mode);
                fetchHighScores(period, mode);
            });
        });
    });
}

// Toggle between the Classic/Levels mode panels (and their scoreboards) on the main menu.
export function initModeTabs() {
    if (!dom.scoreboardModeTabs) return;
    dom.scoreboardModeTabs.querySelectorAll('.mode-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            dom.scoreboardModeTabs.querySelectorAll('.mode-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('[data-mode-panel]').forEach(panel => {
                panel.style.display = panel.getAttribute('data-mode-panel') === mode ? 'block' : 'none';
            });
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
}
