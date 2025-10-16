// src/commands/util.js

export const utilCommands = [
    { name: 'ping', description: 'Health check.' },
    {
        name: 'league-insight',
        description: 'Show league data from the 3Steps feeds.',
        options: [
            {
                type: 3,
                name: 'competition',
                description: 'Competition to query',
                required: true,
                choices: [
                    { name: 'EuroLeague', value: 'euroleague' },
                    { name: 'EuroCup', value: 'eurocup' },
                    { name: 'NBA', value: 'nba' },
                    { name: 'ESAKE', value: 'esake' },
                    { name: 'Bundesliga', value: 'bundesliga' },
                    { name: 'Basketball Champions League', value: 'bcl' },
                    { name: 'LNB', value: 'lnb' },
                    { name: 'TBF', value: 'tbf' },
                    { name: 'EuroBasket', value: 'eurobasket' },
                    { name: 'ACB', value: 'acb' },
                    { name: 'LBA', value: 'lba' },
                ],
            },
            {
                type: 3,
                name: 'dataset',
                description: 'Which dataset to show',
                required: true,
                choices: [
                    { name: 'Best Players', value: 'best_players' },
                    { name: 'Club Stats', value: 'club_stats' },
                    { name: 'Standings', value: 'standings' },
                ],
            },
            {
                type: 3,
                name: 'season_id',
                description: 'Competition ID / season key (optional)',
                required: false,
            },
        ],
    },
];
