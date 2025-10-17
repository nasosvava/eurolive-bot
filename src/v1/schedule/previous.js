// src/schedule/previous.js
import {
    fetchSchedule,
    getGameDate,
    getTeamName,
    getGameIdentifiers,
    getScoresFromSchedule,
    fetchBoxScoreScores,
    formatDateLabel,
    formatTimeHHMM,
} from './common.js';
import { DEFAULT_SEASON } from '../../env.js';

const norm = (s) => String(s || '').trim().toLowerCase();

function involvesTeam(item, team) {
    const t = norm(team);
    return norm(item.home).includes(t) || norm(item.away).includes(t);
}

/**
 * Build a list of previous games for a team in the current season.
 * - Reads schedule via XML-friendly fetchSchedule()
 * - Keeps games strictly before "now"
 * - Gets score from schedule or Boxscore fallback
 * - Returns most recent first (desc), trimmed by `limit`
 */
export async function fetchPreviousGames({
                                             seasoncode = DEFAULT_SEASON,
                                             team,
                                             timeZone = 'Europe/Athens',
                                             limit = 10,
                                         } = {}) {
    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const now = Date.now();
    const rows = [];

    for (const g of games) {
        const when = getGameDate(g, timeZone);
        if (!when) continue;
        if (when.getTime() >= now) continue; // only past games

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');

        const entry = { date: when, home, away, _raw: g };
        if (!involvesTeam(entry, team)) continue;

        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);

        // Try schedule first
        let { played, homeScore, awayScore } = getScoresFromSchedule(g);

        // Fallback to Boxscore if needed
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            const bx = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
            if (Number.isFinite(bx?.homeScore) && Number.isFinite(bx?.awayScore)) {
                homeScore = bx.homeScore;
                awayScore = bx.awayScore;
                played = bx.played ?? true;
            }
        }

        rows.push({
            date: when,
            home,
            away,
            homeScore: Number.isFinite(homeScore) ? homeScore : null,
            awayScore: Number.isFinite(awayScore) ? awayScore : null,
            played: Boolean(played) || (Number.isFinite(homeScore) && Number.isFinite(awayScore)),
            _ids: { seasoncode: scFromItem, gamecode: gcClean },
            _raw: g,
        });
    }

    // Sort DESC (most recent first) and trim
    rows.sort((a, b) => b.date - a.date);
    return rows.slice(0, Math.max(1, Math.min(20, limit)));
}

/**
 * Build embeds for previous games list
 */
export function buildPreviousEmbeds(
    games,
    { team, seasoncode = DEFAULT_SEASON, timeZone = 'Europe/Athens', limit = 10 } = {},
) {
    const title = `🏀 EuroLeague — Previous Games (${team}) — ${seasoncode}`;

    if (!Array.isArray(games) || games.length === 0) {
        return [
            {
                title,
                description: `No previous games found for **${team}** in **${seasoncode}**.`,
                timestamp: new Date().toISOString(),
            },
        ];
    }

    const lines = games.map((g) => {
        const day = formatDateLabel(g.date, timeZone);
        const hhmm = formatTimeHHMM(g.date, timeZone);

        if (Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore)) {
            // Bold the score block for readability
            return `**${day} ${hhmm}** — ${g.home} **${g.homeScore}–${g.awayScore}** ${g.away}`;
        }
        // If somehow no score (should be rare), show fixture text
        return `**${day} ${hhmm}** — ${g.home} vs ${g.away}`;
    });

    return [
        {
            title,
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
            footer: { text: `Showing last ${games.length} game(s)` },
        },
    ];
}

/**
 * Autocomplete: team names from the current season schedule only.
 * (We avoid the separate TEAMS endpoint so this matches the actual season set.)
 */
export async function previousTeamAutocomplete(interaction) {
    try {
        const focused = interaction.options.getFocused(true); // { name, value }
        if (!focused || focused.name !== 'team') return interaction.respond([]);

        const q = String(focused.value || '').toLowerCase();

        const data = await fetchSchedule(DEFAULT_SEASON);

        let games = [];
        if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
        else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
        else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

        const names = new Set();
        for (const g of games) {
            const h = getTeamName(g, 'home');
            const a = getTeamName(g, 'away');
            if (h) names.add(String(h));
            if (a) names.add(String(a));
        }

        const choices = Array.from(names)
            .filter((n) => n.toLowerCase().includes(q))
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 25)
            .map((name) => ({ name, value: name }));

        return interaction.respond(choices);
    } catch {
        return interaction.respond([]);
    }
}
