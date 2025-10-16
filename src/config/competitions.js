// src/config/competitions.js
// Central definition for supported competitions/leagues across commands.

export const COMPETITIONS = [
    { code: 'E', label: 'EuroLeague', league: 'euroleague' },
    { code: 'U', label: 'EuroCup', league: 'eurocup' },
    { code: 'NBA', label: 'NBA', league: 'nba' },
    { code: 'ESAKE', label: 'ESAKE', league: 'esake' },
    { code: 'BUNDESLIGA', label: 'Bundesliga', league: 'bundesliga' },
    { code: 'BCL', label: 'Basketball Champions League', league: 'bcl' },
    { code: 'LNB', label: 'LNB', league: 'lnb' },
    { code: 'TBF', label: 'TBF', league: 'tbf' },
    { code: 'EUROBASKET', label: 'EuroBasket', league: 'eurobasket' },
    { code: 'ACB', label: 'ACB', league: 'acb' },
    { code: 'LBA', label: 'LBA', league: 'lba' },
];

export function competitionChoices() {
    return COMPETITIONS.map((entry) => ({
        name: entry.label,
        value: entry.code,
    }));
}

export function findCompetition(code) {
    if (!code) return null;
    const upper = String(code).trim().toUpperCase();
    return COMPETITIONS.find((entry) => entry.code === upper) || null;
}

export function competitionLabel(code) {
    const match = findCompetition(code);
    if (match) return match.label;
    if (!code) return 'Unknown';
    return String(code).trim();
}

export function competitionLeagueSlug(code) {
    const match = findCompetition(code);
    if (match?.league) return match.league;
    if (!code) return null;
    return String(code).trim().toLowerCase();
}
