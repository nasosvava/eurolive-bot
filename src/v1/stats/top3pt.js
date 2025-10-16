// src/stats/top3pt.js
// Top-10 teams by 3P% from box.Stats["0|1"].PlayersStats[*].FieldGoalsMade3 / FieldGoalsAttempted3

import { DEFAULT_SEASON, EUROLEAGUE_BOXSCORE } from '../../env.js';
import {
    fetchSchedule,
    getGameDate,
    getTeamName,
    getGameIdentifiers,
} from '../schedule/common.js';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
});

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function keysOf(o) { try { return o && typeof o === 'object' ? Object.keys(o) : null; } catch { return null; } }
function shortJson(obj, len = 300) { try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length > len ? s.slice(0, len) + '…' : s;
} catch { return '[unserializable]'; } }

async function fetchAny(url) {
    const res = await fetch(url, { headers: { accept: 'application/json, text/xml, application/xml, */*' } });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const ctype = res.headers.get('content-type') || '';
    const text = await res.text();
    if (ctype.includes('application/json')) return JSON.parse(text);
    const trimmed = text.trim();
    if (trimmed.startsWith('<')) return xmlParser.parse(trimmed);
    try { return JSON.parse(text); } catch {
        throw new Error(`Unexpected response for ${url}: ${trimmed.slice(0, 200).replace(/\s+/g, ' ')}`);
    }
}

// Convert Stats object with numeric keys to array
function statsToArray(stats) {
    if (!stats) return [];
    if (Array.isArray(stats)) return stats;
    const keys = Object.keys(stats).filter(k => /^\d+$/.test(k)).sort((a,b) => Number(a)-Number(b));
    if (keys.length) return keys.map(k => stats[k]);
    return [];
}

// Sum 3P from PlayersStats array (FieldGoalsMade3 / FieldGoalsAttempted3)
function sumPlayersFG3(playersStats) {
    if (!Array.isArray(playersStats)) return { made: 0, att: 0, count: 0 };
    let made = 0, att = 0, count = 0;
    for (const p of playersStats) {
        const pm = num(p?.FieldGoalsMade3 ?? p?.fieldGoalsMade3);
        const pa = num(p?.FieldGoalsAttempted3 ?? p?.fieldGoalsAttempted3);
        if (pm != null) { made += pm; count++; }
        if (pa != null) { att  += pa; count++; }
    }
    return { made, att, count };
}

function addToAgg(agg, name, made, att) {
    const m = num(made), a = num(att);
    if (m == null || a == null) return;
    const cur = agg.get(name) ?? { made: 0, att: 0 };
    agg.set(name, { made: cur.made + m, att: cur.att + a });
}

export async function getTop3pt({ seasoncode = DEFAULT_SEASON, minAttempts = 50 } = {}) {

    const data = await fetchSchedule(seasoncode);
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;


    const now = Date.now();
    const past = games.filter(g => {
        const dt = getGameDate(g);
        return dt && dt.getTime() < now;
    });

    const agg = new Map();
    let boxFetched = 0, boxOk = 0, gamesWith3p = 0, samples = 0;

    for (const g of past) {
        const homeSchedName = getTeamName(g, 'home');
        const awaySchedName = getTeamName(g, 'away');
        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);
        if (!gcClean) continue;

        const url = `${EUROLEAGUE_BOXSCORE}?gamecode=${encodeURIComponent(gcClean)}&seasoncode=${encodeURIComponent(scFromItem)}`;
        boxFetched++;

        let box;
        try {
            box = await fetchAny(url);
            boxOk++;
        } catch (e) {
            continue;
        }

        const statsRoot = box?.Stats ?? box;
        const statsArr = statsToArray(statsRoot);

        if (samples < 3) {
            samples++;
        }

        if (statsArr.length < 2) {
            continue;
        }

        // Expect two entries (one per team)
        const a = statsArr[0];
        const b = statsArr[1];

        const nameA = (a?.Team && String(a.Team)) || homeSchedName || 'HOME';
        const nameB = (b?.Team && String(b.Team)) || awaySchedName || 'AWAY';

        const { made: madeA, att: attA, count: cntA } = sumPlayersFG3(a?.PlayersStats);
        const { made: madeB, att: attB, count: cntB } = sumPlayersFG3(b?.PlayersStats);

        if (cntA > 0 || cntB > 0) {
            addToAgg(agg, nameA, madeA, attA);
            addToAgg(agg, nameB, madeB, attB);
            gamesWith3p++;
        } else {
        }
    }


    const all = Array.from(agg.entries()).map(([teamName, v]) => {
        const made = num(v.made) ?? 0;
        const att  = num(v.att)  ?? 0;
        const pct  = att > 0 ? (made / att) : 0;
        return { teamName, made, att, pct };
    });


    const threshold = Math.max(0, Number(minAttempts) || 0);
    let rows = all.filter(r => r.att >= threshold).sort((a, b) => b.pct - a.pct).slice(0, 10);
    if (rows.length === 0 && all.length > 0) {
        rows = all.sort((a, b) => b.pct - a.pct).slice(0, 10);
    }

    return rows;
}

export function buildTop3ptEmbed(rows, { seasoncode, minAttempts }) {
    if (!rows?.length) {
        return {
            title: 'Top 10 — 3-Point Percentage',
            description: `No data for **${seasoncode}** (min ${minAttempts} 3PA).`,
            timestamp: new Date().toISOString(),
        };
    }

    const lines = rows.map((r, i) => {
        const pct = (r.pct * 100).toFixed(1);
        return `${i + 1}. **${r.teamName}** — ${pct}% (${r.made}/${r.att})`;
    });

    return {
        title: 'Top 10 — 3-Point Percentage',
        description: [`Season: **${seasoncode}**`, '', ...lines].join('\n'),
        timestamp: new Date().toISOString(),
    };
}
