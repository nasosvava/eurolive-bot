// src/stats/worst3pt.js
// Bottom-10 teams by 3-point percentage (3P%) from box.Stats["0|1"].PlayersStats[*].FieldGoalsMade3/FieldGoalsAttempted3

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

function statsToArray(stats) {
    if (!stats) return [];
    if (Array.isArray(stats)) return stats;
    const keys = Object.keys(stats).filter(k => /^\d+$/.test(k)).sort((a,b) => Number(a)-Number(b));
    if (keys.length) return keys.map(k => stats[k]);
    return [];
}

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

export async function getWorst3pt({ seasoncode = DEFAULT_SEASON, minAttempts = 50 } = {}) {
    console.log(`[W3PT] Start computation for ${seasoncode}`);

    const data = await fetchSchedule(seasoncode);
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    console.log(`[W3PT] Schedule loaded, total games: ${games.length}`);

    const now = Date.now();
    const past = games.filter(g => {
        const dt = getGameDate(g);
        return dt && dt.getTime() < now;
    });
    console.log(`[W3PT] Past games: ${past.length}`);

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
            console.log(`[W3PT] Boxscore fetch failed for game ${gcClean}: ${e.message}`);
            continue;
        }

        const statsRoot = box?.Stats ?? box;
        const statsArr = statsToArray(statsRoot);

        if (samples < 2) {
            console.log(`[W3PT] Stats keys for game ${gcClean}:`, keysOf(statsRoot));
            if (statsArr[0]) {
                console.log(`[W3PT] Stats[0] keys:`, keysOf(statsArr[0]));
                console.log(`[W3PT] Stats[0] sample:`, shortJson(statsArr[0]));
            }
            if (statsArr[1]) {
                console.log(`[W3PT] Stats[1] keys:`, keysOf(statsArr[1]));
                console.log(`[W3PT] Stats[1] sample:`, shortJson(statsArr[1]));
            }
            samples++;
        }

        if (statsArr.length < 2) continue;

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
        }
    }

    console.log(`[W3PT] Boxes fetched: ${boxFetched}, ok: ${boxOk}, games with 3P extracted: ${gamesWith3p}, teams aggregated: ${agg.size}`);

    const all = Array.from(agg.entries()).map(([teamName, v]) => {
        const made = num(v.made) ?? 0;
        const att  = num(v.att)  ?? 0;
        const pct  = att > 0 ? (made / att) : 0;
        return { teamName, made, att, pct };
    });

    // Filter by attempts first (to avoid micro-samples), then sort ASC for worst
    const threshold = Math.max(0, Number(minAttempts) || 0);
    let rows = all.filter(r => r.att >= threshold).sort((a, b) => a.pct - b.pct).slice(0, 10);

    // Fallback if threshold removed everyone
    if (rows.length === 0 && all.length > 0) {
        console.log(`[W3PT] threshold ${threshold} removed all teams → using no threshold`);
        rows = all.sort((a, b) => a.pct - b.pct).slice(0, 10);
    }

    console.log(`[W3PT] Final bottom (${rows.length}):`, shortJson(rows));
    return rows;
}

export function buildWorst3ptEmbed(rows, { seasoncode, minAttempts }) {
    if (!rows?.length) {
        return {
            title: 'Bottom 10 — 3-Point Percentage',
            description: `No data for **${seasoncode}** (min ${minAttempts} 3PA).`,
            timestamp: new Date().toISOString(),
        };
    }

    const lines = rows.map((r, i) => {
        const pct = (r.pct * 100).toFixed(1);
        return `${i + 1}. **${r.teamName}** — ${pct}% (${r.made}/${r.att})`;
    });

    return {
        title: 'Bottom 10 — 3-Point Percentage',
        description: [`Season: **${seasoncode}** • Min Attempts: **${minAttempts}**`, '', ...lines].join('\n'),
        timestamp: new Date().toISOString(),
    };
}
