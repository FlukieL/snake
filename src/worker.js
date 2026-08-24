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

async function getTopScores(db, period, mode) {
    if (mode === 'levels') {
        // Levels mode ranks by score first, with highest level reached as a
        // tiebreaker (e.g. two players tied on score are ranked by whoever
        // got further before running out of lives).
        const query = period === 'weekly'
            ? "SELECT name, score, level, created_at FROM scores WHERE mode = 'levels' AND created_at >= datetime('now', '-7 days') ORDER BY score DESC, level DESC, created_at ASC LIMIT ?1"
            : "SELECT name, score, level, created_at FROM scores WHERE mode = 'levels' ORDER BY score DESC, level DESC, created_at ASC LIMIT ?1";
        const { results } = await db.prepare(query).bind(TOP_N).all();
        return results || [];
    }
    const query = period === 'weekly'
        ? "SELECT name, score, created_at FROM scores WHERE mode = 'classic' AND created_at >= datetime('now', '-7 days') ORDER BY score DESC, created_at ASC LIMIT ?1"
        : "SELECT name, score, created_at FROM scores WHERE mode = 'classic' ORDER BY score DESC, created_at ASC LIMIT ?1";
    const { results } = await db.prepare(query).bind(TOP_N).all();
    return results || [];
}

async function handleGetScores(request, env) {
    try {
        const url = new URL(request.url);
        const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'alltime';
        const modeParam = url.searchParams.get('mode');
        const mode = VALID_MODES.includes(modeParam) ? modeParam : 'classic';
        const scores = await getTopScores(env.DB, period, mode);
        return jsonResponse({ scores, period, mode });
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
        await env.DB
            .prepare('INSERT INTO scores (name, score, mode, level) VALUES (?1, ?2, ?3, ?4)')
            .bind(name, score, mode, level)
            .run();

        const scores = await getTopScores(env.DB, 'alltime', mode);
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
