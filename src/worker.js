/**
 * Snake Game Worker
 * - Serves static assets (HTML/CSS/JS/media) via the ASSETS binding
 * - Provides a small JSON API backed by Cloudflare D1 for the global leaderboard
 *
 * Endpoints:
 *   GET  /api/scores        -> returns top 10 scores as JSON
 *   POST /api/scores        -> submits a new score { name, score }
 */

const MAX_NAME_LENGTH = 16;
const MAX_SCORE = 100000; // sanity cap to reject bogus submissions
const TOP_N = 10;

// Extensive profanity/slur blocklist (lowercase, no separators).
// Matching is done against a normalized version of the submitted name that:
//  - lowercases everything
//  - maps common leetspeak substitutions back to letters (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s)
//  - strips all non-alphanumeric characters (spaces, punctuation, repeated chars collapsed)
// This catches most obfuscation attempts (e.g. "a55hole", "f_u_c_k", "sh1t").
const PROFANITY_LIST = [
    'anal','anus','arse','ass','asshole','bastard','bitch','bollock','boob',
    'bugger','bullshit','chink','clit','cock','coon','cracker','crap','cum',
    'cunt','dago','damn','dick','dildo','dyke','fag','faggot','feck','fuck',
    'fucker','fucking','gook','handjob','hell','hoe','homo','honkey','jerk',
    'jizz','kike','kraut','kys','lesbo','loli','masturbate','milf','nazi',
    'negro','nigga','nigger','orgasm','paki','penis','piss','poon','porn',
    'prick','pube','pussy','queer','rape','rapist','retard','sadist','semen',
    'sex','shit','slave','slut','spic','spook','suicide','tard','testicle',
    'thot','tit','twat','vagina','wank','wetback','whore','wop'
];

function normalizeForFilter(str) {
    const leetMap = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
    let normalized = str.toLowerCase();
    normalized = normalized.split('').map(ch => leetMap[ch] !== undefined ? leetMap[ch] : ch).join('');
    // Remove everything that isn't a-z or 0-9 (already substituted), collapsing separators used to dodge filters
    normalized = normalized.replace(/[^a-z0-9]/g, '');
    return normalized;
}

function containsProfanity(name) {
    const normalized = normalizeForFilter(name);
    return PROFANITY_LIST.some(word => normalized.includes(word));
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        }
    });
}

// Returns the cleaned name, or null if the name is blank/invalid after cleaning.
function sanitizeName(rawName) {
    let name = (rawName || '').toString().trim();
    // Strip control characters and collapse whitespace
    name = name.replace(/[\u0000-\u001F\u007F]/g, '');
    name = name.replace(/\s+/g, ' ').trim();
    if (name.length > MAX_NAME_LENGTH) {
        name = name.slice(0, MAX_NAME_LENGTH).trim();
    }
    if (!name) return null;
    return name;
}

async function getTopScores(db) {
    const { results } = await db
        .prepare('SELECT name, score, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?1')
        .bind(TOP_N)
        .all();
    return results || [];
}

async function handleGetScores(env) {
    try {
        const scores = await getTopScores(env.DB);
        return jsonResponse({ scores });
    } catch (err) {
        return jsonResponse({ error: 'Failed to load scores' }, 500);
    }
}

async function handlePostScore(request, env) {
    let body;
    try {
        body = await request.json();
    } catch (err) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const score = Number(body && body.score);
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE || !Number.isInteger(score)) {
        return jsonResponse({ error: 'Invalid score' }, 400);
    }

    const name = sanitizeName(body && body.name);
    if (!name) {
        return jsonResponse({ error: 'Name is required' }, 400);
    }
    if (containsProfanity(name)) {
        return jsonResponse({ error: 'Name contains inappropriate language' }, 400);
    }

    try {
        await env.DB
            .prepare('INSERT INTO scores (name, score) VALUES (?1, ?2)')
            .bind(name, score)
            .run();

        const scores = await getTopScores(env.DB);
        return jsonResponse({ scores }, 201);
    } catch (err) {
        return jsonResponse({ error: 'Failed to save score' }, 500);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/api/scores') {
            if (request.method === 'GET') {
                return handleGetScores(env);
            }
            if (request.method === 'POST') {
                return handlePostScore(request, env);
            }
            if (request.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type'
                    }
                });
            }
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        // Fall back to static assets for everything else
        return env.ASSETS.fetch(request);
    }
};
