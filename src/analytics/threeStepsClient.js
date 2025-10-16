// Lightweight client for 3Steps helper APIs (best players & club stats).
// Keep the whole integration self-contained so it can be removed easily.

import {
    BEST_PLAYERS_URL,
    CLUBS_FULL_STATS_URL,
    MIN_COMPETITION_YEAR,
} from '../env.js';

const CACHE = new Map(); // key -> { at, data }
const TTL_MS = 60_000;
const STALE_MS = 10 * 60_000;
const UA = 'eurolive-bot/3steps (+https://github.com)';

function normalizeYear(seasoncode) {
    if (!seasoncode) return null;
    const match = String(seasoncode).trim().match(/(20\d{2})/);
    return match ? match[1] : null;
}

function seasonCacheKey(seasoncode) {
    if (!seasoncode) return '__current__';
    if (seasoncode instanceof Date) {
        return String(seasoncode.getUTCFullYear());
    }
    if (typeof seasoncode === 'number') return String(seasoncode);
    const norm = normalizeYear(seasoncode);
    return norm || '__current__';
}

function bestPlayersUrl(seasoncode) {
    if (!BEST_PLAYERS_URL) return null;
    try {
        const url = new URL(BEST_PLAYERS_URL);
        ['seasoncode', 'season', 'SeasonCode'].forEach((k) => url.searchParams.delete(k));

        let targetYear = null;
        if (seasoncode instanceof Date) targetYear = seasoncode.getUTCFullYear();
        else if (typeof seasoncode === 'number') targetYear = seasoncode;
        else targetYear = normalizeYear(seasoncode);

        if (!targetYear) {
            return url.toString();
        }

        const year = Math.max(MIN_COMPETITION_YEAR, Number(targetYear));
        url.searchParams.set('competitionId', `euroleague-${year}`);
        return url.toString();
    } catch {
        return BEST_PLAYERS_URL;
    }
}

function clubsFullStatsUrl(seasoncode) {
    if (!CLUBS_FULL_STATS_URL) return null;
    try {
        const url = new URL(CLUBS_FULL_STATS_URL);
        ['seasoncode', 'season', 'SeasonCode'].forEach((k) => url.searchParams.delete(k));

        const year = normalizeYear(seasoncode);
        if (year) {
            url.searchParams.set('competitionId', `euroleague-${year}`);
        }
        return url.toString();
    } catch {
        return CLUBS_FULL_STATS_URL;
    }
}

async function fetchJson(url, { timeoutMs = 10_000, attempts = 3 } = {}) {
    if (!url) throw new Error('3steps client: missing URL');

    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                headers: { accept: 'application/json', 'user-agent': UA },
                signal: ctrl.signal,
            });
            clearTimeout(timer);

            if (!res.ok) {
                if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                    throw new Error(`3steps fetch ${url} → HTTP ${res.status}`);
                }
                lastErr = new Error(`3steps fetch ${url} → HTTP ${res.status}`);
            } else {
                return await res.json();
            }
        } catch (err) {
            lastErr = err;
        } finally {
            clearTimeout(timer);
        }
        if (i < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, i)));
        }
    }
    throw lastErr ?? new Error('3steps fetch failed');
}

async function cachedFetch(key, loader) {
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.at < TTL_MS) {
        return hit.data;
    }
    try {
        const data = await loader();
        CACHE.set(key, { at: now, data });
        return data;
    } catch (err) {
        if (hit && now - hit.at < STALE_MS) {
            console.warn(`[3steps] using stale cache for ${key} (${err.message})`);
            return hit.data;
        }
        throw err;
    }
}

export async function fetchThreeStepsBestPlayers(seasoncode) {
    const url = bestPlayersUrl(seasoncode);
    const key = `bestPlayers:${seasonCacheKey(seasoncode)}`;
    return cachedFetch(key, () => fetchJson(url));
}

export async function fetchThreeStepsClubStats(seasoncode) {
    const url = clubsFullStatsUrl(seasoncode);
    const key = `clubStats:${seasonCacheKey(seasoncode)}`;
    return cachedFetch(key, () => fetchJson(url));
}
