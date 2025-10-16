// src/api/v3.js
import {
    EUROLEAGUE_API_V3,
    EUROLEAGUE_COMPETITION_CODE,
    EUROLEAGUE_SEASON_CODE,
} from '../env.js';

const cache = new Map();
const DEFAULT_TTL_MS = 120_000;

/** Cache helpers */
function fromCache(url) {
    const hit = cache.get(url);
    if (!hit) return null;
    if (Date.now() > hit.expires) {
        cache.delete(url);
        return null;
    }
    return hit.data;
}
function toCache(url, data, ttl = DEFAULT_TTL_MS) {
    cache.set(url, { data, expires: Date.now() + ttl });
}

/** Fetch JSON with timeout, retries, and simple caching */
async function fetchJson(
    url,
    {
        method = 'GET',
        headers = { accept: 'application/json' },
        cacheTtlMs = DEFAULT_TTL_MS,
        timeoutMs = 12_000,
        retries = 1,
    } = {}
) {
    if (method === 'GET' && cacheTtlMs > 0) {
        const cached = fromCache(url);
        if (cached) return cached;
    }

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method, headers, signal: ctrl.signal });
            clearTimeout(timer);

            if (!res.ok) {
                if (res.status >= 500 && attempt < retries) continue;
                const text = await res.text().catch(() => '');
                throw new Error(
                    `${url} → HTTP ${res.status} ${res.statusText}${
                        text ? ` | ${text.slice(0, 220)}` : ''
                    }`
                );
            }

            const ctype = res.headers.get('content-type') || '';
            const body = ctype.includes('application/json') ? await res.json() : await res.text();

            if (method === 'GET' && cacheTtlMs > 0) toCache(url, body, cacheTtlMs);
            return body;
        } catch (err) {
            clearTimeout(timer);
            lastErr = err;
            if (attempt >= retries) break;
        }
    }
    throw lastErr ?? new Error(`Failed to fetch ${url}`);
}

/** Extract an array from common API container shapes */
function extractArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.players)) return payload.players;
    if (Array.isArray(payload?.result?.items)) return payload.result.items;
    if (Array.isArray(payload?.statistics?.items)) return payload.statistics.items;
    if (Array.isArray(payload?.statistics?.players)) return payload.statistics.players;
    return [];
}

/** Game box score / stats */
export async function getGameStats({
                                       competitionCode = EUROLEAGUE_COMPETITION_CODE,
                                       seasonCode = EUROLEAGUE_SEASON_CODE,
                                       gameCode,
                                       cacheTtlMs = DEFAULT_TTL_MS,
                                   } = {}) {
    if (!competitionCode) throw new Error('competitionCode is required');
    if (!seasonCode) throw new Error('seasonCode is required');
    if (gameCode == null) throw new Error('gameCode is required');

    const url =
        `${EUROLEAGUE_API_V3}/competitions/${encodeURIComponent(competitionCode)}` +
        `/seasons/${encodeURIComponent(seasonCode)}` +
        `/games/${encodeURIComponent(gameCode)}/stats`;

    return fetchJson(url, { cacheTtlMs });
}

/**
 * Season players (per-game/Single). Probes multiple URL shapes across clusters.
 * Returns an array of player rows (already filtered by query on the server).
 */
export async function getSeasonTraditionalPlayers({
                                                      competitionCode = EUROLEAGUE_COMPETITION_CODE,
                                                      seasonCode = EUROLEAGUE_SEASON_CODE,
                                                      viewType = 'traditional',
                                                      statisticMode = 'perGame',
                                                      seasonMode = 'Single',
                                                      orderBy = 'pir',
                                                      sortDirection = 'descending',
                                                      size = 1000,
                                                      cacheTtlMs = DEFAULT_TTL_MS,
                                                  } = {}) {
    if (!competitionCode) throw new Error('competitionCode is required');
    if (!seasonCode) throw new Error('seasonCode is required');

    const base = `${EUROLEAGUE_API_V3}/competitions/${encodeURIComponent(competitionCode)}`;
    const qp = new URLSearchParams({
        viewType,
        statisticMode,
        seasonMode,
        orderBy,
        sortDirection,
        size: String(size),
    });

    const candidates = [
        // season in path
        `${base}/seasons/${encodeURIComponent(seasonCode)}/stats/players/traditional?${qp}`,
        `${base}/seasons/${encodeURIComponent(seasonCode)}/statistics/players/traditional?${qp}`,
        // season as query (camelCase)
        `${base}/stats/players/traditional?seasonCode=${encodeURIComponent(seasonCode)}&${qp}`,
        `${base}/statistics/players/traditional?seasonCode=${encodeURIComponent(seasonCode)}&${qp}`,
        // season as query (lowercase)
        `${base}/stats/players/traditional?seasoncode=${encodeURIComponent(seasonCode)}&${qp}`,
        `${base}/statistics/players/traditional?seasoncode=${encodeURIComponent(seasonCode)}&${qp}`,
    ];

    for (const url of candidates) {
        try {
            const data = await fetchJson(url, { cacheTtlMs });
            const arr = extractArray(data);
            if (arr.length) return arr;
        } catch {
            // try next candidate
        }
    }

    return [];
}

export async function getTeamsTraditionalStats({
                                                   competitionCode = EUROLEAGUE_COMPETITION_CODE,
                                                   seasonCode = EUROLEAGUE_SEASON_CODE,
                                                   seasonMode = 'Single',
                                                   statisticMode = 'PerGame',
                                                   phaseTypeCode = 'RS',
                                                   sortDirection = 'descending',
                                                   size = 50,
                                                   offset = 0,
                                                   cacheTtlMs = DEFAULT_TTL_MS,
                                               } = {}) {
    if (!competitionCode) throw new Error('competitionCode is required');
    if (!seasonCode) throw new Error('seasonCode is required');

    const base = `${EUROLEAGUE_API_V3}/competitions/${encodeURIComponent(competitionCode)}`;
    const qp = new URLSearchParams({
        SeasonMode: seasonMode,
        SeasonCode: seasonCode,
        statisticMode,
        phaseTypeCode,
        sortDirection,
        size: String(size),
        offset: String(offset),
    });

    const url = `${base}/statistics/teams/traditional?${qp}`;
    return fetchJson(url, { cacheTtlMs });
}

export async function getTeamsOpponentsTraditionalStats({
                                                            competitionCode = EUROLEAGUE_COMPETITION_CODE,
                                                            seasonCode = EUROLEAGUE_SEASON_CODE,
                                                            seasonMode = 'Single',
                                                            statisticMode = 'PerGame',
                                                            phaseTypeCode = 'RS',
                                                            sortDirection = 'descending',
                                                            size = 50,
                                                            offset = 0,
                                                            cacheTtlMs = DEFAULT_TTL_MS,
                                                        } = {}) {
    if (!competitionCode) throw new Error('competitionCode is required');
    if (!seasonCode) throw new Error('seasonCode is required');

    const base = `${EUROLEAGUE_API_V3}/competitions/${encodeURIComponent(competitionCode)}`;
    const qp = new URLSearchParams({
        SeasonMode: seasonMode,
        SeasonCode: seasonCode,
        statisticMode,
        phaseTypeCode,
        sortDirection,
        size: String(size),
        offset: String(offset),
    });

    const url = `${base}/statistics/teams/opponentsTraditional?${qp}`;
    return fetchJson(url, { cacheTtlMs });
}
