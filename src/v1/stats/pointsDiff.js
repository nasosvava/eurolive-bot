// src/stats/pointsDiff.js
// Calculates total point differential (points scored - points allowed) across finished games.
// Returns ALL teams (no slicing). Optionally filter by team upstream.

import { DEFAULT_SEASON, EUROLEAGUE_BOXSCORE } from '../../env.js';
import { fetchSchedule, getGameDate, getTeamName, getGameIdentifiers } from '../schedule/common.js';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

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
        if (val != null) pts += val;
    }
    return pts;
}

export async function getPointsDiff({ seasoncode = DEFAULT_SEASON } = {}) {
    console.log(`[DIFF] Start computation for ${seasoncode}`);

    const data = await fetchSchedule(seasoncode);
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    console.log(`[DIFF] Schedule loaded, total games: ${games.length}`);

    const now = Date.now();
    const past = games.filter((g) => {
        const dt = getGameDate(g);
        return dt && dt.getTime() < now;
    });
    console.log(`[DIFF] Past games: ${past.length}`);

    const agg = new Map(); // teamName -> { scored, allowed }

    for (const g of past) {
        const homeName = getTeamName(g, 'home');
        const awayName = getTeamName(g, 'away');
        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);
        if (!gcClean) continue;

        const url = `${EUROLEAGUE_BOXSCORE}?gamecode=${encodeURIComponent(gcClean)}&seasoncode=${encodeURIComponent(scFromItem)}`;
        let box;
        try {
            box = await fetchAny(url);
        } catch (e) {
            console.log(`[DIFF] Box fetch failed for game ${gcClean}: ${e.message}`);
            continue;
        }

        const statsArr = statsToArray(box?.Stats ?? box);
        if (statsArr.length < 2) continue;

        const home = statsArr[0];
        const away = statsArr[1];

        const hTeam = home?.Team || homeName || 'HOME';
        const aTeam = away?.Team || awayName || 'AWAY';

        const hPts = sumTeamPoints(home?.PlayersStats);
        const aPts = sumTeamPoints(away?.PlayersStats);

        if (hPts === 0 && aPts === 0) continue;

        const curH = agg.get(hTeam) ?? { scored: 0, allowed: 0 };
        agg.set(hTeam, { scored: curH.scored + hPts, allowed: curH.allowed + aPts });

        const curA = agg.get(aTeam) ?? { scored: 0, allowed: 0 };
        agg.set(aTeam, { scored: curA.scored + aPts, allowed: curA.allowed + hPts });
    }

    const rows = Array.from(agg.entries()).map(([teamName, v]) => {
        const diff = v.scored - v.allowed;
        return { teamName, scored: v.scored, allowed: v.allowed, diff };
    }).sort((a, b) => b.diff - a.diff); // ALL teams, sorted desc

    console.log(`[DIFF] Teams computed: ${rows.length}`);
    return rows;
}

export function buildPointsDiffEmbed(rows, { seasoncode, team } = {}) {
    // If a specific team requested
    if (team) {
        const idx = rows.findIndex(r => r.teamName.toLowerCase() === team.toLowerCase());
        if (idx === -1) {
            return {
                title: 'Point Differential — Team',
                description: `No data for **${team}** in **${seasoncode}**.`,
                timestamp: new Date().toISOString(),
            };
        }
        const r = rows[idx];
        const sign = r.diff >= 0 ? '+' : '';
        const rank = idx + 1;
        return {
            title: 'Point Differential — Team',
            description: [
                `Season: **${seasoncode}**`,
                '',
                `**${rank}. ${r.teamName}** — ${sign}${r.diff}`,
                `Scored: **${r.scored}**, Allowed: **${r.allowed}**`,
            ].join('\n'),
            timestamp: new Date().toISOString(),
        };
    }

    // Otherwise list ALL teams (20)
    const lines = rows.map((r, i) => {
        const sign = r.diff >= 0 ? '+' : '';
        return `${String(i + 1).padStart(2, ' ')}. **${r.teamName}** — ${sign}${r.diff} (Scored: ${r.scored}, Allowed: ${r.allowed})`;
    });

    return {
        title: 'Point Differential — All Teams',
        description: [`Season: **${seasoncode}**`, '', ...lines].join('\n'),
        timestamp: new Date().toISOString(),
    };
}
