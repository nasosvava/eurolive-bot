import {
    fetchSchedule,
    formatTimeHHMM,
    formatDateLabel,
    localDateKey,
    getTeamName,
    getGameDate,
    getGameIdentifiers,
    getScoresFromSchedule,
    fetchBoxScoreScores,
} from './common.js';
import { DEFAULT_SEASON } from '../../env.js';

/* Build Mon..Sun of current week in timeZone */
function buildWeekDateSet(timeZone) {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now); // Sun..Sat
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayIndex = map[weekday] ?? 0;
    const deltaToMonday = (todayIndex + 6) % 7;

    const set = new Set();
    const ordered = [];
    for (let i = -deltaToMonday; i <= 6 - deltaToMonday; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const key = localDateKey(d, timeZone);
        if (!set.has(key)) {
            set.add(key);
            ordered.push({ key, date: d });
        }
    }
    return { set, ordered };
}

export async function fetchWeekGames({ seasoncode = DEFAULT_SEASON, timeZone = 'Europe/Athens' } = {}) {
    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const { set: weekKeys } = buildWeekDateSet(timeZone);

    const now = new Date();
    const out = [];

    for (const g of games) {
        const when = getGameDate(g, timeZone);
        if (!when) continue;

        const key = localDateKey(when, timeZone);
        if (!weekKeys.has(key)) continue;

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');

        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);
        const past = when.getTime() < now.getTime();

        // 1) Try schedule-provided score first
        let { played, homeScore, awayScore } = getScoresFromSchedule(g);

        // 2) If not available and game is past, try Boxscore
        if (!played && past) {
            const live = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
            if (live.played) {
                played = true;
                homeScore = live.homeScore;
                awayScore = live.awayScore;
            }
        }

        out.push({
            date: when,
            dateKey: key,
            home,
            away,
            played,
            homeScore,
            awayScore,
            _raw: g,
        });
    }

    out.sort((a, b) => a.date - b.date);
    return out;
}

export function buildWeekEmbeds(games, { timeZone = 'Europe/Athens' } = {}) {
    if (!Array.isArray(games) || games.length === 0) {
        const now = new Date();
        const label = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        }).format(now);
        return [
            {
                title: `🏀 EuroLeague — This Week (${label})`,
                description: 'No EuroLeague games this week.',
                timestamp: new Date().toISOString(),
            },
        ];
    }

    // Group by local day
    const byDay = new Map();
    for (const g of games) {
        if (!byDay.has(g.dateKey)) byDay.set(g.dateKey, []);
        byDay.get(g.dateKey).push(g);
    }

    const embeds = [];
    for (const [, items] of byDay) {
        const dayDate = items[0]?.date || new Date();
        const dayLabel = formatDateLabel(dayDate, timeZone);

        const lines = items.map((g) => {
            const t = formatTimeHHMM(g.date, timeZone);
            if (g.played) {
                return `**${dayLabel} ${t}** — ${g.home} **${g.homeScore}–${g.awayScore}** ${g.away}`;
            }
            return `**${dayLabel} ${t}** — ${g.home} vs ${g.away}`;
        });

        embeds.push({
            title: `🏀 EuroLeague — ${dayLabel} (${timeZone})`,
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
        });
    }

    // Keep embeds sorted by day title
    embeds.sort((a, b) => a.title.localeCompare(b.title));
    return embeds;
}
