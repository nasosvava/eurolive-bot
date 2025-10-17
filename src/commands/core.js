// src/commands/core.js

export const coreCommands = [
    {
        name: 'standings',
        description: 'Show EuroLeague standings (season/phase).',
        options: [
            { type: 3, name: 'seasoncode', description: 'Season code (e.g., E2025)', required: false },
            {
                type: 3,
                name: 'phasecode',
                description: 'Phase code (RS, PO, FF)',
                required: false,
                choices: [
                    { name: 'Regular Season', value: 'RS' },
                    { name: 'Playoffs', value: 'PO' },
                    { name: 'Final Four', value: 'FF' },
                ],
            },
        ],
    },

    { name: 'today', description: 'Show EuroLeague games happening today (times shown in Greece).' },
    { name: 'week', description: 'Show EuroLeague games for the current week. Finished games show scores.' },

    {
        name: 'live',
        description: 'Show live EuroLeague games and their current scores.',
        options: [
            { type: 3, name: 'game', description: 'Pick a specific live game (autocomplete).', required: false, autocomplete: true },
            { type: 3, name: 'team', description: 'Filter by team name (deprecated; prefer the game picker).', required: false },
        ],
    },

    {
        name: 'previous-game',
        description: 'Show previous games for a team (current season) with scores.',
        options: [
            { type: 3, name: 'team', description: 'Team name (autocomplete).', required: true, autocomplete: true },
            { type: 4, name: 'limit', description: 'How many recent games to show (1–20, default 10)', required: false, min_value: 1, max_value: 20 },
        ],
    },
    {
        name: 'font-test',
        description: 'Internal: draw text directly with Skia to verify font',
    },
    {
        name: 'chart-test',
        description: 'Internal: render a Chart.js bar with Greek labels',
    }
];
