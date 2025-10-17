import {
    fetchSchedule,
    formatTimeHHMM,
    localDateKey,
    getTeamName,
    getGameDate,
} from './common.js';
import { DEFAULT_SEASON } from '../../env.js';

export async function fetchTodayGames({ seasoncode = DEFAULT_SEASON, timeZone = 'Europe/Athens' } = {}) {
    const data = await fetchSchedule(seasoncode);

    // Handle common shapes
    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const today = new Date();
    const todayKey = localDateKey(today, timeZone);

    const gamesToday = [];
    for (const g of games) {
        const when = getGameDate(g, timeZone);
        if (!when) continue;
        if (localDateKey(when, timeZone) !== todayKey) continue;

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');
        gamesToday.push({ date: when, home, away, _raw: g });
    }

    gamesToday.sort((a, b) => a.date - b.date);
    return { gamesToday };
}

export function buildTodayEmbed({ gamesToday, timeZone = 'Europe/Athens' }) {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(now);

    if (!gamesToday.length) {
        return [
            {
                title: `EuroLeague — Today (${dateStr})`,
                description: 'No EuroLeague games today.',
                timestamp: new Date().toISOString(),
            },
        ];
    }

    const lines = gamesToday.map((g) => {
        const time = formatTimeHHMM(g.date, timeZone);
        return `🕒 **${time}** — ${g.home} vs ${g.away}`;
    });

    return [
        {
            title: `🏀 EuroLeague — Today (${dateStr})`,
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
        },
    ];
}
