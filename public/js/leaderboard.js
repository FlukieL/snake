// Leaderboard rendering and data fetching: scoreboard lists, rank badges,
// the animated top-player banner, and tab switching between All Time/Weekly.

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { loadCachedHighScores, saveCachedHighScores } from './storage.js';

state.cachedScoresByPeriod = {
    alltime: loadCachedHighScores('alltime'),
    weekly: loadCachedHighScores('weekly')
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

function animateTopPlayerBanner(bannerEl, topEntry) {
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
    scoreSpan.textContent = topEntry.score;
    bannerEl.appendChild(scoreSpan);
}

function renderHighScores(listElement, scores) {
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
        scoreSpan.textContent = entry.score;

        li.appendChild(infoWrap);
        li.appendChild(scoreSpan);
        listElement.appendChild(li);
    });
}

function bannerElFor(listElement) {
    if (listElement === dom.highScoreList) return document.getElementById('homeTopPlayerBanner');
    if (listElement === dom.gameOverHighScoreList) return document.getElementById('gameOverTopPlayerBanner');
    return null;
}

export function renderScoreboard(listElement, scores) {
    renderHighScores(listElement, scores);
    const banner = bannerElFor(listElement);
    if (banner) animateTopPlayerBanner(banner, scores && scores[0]);
}

export async function fetchHighScores(period) {
    try {
        const res = await fetch('/api/scores?period=' + encodeURIComponent(period));
        if (!res.ok) throw new Error('Bad response');
        const data = await res.json();
        state.cachedScoresByPeriod[period] = data.scores || [];
        saveCachedHighScores(period, state.cachedScoresByPeriod[period]);
    } catch (err) {
        // Fall back to whatever we have cached locally for this period
    }
    if (state.activePeriod.highScoreList === period) {
        renderScoreboard(dom.highScoreList, state.cachedScoresByPeriod[period]);
    }
    if (state.activePeriod.gameOverHighScoreList === period) {
        renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod[period]);
    }
}

export function refreshAfterSubmit(newScores) {
    // A successful submission always changes the all-time leaderboard, and may also
    // affect the weekly one - refresh both from the server to stay accurate.
    state.cachedScoresByPeriod.alltime = newScores || state.cachedScoresByPeriod.alltime;
    saveCachedHighScores('alltime', state.cachedScoresByPeriod.alltime);
    if (state.activePeriod.highScoreList === 'alltime') {
        renderScoreboard(dom.highScoreList, state.cachedScoresByPeriod.alltime);
    }
    if (state.activePeriod.gameOverHighScoreList === 'alltime') {
        renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod.alltime);
    }
    fetchHighScores('weekly');
}

export function initLeaderboardTabs() {
    document.querySelectorAll('.scoreboard-tabs').forEach(tabsEl => {
        const targetId = tabsEl.getAttribute('data-target');
        const listElement = document.getElementById(targetId);
        tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const period = btn.getAttribute('data-period');
                tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.activePeriod[targetId] = period;
                renderScoreboard(listElement, state.cachedScoresByPeriod[period]);
                fetchHighScores(period);
            });
        });
    });
}

export function initLeaderboard() {
    renderScoreboard(dom.highScoreList, state.cachedScoresByPeriod.alltime);
    renderScoreboard(dom.gameOverHighScoreList, state.cachedScoresByPeriod.alltime);
    initLeaderboardTabs();
    fetchHighScores('alltime');
    fetchHighScores('weekly');
}
