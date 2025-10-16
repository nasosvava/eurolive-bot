// src/api/playerStats.js
// Unified player stats loader that works with EuroLeague API v3 (E/U)
// and the 3Steps datasets for other competitions/leagues.

import { getSeasonTraditionalPlayers } from './v3.js';
import { fetchThreeStepsClubStats, fetchThreeStepsClubPlayers } from './threeStepsGeneric.js';
import { resolveSeasonAndCompetition } from '../utils/season.js';
import { competitionLeagueSlug, competitionLabel } from '../config/competitions.js';

const CACHE = new Map(); // key -> { at, data }
const TTL_MS = 60_000;

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const pct = (value) => Number.isFinite(value) ? value : 0;

function cacheKey(competitionCode, seasonCode) {
    return `${competitionCode}:${seasonCode || '__current__'}`;
}

function withCache(key, loader) {
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && now - hit.at < TTL_MS) return hit.data;
    return loader().then((data) => {
        CACHE.set(key, { at: now, data });
        return data;
    });
}

function ensureTeamObject(team = {}) {
    if (team && typeof team === 'object') return team;
    return {};
}

function normalizeV3Player(row) {
    if (!row) return null;
    const playerObj = row.player || {};
    const teamObj = ensureTeamObject(playerObj.team);
    const name = playerObj.name || row.playerName || 'Unknown';
    const gamesPlayed = num(row.gamesPlayed);

    return {
        source: 'v3',
        ...row,
        player: {
            ...playerObj,
            name,
            team: {
                ...teamObj,
            },
        },
        playerName: name,
        teamName: teamObj.name || row.teamName || row.clubNames || 'N/A',
        gamesPlayed,
        minutesPlayed: num(row.minutesPlayed),
        pointsScored: num(row.pointsScored ?? row.points),
        totalRebounds: num(row.totalRebounds ?? (row.offensiveRebounds ?? 0) + (row.defensiveRebounds ?? 0)),
    };
}

function computePirFromEntry(entry = {}) {
    const points = num(entry.points);
    const rebounds = num(entry.offRebounds) + num(entry.defRebounds);
    const assists = num(entry.assists);
    const steals = num(entry.steals);
    const blocks = num(entry.blocks);
    const foulsDrawn = num(entry.foulsRv);
    const madeTwo = num(entry.madeTwo);
    const attTwo = num(entry.attemptedTwo);
    const madeThree = num(entry.madeThree);
    const attThree = num(entry.attemptedThree);
    const madeFt = num(entry.madeFt);
    const attFt = num(entry.attemptedFt);
    const turnovers = num(entry.turnovers);
    const blocksAgainst = num(entry.blocksAg);
    const foulsCommited = num(entry.fouls);

    const madeShots = madeTwo + madeThree + madeFt;
    const missedShots = Math.max(0, (attTwo - madeTwo) + (attThree - madeThree) + (attFt - madeFt));

    return points +
        rebounds +
        assists +
        steals +
        blocks +
        foulsDrawn +
        madeShots -
        missedShots -
        turnovers -
        blocksAgainst -
        foulsCommited;
}

function normalizeThreeStepsPlayer(entry = {}, context = {}) {
    const {
        clubId,
        teamName,
        shortName,
        primaryColor,
        secondaryColor,
        imageUrl,
        competitionId,
        season,
        league,
    } = context;

    const first = (entry.firstname || '').trim();
    const last = (entry.surname || '').trim();
    const displayName = `${first} ${last}`.trim() || entry.id || 'Unknown';
    const gamesPlayed = num(entry.gamesPlayed);

    const colors = {
        primaryColor: primaryColor || context.primaryColor || '#0099ff',
        secondaryColor: secondaryColor || context.secondaryColor || '#222222',
    };

    const teamObj = {
        name: teamName || context.club || 'Unknown',
        code: shortName || clubId || null,
        tvCodes: shortName || null,
        colors,
        teamColors: colors,
        imageUrl: imageUrl || null,
    };

    const minutesPlayed = num(entry.mins);
    const madeTwo = num(entry.madeTwo);
    const attTwo = num(entry.attemptedTwo);
    const madeThree = num(entry.madeThree);
    const attThree = num(entry.attemptedThree);
    const madeFt = num(entry.madeFt);
    const attFt = num(entry.attemptedFt);

    const player = {
        source: 'threeSteps',
        id: entry.id,
        playerId: entry.id,
        playerSlug: entry.id,
        player: {
            name: displayName,
            firstName: first,
            lastName: last,
            team: teamObj,
            slug: entry.id,
        },
        playerName: displayName,
        team: teamObj,
        teamName: teamObj.name,
        teamCode: shortName || clubId || null,
        clubNames: teamObj.name,
        gamesPlayed,
        minutesPlayed,
        pointsScored: num(entry.points),
        points: num(entry.points),
        twoPointersMade: madeTwo,
        twoPointersAttempted: attTwo,
        threePointersMade: madeThree,
        threePointersAttempted: attThree,
        freeThrowsMade: madeFt,
        freeThrowsAttempted: attFt,
        offensiveRebounds: num(entry.offRebounds),
        defensiveRebounds: num(entry.defRebounds),
        totalRebounds: num(entry.offRebounds) + num(entry.defRebounds),
        assists: num(entry.assists),
        steals: num(entry.steals),
        blocks: num(entry.blocks),
        turnovers: num(entry.turnovers),
        foulsCommited: num(entry.fouls),
        foulsDrawn: num(entry.foulsRv),
        foulsReceived: num(entry.foulsRv),
        blocksAgainst: num(entry.blocksAg),
        usgRate: pct(entry.usgRate),
        assistPct: pct(entry.assistPct),
        trnPct: pct(entry.trnPct),
        orbPct: pct(entry.orbPct),
        drbPct: pct(entry.drbPct),
        rbPct: pct(entry.rbPct),
        teamPoints: num(entry.teamPoints),
        oppPoints: num(entry.oppPoints),
        teamPossessionsNet: num(entry.teamPossessionsNet),
        oppPossessionsNet: num(entry.oppPossessionsNet),
        possessions: num(entry.possessions),
        overallRating: num(entry.overallRating, null),
        pir: computePirFromEntry(entry),
        primaryColor: colors.primaryColor,
        secondaryColor: colors.secondaryColor,
        imageUrl: imageUrl || null,
        competitionId,
        season,
        league,
        clubId,
    };

    player.teamColors = colors;
    player.clubColors = colors;
    if (player.player?.team) {
        player.player.team.colors = colors;
        player.player.team.teamColors = colors;
        if (imageUrl) player.player.team.imageUrl = imageUrl;
    }

    return player;
}

function normalizeThreeStepsTeam(entry = {}, payloadMeta = {}) {
    return {
        clubId: entry.clubId || payloadMeta.id || null,
        teamName: entry.teamName || payloadMeta.club || 'Unknown',
        shortName: entry.shortName || null,
        primaryColor: entry.primaryColor || payloadMeta.primaryColor || null,
        secondaryColor: entry.secondaryColor || payloadMeta.secondaryColor || null,
        imageUrl: entry.imageUrl || payloadMeta.image || null,
        wins: num(entry.wins),
        games: num(entry.games),
    };
}

async function loadThreeStepsPlayers({ league, seasonCode, competitionCode }) {
    const base = await fetchThreeStepsClubStats({ league, seasonInput: seasonCode });
    const teams = Array.isArray(base?.data?.teams) ? base.data.teams : [];
    const players = [];

    for (const team of teams) {
        const clubId = team?.clubId || team?.id;
        if (!clubId) continue;
        try {
            const { data: payload } = await fetchThreeStepsClubPlayers({
                league,
                clubId,
                seasonInput: seasonCode,
            });

            const teamContext = {
                clubId,
                teamName: team?.teamName || payload?.club || 'Unknown',
                shortName: team?.shortName || payload?.shortName || null,
                primaryColor: team?.primaryColor || payload?.primaryColor || null,
                secondaryColor: team?.secondaryColor || payload?.secondaryColor || null,
                imageUrl: team?.imageUrl || payload?.image || null,
                competitionId: payload?.competitionId || base?.competitionId || null,
                season: payload?.season || base?.data?.season || null,
                league: payload?.league || league,
            };

            const mapped = (Array.isArray(payload?.players) ? payload.players : [])
                .map((player) => normalizeThreeStepsPlayer(player, teamContext))
                .filter(Boolean);
            players.push(...mapped);
        } catch (err) {
            console.warn(`[playerStats] failed to load players for ${league}/${clubId}:`, err.message);
        }
    }

    const season = base?.data?.season || seasonCode;
    const competitionId = base?.data?.competitionId || null;
    const normalizedTeams = teams.map((team) => normalizeThreeStepsTeam(team, base?.data));

    return {
        players,
        season,
        competitionCode,
        competitionId,
        teams: normalizedTeams,
        league,
    };
}

async function loadV3Players({ seasonCode, competitionCode }) {
    const raw = await getSeasonTraditionalPlayers({
        seasonCode,
        competitionCode,
        size: 1000,
    });
    const mapped = (Array.isArray(raw) ? raw : []).map(normalizeV3Player).filter(Boolean);
    return {
        players: mapped,
        season: seasonCode,
        competitionCode,
        competitionId: null,
        teams: [],
        league: competitionLabel(competitionCode),
    };
}

export async function fetchCompetitionPlayers({
    seasonCode,
    competitionCode,
} = {}) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });

    const key = cacheKey(competition, season);
    return withCache(key, async () => {
        if (competition === 'E' || competition === 'U') {
            return loadV3Players({ seasonCode: season, competitionCode: competition });
        }

        const league = competitionLeagueSlug(competition);
        if (!league) {
            return {
                players: [],
                season,
                competitionCode: competition,
                competitionId: null,
                teams: [],
                league: null,
            };
        }

        return loadThreeStepsPlayers({ league, seasonCode: season, competitionCode: competition });
    });
}
