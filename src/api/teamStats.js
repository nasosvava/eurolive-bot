// src/api/teamStats.js
import { EUROLEAGUE_SEASON_CODE } from '../env.js';
import {
    getTeamsTraditionalStats,
    getTeamsOpponentsTraditionalStats,
} from './v3.js';
import { fetchStandings } from '../v1/standings/index.js';
import { resolveSeasonAndCompetition } from '../utils/season.js';
import { enrichTeamVisuals } from './clubMetadata.js';
import { fetchThreeStepsClubStats } from './threeStepsGeneric.js';

const CACHE = new Map(); // key (competition:season) -> { at, data }
const TTL_MS = 60_000;

const DEFAULT_COMPETITION_PHASE = 'RS';

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeName = (value) => {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '');
};

const normalizeHexColor = (value) => {
    if (!value) return null;
    let str = String(value).trim();
    if (!str) return null;
    if (str.startsWith('rgb')) return null;
    if (/^0x/i.test(str)) str = str.replace(/^0x/i, '#');
    if (!str.startsWith('#')) str = `#${str}`;
    if (/^#[0-9a-f]{3}$/i.test(str)) {
        str = `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`;
    }
    if (!/^#[0-9a-f]{6}$/i.test(str)) return null;
    return str.toUpperCase();
};

const pickColor = (teamObj, candidates) => {
    for (const candidate of candidates) {
        const color = normalizeHexColor(candidate);
        if (color) return color;
    }
    return null;
};

const normalizeLookupKey = (value) => {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '');
};

function applyThreeStepsOverlay(teams = [], overlayTeams = []) {
    if (!teams.length || !overlayTeams.length) return;

    const overlayMap = new Map();
    const overlayEntries = overlayTeams.map((entry) => {
        const candidates = [
            entry.clubId,
            entry.teamId,
            entry.shortName,
            entry.teamName,
        ];
        const keys = candidates
            .map((candidate) => normalizeLookupKey(candidate))
            .filter(Boolean);
        for (const key of keys) {
            if (!overlayMap.has(key)) overlayMap.set(key, entry);
        }
        return { entry, keys };
    });

    for (const team of teams) {
        const keys = [
            team.clubId,
            team.teamCode,
            team.shortName,
            team.teamName,
        ];
        let overlay = null;
        for (const candidate of keys) {
            const key = normalizeLookupKey(candidate);
            if (key && overlayMap.has(key)) {
                overlay = overlayMap.get(key);
                break;
            }
        }
        if (!overlay) {
            const teamKeys = keys
                .map((candidate) => normalizeLookupKey(candidate))
                .filter(Boolean);
            for (const norm of teamKeys) {
                const match = overlayEntries.find(({ keys }) =>
                    keys.some((key) => key.includes(norm) || norm.includes(key))
                );
                if (match) {
                    overlay = match.entry;
                    break;
                }
            }
        }
        if (!overlay) continue;

        if (overlay.games != null) team.games = num(overlay.games);
        if (overlay.wins != null) team.wins = num(overlay.wins);
        if (overlay.defeats != null) team.losses = num(overlay.defeats);

        const points =
            num(overlay.madeTwo) * 2 +
            num(overlay.madeThree) * 3 +
            num(overlay.madeFt);
        const oppPoints =
            num(overlay.oppMadeTwo) * 2 +
            num(overlay.oppMadeThree) * 3 +
            num(overlay.oppMadeFt);
        const offPoss = num(overlay.offPossessions);
        const defPoss = num(overlay.defPossessions);

        if (offPoss > 0) team.offRating = (points / offPoss) * 100;
        if (defPoss > 0) team.defRating = (oppPoints / defPoss) * 100;
        if (overlay.overallRating != null) team.overallRating = num(overlay.overallRating);

        if (overlay.avgPointsFor != null) team.points = num(overlay.avgPointsFor);
        if (overlay.avgPointsAgainst != null) team.oppPoints = num(overlay.avgPointsAgainst);
    }
}

const extractTeamColors = (teamObj = {}) => {
    const containers = [
        teamObj,
        teamObj.colors,
        teamObj.teamColors,
        teamObj.teamcolors,
        teamObj.clubColors,
        teamObj.brandColors,
        teamObj.colours,
        teamObj.palette,
        teamObj.colourPalette,
    ].filter(Boolean);

    const primaryCandidates = [];
    const secondaryCandidates = [];

    for (const src of containers) {
        primaryCandidates.push(
            src.primaryColor,
            src.primary_colour,
            src.primaryColour,
            src.primary_color,
            src.primary,
            src.main,
            src.mainColor,
            src.mainColour,
            src.colorPrimary,
            src.colourPrimary,
            src.brandPrimary,
            src.hex,
            src.hex1,
            src.color1,
            src.colour1,
        );
        secondaryCandidates.push(
            src.secondaryColor,
            src.secondary_colour,
            src.secondaryColour,
            src.secondary_color,
            src.secondary,
            src.alt,
            src.altColor,
            src.altColour,
            src.colorSecondary,
            src.colourSecondary,
            src.brandSecondary,
            src.hex2,
            src.color2,
            src.colour2,
        );
    }

    const primaryColor = pickColor(teamObj, primaryCandidates);
    const secondaryColor = pickColor(teamObj, secondaryCandidates);
    return { primaryColor, secondaryColor };
};

const extractTeamImage = (teamObj = {}) => {
    const candidates = [
        teamObj.imageUrl,
        teamObj.logoUrl,
        teamObj.logo,
        teamObj.crest,
        teamObj.crestUrl,
        teamObj.shield,
        teamObj.badge,
        teamObj.badgeUrl,
        teamObj.image,
        teamObj.photo,
        teamObj.media?.logo,
        teamObj.media?.image,
    ];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const url = String(candidate).trim();
        if (!url) continue;
        if (/^(https?:)?\/\//i.test(url)) return url.startsWith('http') ? url : `https:${url}`;
    }
    return null;
};

function mapThreeStepsTeam(entry = {}) {
    const shortName = entry.shortName || entry.clubId || entry.teamName || 'TEAM';
    const teamCode = (entry.clubId || shortName || '').toUpperCase();
    const offPossessions = num(entry.offPossessions ?? entry.possessionsOffense);
    const defPossessions = num(entry.defPossessions ?? entry.possessionsDefense);

    const pointsFor = num(entry.pointsFor ?? entry.points ?? 0);
    const pointsAgainst = num(entry.pointsAgainst ?? entry.oppPoints ?? 0);

    return {
        teamCode,
        teamName: entry.teamName || shortName,
        shortName,
        clubId: entry.clubId || teamCode,
        primaryColor: entry.primaryColor || null,
        secondaryColor: entry.secondaryColor || null,
        imageUrl: entry.logoUrl || entry.imageUrl || null,
        games: num(entry.games),
        wins: num(entry.wins),
        losses: num(entry.defeats ?? (num(entry.games) - num(entry.wins))),
        ties: 0,
        rank: null,
        secondsPlayed: num(entry.secondsPlayed),

        madeFt: num(entry.madeFt),
        attemptedFt: num(entry.attemptedFt),
        oppMadeFt: num(entry.oppMadeFt),
        oppAttemptedFt: num(entry.oppAttemptedFt),

        madeTwo: num(entry.madeTwo),
        attemptedTwo: num(entry.attemptedTwo),
        oppMadeTwo: num(entry.oppMadeTwo),
        oppAttemptedTwo: num(entry.oppAttemptedTwo),

        madeThree: num(entry.madeThree),
        attemptedThree: num(entry.attemptedThree),
        oppMadeThree: num(entry.oppMadeThree),
        oppAttemptedThree: num(entry.oppAttemptedThree),

        offRebounds: num(entry.offRebounds),
        defRebounds: num(entry.defRebounds),
        oppOffRebounds: num(entry.oppOffRebounds),
        oppDefRebounds: num(entry.oppDefRebounds),

        assists: num(entry.assists),
        steals: num(entry.steals),
        blocks: num(entry.blocks),
        turnovers: num(entry.turnovers),
        fouls: num(entry.fouls),

        oppAssists: num(entry.oppAssists),
        oppSteals: num(entry.oppSteals),
        oppBlocks: num(entry.oppBlocks),
        oppTurnovers: num(entry.oppTurnovers),
        oppFouls: num(entry.oppFouls),

        points: pointsFor,
        oppPoints: pointsAgainst,

        offPossessions,
        defPossessions,
        offPlays: num(entry.offPlays ?? offPossessions),
        defPlays: num(entry.defPlays ?? defPossessions),

        offRating: entry.offRating != null ? num(entry.offRating) : null,
        defRating: entry.defRating != null ? num(entry.defRating) : null,
    };
}

function computePossessions(stats) {
    if (!stats) return 0;
    const twoAtt = num(stats.twoPointersAttempted);
    const threeAtt = num(stats.threePointersAttempted);
    const fta = num(stats.freeThrowsAttempted);
    const orb = num(stats.offensiveRebounds);
    const tov = num(stats.turnovers);
    return twoAtt + threeAtt + 0.44 * fta - orb + tov;
}

function pickRecord(records, name) {
    if (!records?.length) return null;
    const key = normalizeName(name);
    let best = null;
    for (const record of records) {
        if (!record?._normName) continue;
        if (record._normName === key) return record;
        if (record._normName.includes(key) || key.includes(record._normName)) {
            if (!best || record._normName.length < best._normName.length) best = record;
        }
    }
    return best;
}

function buildTeamEntry({
    teamPer,
    teamTotal,
    opponentPer,
    record,
}) {
    const code = teamPer.team?.code || teamPer.team?.tvCodes?.split?.(';')?.[0] || teamPer.team?.name || 'UNK';
    const name = teamPer.team?.name || teamPer.team?.clubName || code;
    const shortName = teamPer.team?.tvCodes?.split?.(';')?.[0] ||
        teamPer.team?.alias ||
        code;

    const games = num(teamPer.gamesPlayed) || num(teamTotal.gamesPlayed);
    const minutesPerGame = num(teamPer.minutesPlayed) || 40;
    const minutesTotal = num(teamTotal.minutesPlayed, minutesPerGame * games);

    const offPoss = computePossessions(teamPer);
    const defPoss = computePossessions(opponentPer);

    const { primaryColor, secondaryColor } = extractTeamColors(teamPer.team);
    const imageUrl = extractTeamImage(teamPer.team);

    return {
        teamCode: code,
        teamName: name,
        shortName,
        clubId: code,
        primaryColor,
        secondaryColor,
        imageUrl,
        games,
        wins: num(record?.wins),
        losses: num(record?.losses),
        ties: num(record?.ties),
        rank: record?.rank ?? null,
        secondsPlayed: minutesTotal * 60,

        madeFt: num(teamPer.freeThrowsMade),
        attemptedFt: num(teamPer.freeThrowsAttempted),
        oppMadeFt: num(opponentPer?.freeThrowsMade),
        oppAttemptedFt: num(opponentPer?.freeThrowsAttempted),

        madeTwo: num(teamPer.twoPointersMade),
        attemptedTwo: num(teamPer.twoPointersAttempted),
        oppMadeTwo: num(opponentPer?.twoPointersMade),
        oppAttemptedTwo: num(opponentPer?.twoPointersAttempted),

        madeThree: num(teamPer.threePointersMade),
        attemptedThree: num(teamPer.threePointersAttempted),
        oppMadeThree: num(opponentPer?.threePointersMade),
        oppAttemptedThree: num(opponentPer?.threePointersAttempted),

        offRebounds: num(teamPer.offensiveRebounds),
        defRebounds: num(teamPer.defensiveRebounds),
        oppOffRebounds: num(opponentPer?.offensiveRebounds),
        oppDefRebounds: num(opponentPer?.defensiveRebounds),

        assists: num(teamPer.assists),
        steals: num(teamPer.steals),
        blocks: num(teamPer.blocks),
        turnovers: num(teamPer.turnovers),
        fouls: num(teamPer.foulsCommited),

        oppAssists: num(opponentPer?.assists),
        oppSteals: num(opponentPer?.steals),
        oppBlocks: num(opponentPer?.blocks),
        oppTurnovers: num(opponentPer?.turnovers),
        oppFouls: num(opponentPer?.foulsCommited),

        points: num(teamPer.pointsScored),
        oppPoints: num(opponentPer?.pointsScored),

        offPossessions: offPoss,
        defPossessions: defPoss,
        offPlays: offPoss,
        defPlays: defPoss,
    };
}

async function loadRecords(season) {
    try {
        const data = await fetchStandings(season);
        const rows = data?.rows ?? [];
        return rows.map((row) => ({
            wins: num(row.wins),
            losses: num(row.losses),
            ties: num(row.ties),
            rank: num(row.rank),
            name: row.team,
            _normName: normalizeName(row.team),
        }));
    } catch {
        return [];
    }
}

export async function fetchTeamStats(seasonCode = EUROLEAGUE_SEASON_CODE, competitionCode) {
    const { seasonCode: resolvedSeason, competitionCode: resolvedCompetition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });

    const cacheKey = `${resolvedCompetition}:${resolvedSeason}`;
    const cached = CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.at < TTL_MS) return cached.data;

    if (!['E', 'U'].includes(resolvedCompetition)) {
        const league = resolvedCompetition.toLowerCase();
        const { data: threeStepsData } = await fetchThreeStepsClubStats({
            league,
            seasonInput: resolvedSeason,
        });
        const mappedTeams = (threeStepsData?.teams ?? []).map(mapThreeStepsTeam);
        const data = {
            season: threeStepsData?.season ?? resolvedSeason,
            competition: resolvedCompetition,
            competitionId: threeStepsData?.competitionId ?? null,
            teams: mappedTeams,
        };
        CACHE.set(cacheKey, { at: now, data });
        return data;
    }

    const [
        perGame,
        accumulated,
        opponentPerGame,
        records,
    ] = await Promise.all([
        getTeamsTraditionalStats({
            seasonCode: resolvedSeason,
            competitionCode: resolvedCompetition,
            seasonMode: 'Single',
            statisticMode: 'PerGame',
            phaseTypeCode: DEFAULT_COMPETITION_PHASE,
        }),
        getTeamsTraditionalStats({
            seasonCode: resolvedSeason,
            competitionCode: resolvedCompetition,
            seasonMode: 'Single',
            statisticMode: 'Accumulated',
            phaseTypeCode: DEFAULT_COMPETITION_PHASE,
        }),
        getTeamsOpponentsTraditionalStats({
            seasonCode: resolvedSeason,
            competitionCode: resolvedCompetition,
            seasonMode: 'Single',
            statisticMode: 'PerGame',
            phaseTypeCode: DEFAULT_COMPETITION_PHASE,
        }),
        loadRecords(resolvedSeason),
    ]);

    const perTeams = perGame?.teams ?? [];
    const totalTeams = accumulated?.teams ?? [];
    const oppTeams = opponentPerGame?.teams ?? [];

    const totalsByCode = new Map(totalTeams.map((item) => [item.team?.code, item]));
    const oppByCode = new Map(oppTeams.map((item) => [item.team?.code, item]));

    const teams = perTeams.map((teamPer) => {
        const code = teamPer.team?.code || teamPer.team?.tvCodes?.split?.(';')?.[0];
        const teamTotal = totalsByCode.get(code) ?? teamPer;
        const opponent = oppByCode.get(code) ?? {};
        const record = pickRecord(records, teamPer.team?.name);
        return buildTeamEntry({ teamPer, teamTotal, opponentPer: opponent, record });
    });

    if (['E', 'U'].includes(resolvedCompetition)) {
        const leagueSlug = resolvedCompetition === 'E' ? 'euroleague' : 'eurocup';
        try {
            const { data: threeStepsData } = await fetchThreeStepsClubStats({
                league: leagueSlug,
                seasonInput: resolvedSeason,
            });
            applyThreeStepsOverlay(teams, threeStepsData?.teams ?? []);
        } catch (err) {
            console.warn('[teamStats] threeSteps overlay failed:', err?.message || err);
        }
    }

    const data = {
        season: resolvedSeason,
        competition: resolvedCompetition,
        teams,
    };

    await enrichTeamVisuals(teams, resolvedCompetition);

    CACHE.set(cacheKey, { at: now, data });
    return data;
}

