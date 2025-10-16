// src/analytics/homeAway.js
// Build per-team HOME/AWAY ratings (ORTG/DRTG/NET) from finished games.

import { DEFAULT_SEASON, EUROLEAGUE_BOXSCORE } from '../env.js';
import { fetchSchedule, getGameDate, getTeamName, getGameIdentifiers } from '../v1/schedule/common.js';
import { XMLParser } from 'fast-xml-parser';

// ── utils similar to your pointsDiff.js
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

async function fetchAny(url) {
    const res = await fetch(url, { headers: { accept: 'application/json, text/xml, application/xml, */*' } });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const ctype = res.headers.get('content-type') || '';
    const text = await res.text();
    if (ctype.includes('application/json')) return JSON.parse(text);
    const trimmed = text.trim();
    if (trimmed.startsWith('<')) return xmlParser.parse(trimmed);
    return JSON.parse(text);
}

function statsToArray(stats) {
    if (!stats) return [];
    if (Array.isArray(stats)) return stats;
    const keys = Object.keys(stats).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    return keys.map((k) => stats[k]);
}

function sumTeamPoints(playersStats) {
    if (!Array.isArray(playersStats)) return 0;
    let pts = 0;
    for (const p of playersStats) {
        const val = num(p?.Points ?? p?.points ?? p?.PTS);
        pts += val;
    }
    return pts;
}

// Accums: { offPts, defPts, offPoss, defPoss, games }
function mk() { return { offPts: 0, defPts: 0, offPoss: 0, defPoss: 0, games: 0 }; }

function add(acc, { offPts, defPts, offPoss, defPoss }) {
    acc.offPts += offPts;
    acc.defPts += defPts;
    acc.offPoss += offPoss;
    acc.defPoss += defPoss;
    acc.games += 1;
}

const safeDiv = (a, b) => (b > 0 ? a / b : 0);

function deriveRating(acc) {
    const ortg = safeDiv(acc.offPts, acc.offPoss) * 100;
    const drtg = safeDiv(acc.defPts, acc.defPoss) * 100;
    const net = ortg - drtg;
    return { ortg, drtg, net, games: acc.games };
}

// Cache for a bit
let _cache = null;
let _cacheSeason = null;

export async function getHomeAwaySplits({ seasoncode = DEFAULT_SEASON } = {}) {
    if (_cache && _cacheSeason === seasoncode) return _cache;

    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const now = Date.now();
    const past = games.filter((g) => {
        const dt = getGameDate(g);
        return dt && dt.getTime() < now;
    });

    const byTeam = new Map(); // team -> { home: acc, away: acc }

    for (const g of past) {
        const homeName = getTeamName(g, 'home');
        const awayName = getTeamName(g, 'away');
        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);
        if (!gcClean) continue;

        const url = `${EUROLEAGUE_BOXSCORE}?gamecode=${encodeURIComponent(gcClean)}&seasoncode=${encodeURIComponent(scFromItem)}`;
        let box;
        try { box = await fetchAny(url); } catch { continue; }

        const statsArr = statsToArray(box?.Stats ?? box);
        if (statsArr.length < 2) continue;

        const home = statsArr[0];
        const away = statsArr[1];

        const hTeam = String(home?.Team || homeName || 'HOME');
        const aTeam = String(away?.Team || awayName || 'AWAY');

        const hPts = sumTeamPoints(home?.PlayersStats);
        const aPts = sumTeamPoints(away?.PlayersStats);

        // If poss are available in the box, use them; otherwise fallback to points-only model.
        // For simplicity here we infer poss from score pace if needed — but ideally fetch official possessions if exposed.
        // We’ll approximate possessions as sum of both teams’ FGA + 0.44*FTA - OREB + TOV (not available in this payload).
        // So we conservatively treat offPoss≈defPoss and scale by score — this keeps relative splits meaningful.
        // If you have a better source for per-game possessions, plug it here.
        const possApprox = (hPts + aPts) / 1.95; // rough pace proxy; tweak if you later add true poss
        const hOffPoss = possApprox;
        const hDefPoss = possApprox;
        const aOffPoss = possApprox;
        const aDefPoss = possApprox;

        if (!byTeam.has(hTeam)) byTeam.set(hTeam, { home: mk(), away: mk() });
        if (!byTeam.has(aTeam)) byTeam.set(aTeam, { home: mk(), away: mk() });

        add(byTeam.get(hTeam).home, { offPts: hPts, defPts: aPts, offPoss: hOffPoss, defPoss: hDefPoss });
        add(byTeam.get(aTeam).away, { offPts: aPts, defPts: hPts, offPoss: aOffPoss, defPoss: aDefPoss });
    }

    const result = {};
    for (const [team, v] of byTeam.entries()) {
        result[team] = {
            home: deriveRating(v.home),
            away: deriveRating(v.away),
        };
    }

    _cache = result;
    _cacheSeason = seasoncode;
    return result;
}
