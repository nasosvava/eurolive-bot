// src/stats/topOffense.js
// Top-10 offenses (PPG) computed from the schedule (XML/JSON safe) with Boxscore fallback.

import { DEFAULT_SEASON } from '../../env.js';
import {
    fetchSchedule,
    getGameDate,
    getTeamName,
    getGameIdentifiers,
    getScoresFromSchedule,
    fetchBoxScoreScores,
} from '../schedule/common.js';

/**
 * Compute Top-10 average points scored per game for a season.
 * Uses schedule (handles XML) + Boxscore fallback for missing scores.
 */
export async function getTopOffense(seasoncode = DEFAULT_SEASON) {
    // 1) Load season schedule (XML/JSON handled in fetchSchedule)
    const data = await fetchSchedule(seasoncode);

    // Normalize list of games from various shapes
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    if (!Array.isArray(games) || games.length === 0) return [];

    const now = Date.now();
    const totals = new Map(); // teamName -> { pts, games }

    // 2) Iterate only past games; collect final points for each side
    for (const g of games) {
        const when = getGameDate(g);
        if (!when) continue;
        if (when.getTime() >= now) continue; // skip future/ongoing if date is after now

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');
        if (!home || !away) continue;

        // Get identifiers
        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);

        // Try schedule-provided scores first
        let { played, homeScore, awayScore } = getScoresFromSchedule(g);

        // Fallback to Boxscore if needed
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            try {
                const bx = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
                if (Number.isFinite(bx?.homeScore) && Number.isFinite(bx?.awayScore)) {
                    homeScore = bx.homeScore;
                    awayScore = bx.awayScore;
                    played = bx.played ?? true;
                }
            } catch {
                // ignore this game if boxscore fails
            }
        }

        // Only include games with valid numeric final scores
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

        // Accumulate
        const add = (teamName, pts) => {
            const cur = totals.get(teamName) ?? { pts: 0, games: 0 };
            totals.set(teamName, { pts: cur.pts + pts, games: cur.games + 1 });
        };

        add(home, homeScore);
        add(away, awayScore);
    }

    // 3) Compute PPG
    const rows = Array.from(totals.entries())
        .map(([teamName, v]) => ({
            teamName,
            ppg: v.pts / Math.max(1, v.games),
        }))
        .filter(x => Number.isFinite(x.ppg));

    // 4) Sort & Top-10
    rows.sort((a, b) => b.ppg - a.ppg);
    return rows.slice(0, 10);
}

/**
 * Build a single embed payload (raw) that index.js converts with EmbedBuilder.
 */
export function buildTopOffenseEmbed(rows, { seasoncode }) {
    if (!rows?.length) {
        return {
            title: 'Top 10 Offenses — PPG',
            description: `No data for **${seasoncode}**.`,
            timestamp: new Date().toISOString(),
        };
    }

    const lines = rows.map((r, i) => {
        const rank = String(i + 1).padStart(2, ' ');
        return `${rank}. **${r.teamName}** — ${r.ppg.toFixed(1)} ppg`;
    });

    return {
        title: 'Top 10 Offenses — PPG',
        description: [`Season: **${seasoncode}**`, '', ...lines].join('\n'),
        timestamp: new Date().toISOString(),
    };
}
