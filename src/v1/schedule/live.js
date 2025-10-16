// src/schedule/live.js
import {
    fetchSchedule,
    formatTimeHHMM,
    getGameDate,
    getTeamName,
    getGameIdentifiers,
    getScoresFromSchedule,
    fetchBoxScoreScores,
} from './common.js';
import { DEFAULT_SEASON } from '../../env.js';

const LIVE_EARLY_MS = 15 * 60 * 1000; // 15 minutes before tip
const LIVE_DURATION_MS = 3 * 60 * 60 * 1000 + 45 * 60 * 1000; // ~3h45m after tip

const norm = (s) => String(s || '').trim().toLowerCase();

function teamMatchesFilter(entry, teamFilter) {
    if (!teamFilter) return true;
    const f = norm(teamFilter);
    const hay = [entry.home, entry.away].map(norm).join(' • ');
    return hay.includes(f);
}

/** Heuristic: consider game live if within window around tipoff and not marked final in schedule text */
function looksLiveByTime(item, nowMs) {
    const tip = getGameDate(item);
    if (!tip) return false;

    const tipMs = tip.getTime();
    const started = nowMs >= (tipMs - LIVE_EARLY_MS);
    const within = nowMs <= (tipMs + LIVE_DURATION_MS);

    const raw = JSON.stringify(item || {}).toLowerCase();
    const mentionsEnd = /\b(final|finished|end|ended)\b/.test(raw);

    return started && within && !mentionsEnd;
}

/**
 * Fetch live games snapshot (optionally filter by a selected gameId, e.g. "E2025:123")
 */
export async function fetchLiveGames({
                                         seasoncode = DEFAULT_SEASON,
                                         team = null,
                                         timeZone = 'Europe/Athens',
                                         gameId = null, // NEW: "seasoncode:gamecode"
                                     } = {}) {
    const data = await fetchSchedule(seasoncode);

    // Schedule arrays supported by your week.js
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const now = Date.now();
    const results = [];

    for (const g of games) {
        if (!looksLiveByTime(g, now)) continue;

        const when = getGameDate(g);
        if (!when) continue;

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');

        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);

        // If user selected a specific live game from autocomplete, filter here
        if (gameId) {
            const currentId = `${scFromItem}:${gcClean}`;
            if (currentId !== gameId) continue;
        }

        // Try schedule-provided score first
        let { played, homeScore, awayScore } = getScoresFromSchedule(g);

        // Fallback to Boxscore if numbers missing
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            const live = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
            if (Number.isFinite(live?.homeScore) && Number.isFinite(live?.awayScore)) {
                homeScore = live.homeScore;
                awayScore = live.awayScore;
                played = live.played ?? false;
            }
        }

        const entry = {
            date: when,
            home,
            away,
            homeScore: Number.isFinite(homeScore) ? homeScore : null,
            awayScore: Number.isFinite(awayScore) ? awayScore : null,
            isLiveWindow: true,
            isFinal: Boolean(played),
            _raw: g,
            _ids: { scFromItem, gcClean },
        };

        if (teamMatchesFilter(entry, team)) {
            results.push(entry);
        }
    }

    results.sort((a, b) => a.date - b.date);
    return results;
}

export function buildLiveEmbeds(games, { team = null, timeZone = 'Europe/Athens' } = {}) {
    if (!Array.isArray(games) || games.length === 0) {
        return [
            {
                title: team ? `🏀 EuroLeague — Live (${team})` : '🏀 EuroLeague — Live',
                description: team
                    ? `No **live** games for “${team}” right now.`
                    : 'No **EuroLeague** games are live right now.',
                timestamp: new Date().toISOString(),
            },
        ];
    }

    const GREEN = '\u001b[32m';
    const RED = '\u001b[31m';
    const RESET = '\u001b[0m';

    const lines = games.map((g) => {
        const t = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
        }).format(g.date);

        if (Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore)) {
            let homeStr = `${g.home} ${g.homeScore}`;
            let awayStr = `${g.away} ${g.awayScore}`;
            if (g.homeScore > g.awayScore) {
                homeStr = `${GREEN}${homeStr}${RESET}`;
                awayStr = `${RED}${awayStr}${RESET}`;
            } else if (g.awayScore > g.homeScore) {
                awayStr = `${GREEN}${awayStr}${RESET}`;
                homeStr = `${RED}${homeStr}${RESET}`;
            }
            return `\`\`\`ansi\n${t}\n${homeStr}\n${awayStr}\n— Live\n\`\`\``;
        }

        return `\`\`\`\n${t}\n${g.home} vs ${g.away}\n— Live (score not available yet)\n\`\`\``;
    });

    return [
        {
            title: team ? `🏀 EuroLeague — Live (${team})` : '🏀 EuroLeague — Live',
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
        },
    ];
}

/** ---------- Autocomplete: ONLY current live games (label + pickable id) ---------- */
export async function liveAutocomplete(interaction, { timeZone = 'Europe/Athens' } = {}) {
    try {
        // Which option is focused? We only autocomplete for 'game'
        const focused = interaction.options.getFocused(true); // { name, value }
        if (!focused || focused.name !== 'game') {
            return interaction.respond([]); // ignore other fields
        }
        const q = String(focused.value || '').toLowerCase();

        const data = await fetchSchedule(DEFAULT_SEASON);

        let games = [];
        if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
        else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
        else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

        const now = Date.now();
        const choices = [];

        for (const g of games) {
            if (!looksLiveByTime(g, now)) continue;

            const when = getGameDate(g);
            if (!when) continue;

            const home = getTeamName(g, 'home');
            const away = getTeamName(g, 'away');

            const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, DEFAULT_SEASON);
            const id = `${scFromItem}:${gcClean}`;
            const hhmm = formatTimeHHMM(when, timeZone);

            const label = `${hhmm} — ${home} vs ${away}`;

            if (!q || label.toLowerCase().includes(q) || home?.toLowerCase().includes(q) || away?.toLowerCase().includes(q)) {
                choices.push({ name: label, value: id });
            }
        }

        // Discord limits to 25 choices
        return interaction.respond(choices.slice(0, 25));
    } catch {
        return interaction.respond([]);
    }
}
