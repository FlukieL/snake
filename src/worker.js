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
const SCORES_PER_PAGE = 6;
const LEADERBOARD_PAGE_COUNT = 3;
const MAX_LEADERBOARD_SCORES = SCORES_PER_PAGE * LEADERBOARD_PAGE_COUNT;
const GOOGLE_CLIENT_ID = '600684655874-jfqakqf9snp67eikljkfsl3qmbtopin5.apps.googleusercontent.com';
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

function base64UrlToUint8Array(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice((base64.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function base64UrlDecodeJSON(base64Url) {
    const bytes = base64UrlToUint8Array(base64Url);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
}

let cachedCerts = null;
let cachedCertsExpiry = 0;

async function getGoogleCerts() {
    const now = Date.now();
    if (cachedCerts && now < cachedCertsExpiry) return cachedCerts;
    const res = await fetch(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error('Failed to fetch Google certs');
    const data = await res.json();
    cachedCerts = data.keys;
    cachedCertsExpiry = now + 60 * 60 * 1000; // cache for 1 hour
    return cachedCerts;
}

// Verifies a Google Sign-In ID token: checks RS256 signature against Google's public keys,
// and validates issuer, audience, and expiry. Returns the decoded payload on success.
async function verifyGoogleIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
        throw new Error('Malformed token');
    }
    const [headerB64, payloadB64, signatureB64] = idToken.split('.');
    const header = base64UrlDecodeJSON(headerB64);
    const payload = base64UrlDecodeJSON(payloadB64);

    if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired');
    if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error('Invalid audience');
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new Error('Invalid issuer');
    }

    const certs = await getGoogleCerts();
    const jwk = certs.find(k => k.kid === header.kid);
    if (!jwk) throw new Error('Unknown signing key');

    const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) throw new Error('Invalid signature');

    return payload;
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

const VALID_MODES = ['classic', 'levels'];

// Table name comes from a trusted environment variable (SCORES_TABLE, set in
// wrangler.toml per-environment), never from user input, so it's safe to
// interpolate directly into the SQL (D1/SQLite cannot bind identifiers).
function getScoresTable(env) {
    const table = env && env.SCORES_TABLE;
    return table === 'scores_dev' ? 'scores_dev' : 'scores';
}

async function ensureUserIdColumn(db, table) {
    // Existing D1 databases were created before user_id existed. SQLite has
    // no ADD COLUMN IF NOT EXISTS, so attempt the additive migration and
    // ignore its harmless duplicate-column result on subsequent requests.
    try {
        await db.prepare(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`).run();
    } catch (err) {
        // The column already exists, or the table was created from the new schema.
    }
    try {
        await db.prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_user_mode_score ON ${table} (user_id, mode, score DESC)`).run();
    } catch (err) {
        // The query remains correct even if an index cannot be created.
    }
}

function scoreOrderFor(mode) {
    return mode === 'levels'
        ? 'score DESC, level DESC, created_at ASC, id ASC'
        : 'score DESC, created_at ASC, id ASC';
}

async function getTopScores(db, period, mode, table, page) {
    const modeFilter = mode === 'levels' ? 'levels' : 'classic';
    const periodFilter = period === 'weekly' ? " AND created_at >= datetime('now', '-7 days')" : '';
    const order = scoreOrderFor(mode);
    const offset = (page - 1) * SCORES_PER_PAGE;
    // user_id is Google OpenID Connect's immutable `sub` claim. Legacy rows
    // have no ID, so group those by their displayed name as a best-effort
    // fallback while all new submissions use the verified account identity.
    const ranked = `
        WITH ranked_scores AS (
            SELECT name, score, level, created_at, id,
                ROW_NUMBER() OVER (
                    PARTITION BY COALESCE(NULLIF(user_id, ''), 'legacy:' || name)
                    ORDER BY ${order}
                ) AS user_rank
            FROM ${table}
            WHERE mode = ?1${periodFilter}
        )
    `;
    const scoresQuery = `${ranked}
        SELECT name, score, level, created_at
        FROM ranked_scores
        WHERE user_rank = 1
        ORDER BY ${order}
        LIMIT ?2 OFFSET ?3`;
    const countQuery = `${ranked}
        SELECT COUNT(*) AS total FROM ranked_scores WHERE user_rank = 1`;

    const [{ results }, count] = await Promise.all([
        db.prepare(scoresQuery).bind(modeFilter, SCORES_PER_PAGE, offset).all(),
        db.prepare(countQuery).bind(modeFilter).first('total')
    ]);
    return { scores: results || [], total: Number(count) || 0 };
}

async function handleGetScores(request, env) {
    try {
        const url = new URL(request.url);
        const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'alltime';
        const modeParam = url.searchParams.get('mode');
        const mode = VALID_MODES.includes(modeParam) ? modeParam : 'classic';
        const requestedPage = Number(url.searchParams.get('page'));
        const page = Number.isInteger(requestedPage)
            ? Math.max(1, Math.min(LEADERBOARD_PAGE_COUNT, requestedPage))
            : 1;
        const table = getScoresTable(env);
        await ensureUserIdColumn(env.DB, table);
        const { scores, total } = await getTopScores(env.DB, period, mode, table, page);
        return jsonResponse({
            scores,
            period,
            mode,
            page,
            // Always expose all three requested pages. Pages without enough
            // distinct players return an empty score list and render the
            // usual "No scores yet" state on the client.
            totalPages: LEADERBOARD_PAGE_COUNT,
            total: Math.min(total, MAX_LEADERBOARD_SCORES)
        });
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

    const mode = VALID_MODES.includes(body && body.mode) ? body.mode : 'classic';

    const rawLevel = Number(body && body.level);
    const level = mode === 'levels' && Number.isFinite(rawLevel) && rawLevel >= 0 && Number.isInteger(rawLevel)
        ? rawLevel
        : 0;

    // Require a verified Google Sign-In ID token; the player's name is taken from the
    // verified token payload, not from client-supplied text, to prevent impersonation/fake names.
    const idToken = body && body.idToken;
    if (!idToken) {
        return jsonResponse({ error: 'Google sign-in required' }, 401);
    }

    let googlePayload;
    try {
        googlePayload = await verifyGoogleIdToken(idToken);
    } catch (err) {
        return jsonResponse({ error: 'Invalid Google sign-in token' }, 401);
    }

    const name = sanitizeName(googlePayload.name || googlePayload.given_name);
    if (!name) {
        return jsonResponse({ error: 'Name is required' }, 400);
    }

    try {
        const table = getScoresTable(env);
        await ensureUserIdColumn(env.DB, table);
        await env.DB
            .prepare(`INSERT INTO ${table} (name, user_id, score, mode, level) VALUES (?1, ?2, ?3, ?4, ?5)`)
            .bind(name, googlePayload.sub, score, mode, level)
            .run();

        const { scores } = await getTopScores(env.DB, 'alltime', mode, table, 1);
        return jsonResponse({ scores, mode }, 201);
    } catch (err) {
        return jsonResponse({ error: 'Failed to save score' }, 500);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/api/scores') {
            if (request.method === 'GET') {
                return handleGetScores(request, env);
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
