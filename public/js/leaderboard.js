// Leaderboard rendering, period/mode tabs, and three-page navigation.
// Each server page contains six distinct Google accounts (or legacy names).

import { dom } from './dom.js';
import { state, constants } from './state.js';
import { loadCachedHighScores, saveCachedHighScores } from './storage.js';
import { isOnline, onConnectivityChange } from './offline.js';

const SCORES_PER_PAGE = 6;
const PAGE_COUNT = 3;

function normalizeCachedPages(value) {
    if (Array.isArray(value)) return { 1: value };
    return value && typeof value === 'object' ? value : { 1: [] };
}

state.cachedScoresByPeriod = {
    alltime: normalizeCachedPages(loadCachedHighScores('classic_alltime')),
    weekly: normalizeCachedPages(loadCachedHighScores('classic_weekly'))
};
state.cachedLevelsScoresByPeriod = {
    alltime: normalizeCachedPages(loadCachedHighScores('levels_alltime')),
    weekly: normalizeCachedPages(loadCachedHighScores('levels_weekly'))
};

function formatScoreDate(isoLikeString) {
    if (!isoLikeString) return '';
    const normalized = isoLikeString.includes('T') ? isoLikeString : isoLikeString.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    const datePart = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
}

function createRankBadge(rank) {
    const medal = constants.RANK_MEDALS[rank];
    if (!medal) return null;
    const badge = document.createElement('span');
    badge.className = `rank-badge rank-${medal}`;
    badge.textContent = rank;
    return badge;
}

function animateTopPlayerBanner(bannerEl, topEntry, mode) {
    if (!bannerEl) return;
    bannerEl.innerHTML = '';
    if (!topEntry) {
        bannerEl.style.display = 'none';
        return;
    }
    bannerEl.style.display = 'flex';

    const trophy = document.createElement('span');
    trophy.className = 'banner-trophy';
    trophy.textContent = '🏆';
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

function renderHighScores(listElement, scores, mode, page) {
    listElement.innerHTML = '';
    if (!scores || scores.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No scores yet';
        listElement.appendChild(li);
        return;
    }

    // Page one's first score is already presented prominently in the trophy
    // banner. Exclude it from the regular list so the same player/score is
    // not rendered twice, while preserving its real leaderboard rank.
    const listOffset = page === 1 ? 1 : 0;
    scores.slice(listOffset).forEach((entry, i) => {
        const rank = (page - 1) * SCORES_PER_PAGE + listOffset + i + 1;
        const li = document.createElement('li');
        li.className = 'score-entry';
        li.tabIndex = 0;
        li.setAttribute('aria-label', `${entry.name}, rank ${rank}, ${mode === 'levels' ? `level ${entry.level}, score ${entry.score}` : `score ${entry.score}`}`);

        const rankLabel = document.createElement('span');
        rankLabel.className = 'score-rank';
        rankLabel.textContent = rank;
        li.appendChild(rankLabel);

        const badge = createRankBadge(rank);
        if (badge) li.appendChild(badge);

        const infoWrap = document.createElement('span');
        infoWrap.className = 'score-info';
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
        li.append(infoWrap, scoreSpan);
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
    return listElement === dom.levelsHighScoreList || listElement === dom.levelsGameOverHighScoreList ? 'levels' : 'classic';
}

function cacheFor(mode) {
    return mode === 'levels' ? state.cachedLevelsScoresByPeriod : state.cachedScoresByPeriod;
}

function activePeriodFor(mode) {
    return mode === 'levels' ? state.activeLevelsPeriod : state.activePeriod;
}

function activePageFor(mode) {
    return mode === 'levels' ? state.activeLevelsLeaderboardPage : state.activeLeaderboardPage;
}

function listElementsFor(mode) {
    return mode === 'levels'
        ? { home: dom.levelsHighScoreList, gameOver: dom.levelsGameOverHighScoreList, homeKey: 'levelsHighScoreList', gameOverKey: 'levelsGameOverHighScoreList' }
        : { home: dom.highScoreList, gameOver: dom.gameOverHighScoreList, homeKey: 'highScoreList', gameOverKey: 'gameOverHighScoreList' };
}

function pagerFor(listElement) {
    return document.querySelector(`[data-leaderboard-pager-for="${listElement.id}"]`);
}

function updatePager(listElement, page, totalPages) {
    const pager = pagerFor(listElement);
    if (!pager) return;
    pager.hidden = totalPages < 2;
    pager.querySelector('.leaderboard-page-status').textContent = `Page ${page} of ${totalPages}`;
    pager.querySelectorAll('[data-leaderboard-page]').forEach(button => {
        const targetPage = Number(button.getAttribute('data-leaderboard-page'));
        button.classList.toggle('active', targetPage === page);
        button.disabled = targetPage > totalPages;
        button.setAttribute('aria-current', targetPage === page ? 'page' : 'false');
    });
}

export function renderScoreboard(listElement, scores, modeOverride, pageOverride) {
    const mode = modeOverride || modeFor(listElement);
    const page = pageOverride || activePageFor(mode)[listElement.id] || 1;
    renderHighScores(listElement, scores || [], mode, page);

    const banner = bannerElFor(listElement);
    if (banner) {
        if (page === 1) animateTopPlayerBanner(banner, scores && scores[0], mode);
        else banner.style.display = 'none';
    }

    const period = activePeriodFor(mode)[listElement.id] || 'alltime';
    updatePager(listElement, page, state.leaderboardTotalPages[mode][period] || 1);
}

function renderActiveList(listElement, mode) {
    const period = activePeriodFor(mode)[listElement.id];
    const page = activePageFor(mode)[listElement.id] || 1;
    renderScoreboard(listElement, cacheFor(mode)[period][page] || [], mode, page);
}

export async function fetchHighScores(period, mode, page = 1) {
    mode = mode || 'classic';
    const cache = cacheFor(mode);
    if (!cache[period]) cache[period] = {};

    if (isOnline()) {
        try {
            const res = await fetch(`/api/scores?period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}&page=${page}`);
            if (!res.ok) throw new Error('Bad response');
            const data = await res.json();
            cache[period][page] = data.scores || [];
            state.leaderboardTotalPages[mode][period] = Math.max(1, Math.min(PAGE_COUNT, Number(data.totalPages) || 1));
            saveCachedHighScores(`${mode}_${period}`, cache[period]);
        } catch (err) {
            // Use the latest locally cached page while offline or on failure.
        }
    }

    const active = activePeriodFor(mode);
    const pages = activePageFor(mode);
    const els = listElementsFor(mode);
    if (active[els.homeKey] === period && pages[els.homeKey] === page) renderActiveList(els.home, mode);
    if (active[els.gameOverKey] === period && pages[els.gameOverKey] === page) renderActiveList(els.gameOver, mode);
}

function refetchAllOnReconnect() {
    ['classic', 'levels'].forEach(mode => {
        ['alltime', 'weekly'].forEach(period => {
            for (let page = 1; page <= PAGE_COUNT; page++) fetchHighScores(period, mode, page);
        });
    });
}

export function refreshAfterSubmit(newScores, mode = 'classic') {
    const cache = cacheFor(mode);
    cache.alltime[1] = newScores || cache.alltime[1] || [];
    saveCachedHighScores(`${mode}_alltime`, cache.alltime);
    const els = listElementsFor(mode);
    renderActiveList(els.home, mode);
    renderActiveList(els.gameOver, mode);
    fetchHighScores('alltime', mode, 1);
    fetchHighScores('weekly', mode, 1);
}

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
    slider.style.left = `${activeBtn.offsetLeft}px`;
    slider.style.width = `${activeBtn.offsetWidth}px`;
}

export function realignVisibleSliders() {
    document.querySelectorAll('.scoreboard-tabs, .mode-tabs').forEach(tabsEl => {
        if (tabsEl.offsetParent === null) return;
        positionSlider(tabsEl, tabsEl.querySelector('.tab-btn.active, .mode-tab-btn.active'));
    });
}

let sliderRealignmentQueued = false;
export function scheduleSliderRealignment() {
    if (sliderRealignmentQueued) return;
    sliderRealignmentQueued = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        sliderRealignmentQueued = false;
        realignVisibleSliders();
    }));
}

function initScoreEntryInteractions() {
    document.addEventListener('pointerdown', event => {
        const entry = event.target.closest('.scoreboard li.score-entry');
        if (entry) entry.classList.add('score-entry-active');
    });
    ['pointerup', 'pointercancel'].forEach(type => window.addEventListener(type, () => {
        document.querySelectorAll('.score-entry-active').forEach(entry => entry.classList.remove('score-entry-active'));
    }));
}

function initPagination() {
    document.querySelectorAll('[data-leaderboard-pager-for]').forEach(pager => {
        const listElement = document.getElementById(pager.getAttribute('data-leaderboard-pager-for'));
        if (!listElement) return;
        const mode = modeFor(listElement);
        pager.addEventListener('click', event => {
            const button = event.target.closest('[data-leaderboard-page]');
            if (!button || button.disabled) return;
            const page = Number(button.getAttribute('data-leaderboard-page'));
            const period = activePeriodFor(mode)[listElement.id];
            activePageFor(mode)[listElement.id] = page;
            renderActiveList(listElement, mode);
            fetchHighScores(period, mode, page);
        });
    });
}

export function initLeaderboardTabs() {
    document.querySelectorAll('.scoreboard-tabs').forEach(tabsEl => {
        const targetId = tabsEl.getAttribute('data-target');
        const mode = tabsEl.getAttribute('data-mode') || 'classic';
        const listElement = document.getElementById(targetId);
        const buttons = tabsEl.querySelectorAll('.tab-btn');
        requestAnimationFrame(() => positionSlider(tabsEl, tabsEl.querySelector('.tab-btn.active')));

        buttons.forEach(btn => btn.addEventListener('click', () => {
            const period = btn.getAttribute('data-period');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            positionSlider(tabsEl, btn);
            activePeriodFor(mode)[targetId] = period;
            activePageFor(mode)[targetId] = 1;
            renderActiveList(listElement, mode);
            fetchHighScores(period, mode, 1);
        }));
    });

    window.addEventListener('resize', realignVisibleSliders);
}

export function initModeTabs() {
    if (!dom.scoreboardModeTabs) return;
    const modeButtons = dom.scoreboardModeTabs.querySelectorAll('.mode-tab-btn');
    requestAnimationFrame(() => positionSlider(dom.scoreboardModeTabs, dom.scoreboardModeTabs.querySelector('.mode-tab-btn.active')));

    modeButtons.forEach(btn => btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        positionSlider(dom.scoreboardModeTabs, btn);
        document.querySelectorAll('[data-mode-panel]').forEach(panel => {
            panel.style.display = panel.getAttribute('data-mode-panel') === mode ? 'block' : 'none';
        });
        requestAnimationFrame(() => {
            document.querySelectorAll(`[data-mode-panel="${mode}"] .scoreboard-tabs`).forEach(tabsEl => {
                positionSlider(tabsEl, tabsEl.querySelector('.tab-btn.active'));
            });
        });
        if (dom.nokiaModeButton) dom.nokiaModeButton.style.display = mode === 'levels' ? 'none' : 'block';
        document.body.classList.toggle('levels-mode', mode === 'levels');
        if (mode === 'levels') document.body.classList.remove('nokia-mode');
        else if (state.nokiaMode) document.body.classList.add('nokia-mode');
    }));
}

export function initLeaderboard() {
    [dom.highScoreList, dom.gameOverHighScoreList, dom.levelsHighScoreList, dom.levelsGameOverHighScoreList].forEach(list => {
        renderActiveList(list, modeFor(list));
    });
    initScoreEntryInteractions();
    initLeaderboardTabs();
    initPagination();
    initModeTabs();
    refetchAllOnReconnect();
    onConnectivityChange(online => {
        if (online) refetchAllOnReconnect();
    });
}
