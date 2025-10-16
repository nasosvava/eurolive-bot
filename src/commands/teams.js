// src/commands/teams.js

const seasonCodeOption = () => ({
    type: 3,
    name: 'seasoncode',
    description: 'Season year (e.g., 2025).',
    required: false,
    autocomplete: true,
});

const seasonOption = () => ({
    type: 3,
    name: 'season',
    description: 'Season year (e.g., 2025).',
    required: false,
    autocomplete: true,
});

import { competitionChoices } from '../config/competitions.js';

const competitionOption = (required = false) => ({
    type: 3,
    name: 'competition',
    description: 'Competition / league code.',
    required,
    choices: competitionChoices(),
});

export const teamCommands = [
    {
        name: 'teams-top-offense',
        description: 'Show the Top 10 teams by average points scored per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'teams-top-defense',
        description: 'Show the Top 10 defenses by fewest opponent points per game (current season).',
        options: [seasonCodeOption(), competitionOption()],
    },
    {
        name: 'teams-top-3pt-pct',
        description: 'Top 10 teams by 3-point percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total 3PA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-worst-3pt-pct',
        description: 'Bottom 10 teams by 3-point percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total 3PA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-top-2pt-pct',
        description: 'Top 10 teams by 2-point percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total 2PA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-worst-2pt-pct',
        description: 'Bottom 10 teams by 2-point percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total 2PA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-top-ft-pct',
        description: 'Top 10 teams by free-throw percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total FTA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-worst-ft-pct',
        description: 'Bottom 10 teams by free-throw percentage (current season).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 4, name: 'min_attempts', description: 'Minimum total FTA to be included (default 50)', required: false, min_value: 0, max_value: 5000 },
        ],
    },
    {
        name: 'teams-points-diff',
        description: 'Team point differentials (points scored minus allowed).',
        options: [
            seasonCodeOption(),
            competitionOption(),
            { type: 3, name: 'team', description: 'Filter to a specific team (autocomplete).', required: false, autocomplete: true },
        ],
    },
    {
        name: 'team-analytics',
        description: 'Deep analytics for a specific team (current season).',
        options: [
            competitionOption(true),
            { type: 3, name: 'team', description: 'Team name', required: true, autocomplete: true },
            seasonOption(),
        ],
    },
    {
        name: 'team-rating',
        description: 'Show a team\'s offensive and defensive rating (per 100 possessions).',
        options: [
            { type: 3, name: 'team', description: 'Team name', required: true, autocomplete: true },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-rating-chart',
        description: 'Charts Offensive Rating, Defensive Rating, and Pace for all teams.',
        options: [
            seasonOption(),
            competitionOption(),
            { type: 5, name: 'offensive', description: 'Include Offensive Rating chart', required: false },
            { type: 5, name: 'defensive', description: 'Include Defensive Rating chart', required: false },
            { type: 5, name: 'pace', description: 'Include Pace chart', required: false },
        ],
    },
    {
        name: 'teams-net-rating',
        description: 'All teams sorted by Net Rating (per 100 possessions), or a specific team\'s rank.',
        options: [
            { type: 3, name: 'team', description: 'Filter to a specific team', required: false, autocomplete: true },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-offensive-rating',
        description: 'All teams sorted by Offensive Rating (per 100 possessions), or a specific team\'s rank.',
        options: [
            { type: 3, name: 'team', description: 'Filter to a specific team', required: false, autocomplete: true },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-defensive-rating',
        description: 'All teams sorted by Defensive Rating (per 100 possessions), or a specific team\'s rank.',
        options: [
            { type: 3, name: 'team', description: 'Filter to a specific team', required: false, autocomplete: true },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-stat',
        description: 'Rank teams by any raw stat (made/attempted, rebounds, assists, TO, fouls, etc.).',
        options: [
            { type: 3, name: 'metric', description: 'Pick the stat to rank by', required: true, autocomplete: true },
            { type: 3, name: 'team', description: 'Show a specific team\'s rank/value', required: false, autocomplete: true },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-chart',
        description: 'Chart any raw stat for all teams (top N).',
        options: [
            { type: 3, name: 'metric', description: 'Stat to chart', required: true, autocomplete: true },
            { type: 4, name: 'limit', description: 'How many teams to show (5-20)', required: false, min_value: 5, max_value: 20 },
            seasonOption(),
            competitionOption(),
        ],
    },
    {
        name: 'teams-compare',
        description: 'Compare two teams on one or more metrics (side-by-side chart).',
        options: [
            competitionOption(true),
            { type: 3, name: 'team_a', description: 'First team (autocomplete)', required: true, autocomplete: true },
            { type: 3, name: 'team_b', description: 'Second team (autocomplete)', required: true, autocomplete: true },
            {
                type: 3,
                name: 'metrics',
                description: 'Comma-separated metrics (leave empty for ALL). Autocomplete helps per token.',
                required: false,
                autocomplete: true,
            },
        ],
    },
    {
        name: 'teams-odds',
        description: 'Fun win probability/odds between two teams (NOT for betting).',
        options: [
            {
                type: 3,
                name: 'team_a',
                description: 'Home team (autocomplete)',
                required: true,
                autocomplete: true,
            },
            {
                type: 3,
                name: 'team_b',
                description: 'Away team (autocomplete)',
                required: true,
                autocomplete: true,
            },
            {
                type: 3,
                name: 'venue',
                description: 'Choose venue (affects home-court advantage)',
                required: false,
                choices: [
                    { name: 'Team A Home', value: 'A' },
                    { name: 'Neutral Court', value: 'neutral' },
                ],
            },
        ],
    },
    {
        name: 'teams-season-compare',
        description: 'Compare all metrics for a team between two seasons (2020 to current).',
        options: [
            { type: 3, name: 'team', description: 'Team name', required: true, autocomplete: true },
            { type: 3, name: 'season_a', description: 'First season (e.g., 2021)', required: true, autocomplete: true },
            { type: 3, name: 'season_b', description: 'Second season (e.g., 2023)', required: true, autocomplete: true },
            competitionOption(),
        ],
    },
];
