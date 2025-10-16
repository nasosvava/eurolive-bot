// src/api/clubMetadata.js
import {
    CLUBS_FULL_STATS_URL,
    EUROLEAGUE_API_V3,
} from '../env.js';

const colorsCache = new Map(); // competition -> Map
const crestsCache = new Map(); // competition -> Map

const DEFAULT_EUROLEAGUE_COLORS_URL =
    'https://ycpcq74tr3.execute-api.eu-central-1.amazonaws.com/prod/league/euroleague/clubs-full-stats';
const DEFAULT_EUROCUP_COLORS_URL =
    'https://ycpcq74tr3.execute-api.eu-central-1.amazonaws.com/prod/league/eurocup/clubs-full-stats';

function normaliseKey(value) {
    return String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^A-Z0-9]/g, '');
}

function normaliseHexColor(value) {
    if (!value) return null;
    let str = String(value).trim();
    if (!str) return null;
    if (str.startsWith('rgb')) return null;
    if (/^0x/i.test(str)) str = str.replace(/^0x/i, '#');
    if (!str.startsWith('#')) str = `#${str}`;
    if (/^#[0-9a-f]{3}$/i.test(str)) {
        str = `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`;
    }
    if (!/^#[0-9a-f]{6}$/i.test(str)) return null;
    const upper = str.toUpperCase();

    const r = parseInt(upper.slice(1, 3), 16);
    const g = parseInt(upper.slice(3, 5), 16);
    const b = parseInt(upper.slice(5, 7), 16);
    const brightness = (r + g + b) / 3;

    if (brightness >= 240) return '#888888';

    return upper;
}

function register(map, key, value) {
    if (!key) return;
    const norm = normaliseKey(key);
    if (!norm) return;
    if (!value) return;
    map.set(norm, value);
}

function resolveColorsUrl(competition) {
    const base = CLUBS_FULL_STATS_URL || DEFAULT_EUROLEAGUE_COLORS_URL;
    if (competition === 'E') return base;

    const eurocupUrl =
        base.includes('euroleague')
            ? base.replace(/euroleague/gi, 'eurocup')
            : DEFAULT_EUROCUP_COLORS_URL;

    return competition === 'U' ? eurocupUrl : base;
}

async function fetchJson(url) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    return res.json();
}

export async function getClubColorsMap(competition) {
    if (colorsCache.has(competition)) return colorsCache.get(competition);

    try {
        const url = resolveColorsUrl(competition);
        const payload = await fetchJson(url);
        const teams = payload?.teams;
        const map = new Map();
        if (Array.isArray(teams)) {
            for (const team of teams) {
                const entry = {
                    primaryColor: normaliseHexColor(team?.primaryColor),
                    secondaryColor: normaliseHexColor(team?.secondaryColor),
                };
                register(map, team?.shortName, entry);
                register(map, team?.teamName, entry);
                register(map, team?.clubId, entry);
            }
        }
        colorsCache.set(competition, map);
        return map;
    } catch (err) {
        colorsCache.set(competition, new Map());
        return colorsCache.get(competition);
    }
}

export async function getClubCrestsMap(competition) {
    if (crestsCache.has(competition)) return crestsCache.get(competition);

    try {
        const url = `${EUROLEAGUE_API_V3}/clubs?competitionCode=${encodeURIComponent(competition)}`;
        const payload = await fetchJson(url);
        const data = payload?.data ?? payload ?? [];
        const map = new Map();
        if (Array.isArray(data)) {
            for (const club of data) {
                const crest =
                    club?.images?.crest ||
                    club?.images?.logo ||
                    club?.images?.badge ||
                    null;
                if (!crest) continue;
                register(map, club?.code, crest);
                register(map, club?.name, crest);
                register(map, club?.alias, crest);
            }
        }
        crestsCache.set(competition, map);
        return map;
    } catch (err) {
        crestsCache.set(competition, new Map());
        return crestsCache.get(competition);
    }
}

export async function enrichTeamVisuals(teams, competition) {
    const [colorMap, crestMap] = await Promise.all([
        getClubColorsMap(competition),
        getClubCrestsMap(competition),
    ]);

    const lookupColor = (team) => {
        return (
            colorMap.get(normaliseKey(team.teamCode)) ||
            colorMap.get(normaliseKey(team.shortName)) ||
            colorMap.get(normaliseKey(team.teamName)) ||
            colorMap.get(normaliseKey(team.clubId))
        );
    };

    const lookupCrest = (team) => {
        return (
            crestMap.get(normaliseKey(team.teamCode)) ||
            crestMap.get(normaliseKey(team.shortName)) ||
            crestMap.get(normaliseKey(team.teamName)) ||
            crestMap.get(normaliseKey(team.clubId))
        );
    };

    for (const team of teams) {
        let primary = normaliseHexColor(team.primaryColor);
        let secondary = normaliseHexColor(team.secondaryColor);

        const match = lookupColor(team);
        if (!primary && match?.primaryColor) primary = normaliseHexColor(match.primaryColor);
        if (!secondary && match?.secondaryColor) secondary = normaliseHexColor(match.secondaryColor);

        team.primaryColor = primary || '#0099ff';
        team.secondaryColor = secondary || '#222222';

        if (!team.imageUrl) {
            const crest = lookupCrest(team);
            if (crest) team.imageUrl = crest;
        }
    }
}
