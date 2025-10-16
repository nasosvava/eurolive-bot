// src/stats/topft.js
// Top-10 teams by FT% from PlayersStats[*].FreeThrowsMade / FreeThrowsAttempted

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

function sumPlayersFT(players) {
    if (!Array.isArray(players)) return { made: 0, att: 0, count: 0 };
    let made = 0, att = 0, count = 0;
    for (const p of players) {
        const m = num(p?.FreeThrowsMade ?? p?.freeThrowsMade);
        const a = num(p?.FreeThrowsAttempted ?? p?.freeThrowsAttempted);
        if (m != null) { made += m; count++; }
        if (a != null) { att  += a; count++; }
    }
    return { made, att, count };
}

function addToAgg(agg, name, made, att) {
    const m = num(made), a = num(att);
    if (m == null || a == null) return;
    const cur = agg.get(name) ?? { made: 0, att: 0 };
    agg.set(name, { made: cur.made + m, att: cur.att + a });
}

export async function getTopFT({ seasoncode = DEFAULT_SEASON, minAttempts = 50 } = {}) {
    console.log(`[FT] Start computation for ${seasoncode}`);
    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const now = Date.now();
    const past = games.filter((g) => { const dt = getGameDate(g); return dt && dt.getTime() < now; });

    const agg = new Map();
    for (const g of past) {
        const home = getTeamName(g, 'home'); const away = getTeamName(g, 'away');
        const { seasoncode: sc, gamecode: gc } = getGameIdentifiers(g, seasoncode);
        if (!gc) continue;

        let box;
        try {
            const url = `${EUROLEAGUE_BOXSCORE}?gamecode=${encodeURIComponent(gc)}&seasoncode=${encodeURIComponent(sc)}`;
            box = await fetchAny(url);
        } catch { continue; }

        const statsArr = statsToArray(box?.Stats ?? box);
        if (statsArr.length < 2) continue;

        const a = statsArr[0], b = statsArr[1];
        const nameA = (a?.Team && String(a.Team)) || home || 'HOME';
        const nameB = (b?.Team && String(b.Team)) || away || 'AWAY';

        const A = sumPlayersFT(a?.PlayersStats);
        const B = sumPlayersFT(b?.PlayersStats);

        if (A.count > 0 || B.count > 0) {
            addToAgg(agg, nameA, A.made, A.att);
            addToAgg(agg, nameB, B.made, B.att);
        }
    }

    const all = Array.from(agg.entries()).map(([teamName, v]) => {
        const made = v.made || 0, att = v.att || 0, pct = att > 0 ? (made / att) : 0;
        return { teamName, made, att, pct };
    });

    const thr = Math.max(0, Number(minAttempts) || 0);
    let rows = all.filter(r => r.att >= thr).sort((a, b) => b.pct - a.pct).slice(0, 10);
    if (rows.length === 0 && all.length > 0) rows = all.sort((a, b) => b.pct - a.pct).slice(0, 10);
    return rows;
}

export function buildTopFTEmbed(rows, { seasoncode, minAttempts }) {
    if (!rows?.length) {
        return { title: 'Top 10 — Free-Throw Percentage', description: `No data for **${seasoncode}** (min ${minAttempts} FTA).`, timestamp: new Date().toISOString() };
    }
    const lines = rows.map((r, i) => `${i + 1}. **${r.teamName}** — ${(r.pct * 100).toFixed(1)}% (${r.made}/${r.att})`);
    return { title: 'Top 10 — Free-Throw Percentage', description: [`Season: **${seasoncode}** • Min Attempts: **${minAttempts}**`, '', ...lines].join('\n'), timestamp: new Date().toISOString() };
}
