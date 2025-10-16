// src/stats/topDefense.js
// Top-10 defenses (fewest opponent points per game), using schedule (XML/JSON safe) + Boxscore fallback.

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
 * Compute Top-10 defenses = lowest opponent PPG.
 * Counts only completed past games (strictly before "now").
 */
export async function getTopDefense(seasoncode = DEFAULT_SEASON) {
    const data = await fetchSchedule(seasoncode);

    // normalize possible shapes
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    if (!Array.isArray(games) || games.length === 0) return [];

    const now = Date.now();
    const allowed = new Map(); // teamName -> { oppPts, games }

    for (const g of games) {
        const when = getGameDate(g);
        if (!when) continue;
        if (when.getTime() >= now) continue; // only past games

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');
        if (!home || !away) continue;

        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);

        // Try to read scores from schedule
        let { homeScore, awayScore } = getScoresFromSchedule(g);

        // Boxscore fallback
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            try {
                const bx = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
                if (Number.isFinite(bx?.homeScore) && Number.isFinite(bx?.awayScore)) {
                    homeScore = bx.homeScore;
                    awayScore = bx.awayScore;
                }
            } catch {
                // ignore if boxscore fetch fails for this game
            }
        }

        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

        // defense = opponent points allowed
        const addAllowed = (teamName, oppPoints) => {
            const cur = allowed.get(teamName) ?? { oppPts: 0, games: 0 };
            allowed.set(teamName, { oppPts: cur.oppPts + oppPoints, games: cur.games + 1 });
        };

        addAllowed(home, awayScore); // home allowed away's points
        addAllowed(away, homeScore); // away allowed home's points
    }

    // compute Opp PPG (lower is better)
    const rows = Array.from(allowed.entries())
        .map(([teamName, v]) => ({
            teamName,
            oppPpg: v.oppPts / Math.max(1, v.games),
        }))
        .filter((x) => Number.isFinite(x.oppPpg));

    // ascending sort (best defense first = fewest allowed)
    rows.sort((a, b) => a.oppPpg - b.oppPpg);
    return rows.slice(0, 10);
}

export function buildTopDefenseEmbed(rows, { seasoncode }) {
    if (!rows?.length) {
        return {
            title: 'Top 10 Defenses — Opp PPG (lower is better)',
            description: `No data for **${seasoncode}**.`,
            timestamp: new Date().toISOString(),
        };
    }

    const lines = rows.map((r, i) => {
        const rank = String(i + 1).padStart(2, ' ');
        return `${rank}. **${r.teamName}** — ${r.oppPpg.toFixed(1)} opp ppg`;
    });

    return {
        title: 'Top 10 Defenses — Opp PPG (lower is better)',
        description: [`Season: **${seasoncode}**`, '', ...lines].join('\n'),
        timestamp: new Date().toISOString(),
    };
}
