// src/api/threeStepsGeneric.js
const THREE_STEPS_BASE = 'https://ycpcq74tr3.execute-api.eu-central-1.amazonaws.com/prod';

const CACHE = new Map(); // key -> { at, data }
const TTL_MS = 60_000;
const PLAYERS_CACHE = new Map(); // league:club:competitionId -> { at, data }
const PLAYERS_TTL_MS = 60_000;
const UA = 'eurolive-bot/3steps-generic (+https://github.com)';

const DATASET_PATHS = {
    best_players: (league, seasonId) => ({ path: `/league/${encodeURIComponent(league)}/best-players`, seasonId }),
    club_stats: (league, seasonId) => ({ path: `/league/${encodeURIComponent(league)}/clubs-full-stats`, seasonId }),
    standings: (league, seasonId) => ({ path: `/league/${encodeURIComponent(league)}/full-standings`, seasonId }),
};

function buildUrl({ dataset, league, seasonId }) {
    const builder = DATASET_PATHS[dataset];
    if (!builder) {
        throw new Error(`Unsupported dataset "${dataset}"`);
    }
    const { path, seasonId: optionalSeasonId } = builder(league, seasonId);
    const cleanPath = path.replace(/\/{2,}/g, '/');
    const url = new URL(`${THREE_STEPS_BASE}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`);

    if (optionalSeasonId) {
        url.searchParams.set('competitionId', optionalSeasonId);
    }

    return url.toString();
}

async function fetchJson(url, { attempts = 3, timeoutMs = 10_000 } = {}) {
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
                lastErr = new Error(`threeSteps fetch ${url} -> HTTP ${res.status}`);
            } else {
                return await res.json();
            }
        } catch (err) {
            lastErr = err;
        } finally {
            clearTimeout(timer);
        }
        if (i < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
        }
    }
    throw lastErr ?? new Error(`threeSteps fetch failed for ${url}`);
}

export async function fetchThreeStepsDataset({ dataset, league, seasonId = null }) {
    if (!league) throw new Error('league is required');
    if (!dataset) throw new Error('dataset is required');

    const key = `${dataset}:${league}:${seasonId || '__latest__'}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.at < TTL_MS) return hit.data;

    const url = buildUrl({ dataset, league, seasonId });
    const data = await fetchJson(url);
    CACHE.set(key, { at: now, data });
    return data;
}

function selectSeasonEntry(seasons = [], seasonInput) {
    if (!Array.isArray(seasons) || !seasons.length) return null;
    if (!seasonInput) return seasons[0];
    const normalized = seasonInput.toString().toLowerCase();

    const digitMatches = normalized.match(/20\d{2}/g) || [];

    const ordered = seasons.slice().reverse();

    const match = ordered.find((entry) => {
        const seasonLabel = (entry.season || '').toLowerCase();
        const comp = (entry.competitionId || '').toLowerCase();
        if (seasonLabel === normalized || comp === normalized) return true;
        if (seasonLabel.includes(normalized) || comp.includes(normalized)) return true;
        return digitMatches.some((digits) => seasonLabel.includes(digits) || comp.includes(digits));
    });

    return match || seasons[seasons.length - 1];
}

export async function fetchThreeStepsClubStats({ league, seasonInput = null }) {
    const base = await fetchThreeStepsDataset({ dataset: 'club_stats', league });
    const seasons = Array.isArray(base?.seasons) ? base.seasons : [];
    const selectedSeason = selectSeasonEntry(seasons, seasonInput);

    if (!selectedSeason || !selectedSeason.competitionId) {
        return { data: base, competitionId: base?.competitionId ?? null };
    }

    if (selectedSeason.competitionId === base?.competitionId) {
        return { data: base, competitionId: base?.competitionId ?? selectedSeason.competitionId };
    }

    const other = await fetchThreeStepsDataset({
        dataset: 'club_stats',
        league,
        seasonId: selectedSeason.competitionId,
    });
    return { data: other, competitionId: selectedSeason.competitionId };
}

export async function fetchThreeStepsClubPlayers({ league, clubId, seasonInput = null }) {
    if (!clubId) throw new Error('clubId is required');

    const { data, competitionId } = await fetchThreeStepsClubStats({ league, seasonInput });
    const resolvedCompetition = competitionId || data?.competitionId;
    if (!resolvedCompetition) {
        throw new Error('Unable to resolve competitionId for players stats');
    }

    const cacheKey = `${league}:${clubId}:${resolvedCompetition}`;
    const now = Date.now();
    const hit = PLAYERS_CACHE.get(cacheKey);
    if (hit && now - hit.at < PLAYERS_TTL_MS) {
        return { data: hit.data, competitionId: resolvedCompetition };
    }

    const url = `${THREE_STEPS_BASE}/club/${encodeURIComponent(clubId)}/players-stats?competitionId=${encodeURIComponent(resolvedCompetition)}`;
    const payload = await fetchJson(url);
    PLAYERS_CACHE.set(cacheKey, { at: now, data: payload });
    return { data: payload, competitionId: resolvedCompetition };
}
