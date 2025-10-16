// src/utils/season.js
import {
    DEFAULT_SEASON,
    EUROLEAGUE_COMPETITION_CODE,
    MIN_COMPETITION_YEAR,
} from '../env.js';

const YEAR_REGEX = /(20\d{2})/g;

function defaultSeasonParts() {
    const season = String(DEFAULT_SEASON || '').toUpperCase();
    const yearMatch = season.match(YEAR_REGEX);
    const year = yearMatch ? yearMatch[yearMatch.length - 1] : String(new Date().getUTCFullYear());
    const competition = season.replace(/[^\p{L}]/gu, '').slice(0, 1) || EUROLEAGUE_COMPETITION_CODE || 'E';
    return { year, competition };
}

export function normalizeCompetitionCode(input) {
    const raw = (input ?? '').toString().trim().toUpperCase();
    if (!raw) {
        const fallback = String(EUROLEAGUE_COMPETITION_CODE || '').trim().toUpperCase();
        if (fallback) return fallback;
        return defaultSeasonParts().competition;
    }
    if (raw === 'EUROLEAGUE') return 'E';
    if (raw === 'EUROCUP') return 'U';
    if (raw === 'E' || raw === 'U') return raw;
    return raw;
}

export function normalizeSeasonCode(seasonInput, competitionInput) {
    const trimmed = (seasonInput ?? '').toString().trim();
    const comp = normalizeCompetitionCode(competitionInput);
    if (!trimmed) {
        const { year } = defaultSeasonParts();
        return `${comp}${year}`;
    }

    const upper = trimmed.toUpperCase();

    const directMatch = upper.match(/^([A-Z]{1,})?(20\d{2})$/);
    if (directMatch) {
        const [, prefix, year] = directMatch;
        const prefixValue = prefix ?? (comp.length === 1 ? comp : '');
        return `${prefixValue}${year}`;
    }

    const yearMatch = upper.match(YEAR_REGEX);
    if (yearMatch && yearMatch.length) {
        const year = yearMatch[yearMatch.length - 1];
        const prefix = comp.length === 1 ? comp : '';
        return `${prefix}${year}`;
    }

    const prefix = comp.length === 1 ? comp : '';
    return `${prefix}${upper.replace(/[^0-9A-Z]/g, '')}`;
}

export function seasonYearFromInput(seasonInput) {
    const trimmed = (seasonInput ?? '').toString().toUpperCase();
    const yearMatch = trimmed.match(YEAR_REGEX);
    if (yearMatch && yearMatch.length) return yearMatch[yearMatch.length - 1];
    return defaultSeasonParts().year;
}

export function buildSeasonSuggestions({ competitionCode, limit = 25 } = {}) {
    const currentYear = new Date().getUTCFullYear();
    const maxYear = Math.max(currentYear + 1, Number(seasonYearFromInput(DEFAULT_SEASON)));
    const minYear = Number(MIN_COMPETITION_YEAR) || 2000;
    const years = [];

    for (let year = maxYear; year >= minYear; year -= 1) {
        years.push(String(year));
        if (years.length >= limit) break;
    }

    return years;
}

export function resolveSeasonAndCompetition({
    seasonInput,
    competitionInput,
} = {}) {
    const competitionCode = normalizeCompetitionCode(competitionInput);
    const seasonCode = normalizeSeasonCode(seasonInput, competitionCode);
    const seasonYear = seasonYearFromInput(seasonCode);
    return { seasonCode, competitionCode, seasonYear };
}
