// src/commands/players.js

const seasonCodeOption = () => ({
    type: 3,
    name: 'seasoncode',
    description: 'Season year (e.g., 2025).',
    required: false,
    autocomplete: true,
});

import { competitionChoices } from '../config/competitions.js';

const competitionOption = () => ({
    type: 3,
    name: 'competition',
    description: 'Competition / league code.',
    required: false,
    choices: competitionChoices(),
});

export const playerCommands = [
    {
        name: 'players-pir',
        description: "PIR tools: Top leaders or a specific player's PIR.",
        options: [
            {
                type: 1, // SUB_COMMAND
                name: 'leaders',
                description: 'Top 20 players by PIR (current season).',
            },
            {
                type: 1, // SUB_COMMAND
                name: 'player',
                description: 'Show PIR for a specific player (choose season, or list all seasons).',
                options: [
                    { type: 3, name: 'player', description: 'Player name (e.g., Will Clyburn)', required: true, autocomplete: true },
                    { ...seasonCodeOption(), description: 'Season year (e.g., 2025). If omitted and all_seasons=false, uses current season.' },
                    competitionOption(),
                    { type: 5, name: 'all_seasons', description: 'List this player\'s PIR for each season.', required: false },
                ],
            },
        ],
    },
    {
        name: 'players-ratings',
        description: 'Hack a Stat individual Off/Def/Net ratings plus team season ratings.',
        options: [
            { type: 3, name: 'player', description: 'Player name (autocomplete).', required: true, autocomplete: true },
            seasonCodeOption(),
            competitionOption(),
        ],
    },
    {
        name: 'player-insight',
        description: 'Detailed analytics for a player (supports EuroLeague, EuroCup, and other 3Steps leagues).',
        options: [
            { type: 3, name: 'player', description: 'Player name (autocomplete).', required: true, autocomplete: true },
            { ...competitionOption(), required: true },
            { type: 3, name: 'season', description: 'Season (e.g., 2025 or euroleague-2026).', required: false, autocomplete: true },
            { type: 3, name: 'team', description: 'Team name (optional, autocomplete).', required: false, autocomplete: true },
        ],
    },

    {
        name: 'players-top-scorers',
        description: 'Top 20 players by average points per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-rebounders',
        description: 'Top 20 players by average rebounds per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-assists',
        description: 'Top 20 players by average assists per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-steals',
        description: 'Top 20 players by average steals per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-blocks',
        description: 'Top 20 players by blocks per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-turnovers',
        description: 'Top 20 players by turnovers per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-fouls',
        description: 'Top 20 players by fouls drawn per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-off-reb',
        description: 'Top 20 players by offensive rebounds per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-def-reb',
        description: 'Top 20 players by defensive rebounds per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'players-top-3pt-pct',
        description: 'Top 20 players by 3PT% (per game).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum 3PA per game (default 1)', required: false, min_value: 0, max_value: 30 },
        ],
    },
    {
        name: 'players-top-fg-pct',
        description: 'Top 20 players by FG% (computed from 2P & 3P; per game).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_fga', description: 'Minimum FGA per game (default 2)', required: false, min_value: 0, max_value: 50 },
        ],
    },
    {
        name: 'players-top-ft-pct',
        description: 'Top 20 players by FT% (per game).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_fta', description: 'Minimum FTA per game (default 2)', required: false, min_value: 0, max_value: 50 },
        ],
    },
    {
        name: 'players-top-minutes',
        description: 'Top 20 players by minutes per game.',
        options: [seasonCodeOption(), competitionOption()],
    },
];
