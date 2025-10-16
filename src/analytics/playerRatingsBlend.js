import { computeIndividualRatings } from './playerRatings.js';
import { fetchThreeStepsBestPlayers } from './threeStepsClient.js';

const OFF_BASE_WEIGHT = 0.14; // proportion of base IND rating to keep
const DEF_DELTA_WEIGHT = 0.65; // amount of team-on delta to add onto base DRtg

function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function calcTeamRating(pointsPerGame, possessionsPerGame) {
    const pts = safeNumber(pointsPerGame);
    const poss = safeNumber(possessionsPerGame);
    if (pts == null || poss == null || poss <= 0) return null;
    return (pts / poss) * 100;
}

function calcPossessionsPerGame(totalPossessions, games) {
    const poss = safeNumber(totalPossessions);
    const g = safeNumber(games);
    if (poss == null || g == null || g <= 0) return null;
    return poss / g;
}

function teamBaseOff(team) {
    if (!team) return null;
    const pts = safeNumber(team.TePts);
    const poss = safeNumber(team.offPossessions);
    if (pts == null || poss == null || poss <= 0) return null;
    return (pts / poss) * 100;
}

function teamBaseDef(team) {
    if (!team) return null;
    const pts = safeNumber(team.oppStats?.pts);
    const poss = safeNumber(team.defPossessions);
    if (pts == null || poss == null || poss <= 0) return null;
    return (pts / poss) * 100;
}

function findThreeStepsEntry(players = [], playerRow) {
    if (!Array.isArray(players) || !playerRow) return null;
    const targets = new Set();
    const name = playerRow?.player?.name || playerRow?.playerName;
    if (name) {
        const trimmed = name.trim().toLowerCase();
        targets.add(trimmed);
        targets.add(trimmed.replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim());
        if (trimmed.includes(',')) {
            const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                targets.add(`${parts[1]} ${parts[0]}`.trim());
                targets.add(`${parts[0]} ${parts[1]}`.trim());
            }
        }
    }
    const first = playerRow?.player?.firstName || playerRow?.player?.first_name;
    const last = playerRow?.player?.lastName || playerRow?.player?.last_name;
    if (first || last) {
        targets.add(`${(first || '').trim().toLowerCase()} ${(last || '').trim().toLowerCase()}`.trim());
    }
    const code = playerRow?.player?.code || playerRow?.playerCode;
    if (code) targets.add(String(code).trim().toLowerCase());
    const alt = playerRow?.player?.slug || playerRow?.playerSlug;
    if (alt) targets.add(String(alt).trim().toLowerCase());

    for (const entry of players) {
        const eFirst = entry.firstname ? String(entry.firstname).trim().toLowerCase() : '';
        const eLast = entry.surname ? String(entry.surname).trim().toLowerCase() : '';
        const slug = entry.id ? String(entry.id).trim().toLowerCase() : '';
        const display = `${eFirst} ${eLast}`.trim();

        if (
            (eFirst && targets.has(eFirst)) ||
            (eLast && targets.has(eLast)) ||
            (display && targets.has(display)) ||
            (slug && targets.has(slug))
        ) {
            return entry;
        }
    }

    // fallback: loose comparison by surname match
    let lastName = playerRow?.player?.lastName;
    if (!lastName && typeof name === 'string') {
        lastName = name.split(',')[0]?.trim();
    }
    const lastLower = (lastName || '').trim().toLowerCase();
    if (lastLower) {
        return (
            players.find((entry) => String(entry.surname || '').trim().toLowerCase() === lastLower) ||
            null
        );
    }

    return null;
}

function buildTeamOnRatings(entry) {
    if (!entry) return null;
    const games = safeNumber(entry.gamesPlayed);
    const teamPoints = safeNumber(entry.teamPoints);
    const oppPoints = safeNumber(entry.oppPoints);
    const teamPossPg = calcPossessionsPerGame(entry.teamPossessionsNet, games);
    const oppPossPg = calcPossessionsPerGame(entry.oppPossessionsNet, games);
    const off = calcTeamRating(teamPoints, teamPossPg);
    const def = calcTeamRating(oppPoints, oppPossPg);
    if (off == null || def == null) return null;
    return {
        offRating: off,
        defRating: def,
        netRating: off - def,
        games,
        teamPoints,
        oppPoints,
        teamPossessions: teamPossPg,
        oppPossessions: oppPossPg,
    };
}

export async function computeIndividualRatingsBlended({
    playerRow,
    team,
    seasonCode,
}) {
    const base = computeIndividualRatings({ playerRow, team });
    let teamOn = null;
    let final = {
        offRating: base.offRating,
        defRating: base.defRating,
        netRating: base.netRating,
    };

    try {
        const best = await fetchThreeStepsBestPlayers(seasonCode);
        const entry = findThreeStepsEntry(best?.players, playerRow);
        teamOn = buildTeamOnRatings(entry);

        if (teamOn) {
            const baseTeamOff = teamBaseOff(base.team);
            const baseTeamDef = teamBaseDef(base.team);

            const blendedOff =
                base.offRating != null && teamOn.offRating != null
                    ? base.offRating * OFF_BASE_WEIGHT + teamOn.offRating * (1 - OFF_BASE_WEIGHT)
                    : base.offRating;

            const blendedDef =
                base.defRating != null && baseTeamDef != null && teamOn.defRating != null
                    ? base.defRating + DEF_DELTA_WEIGHT * (teamOn.defRating - baseTeamDef)
                    : base.defRating;

            final = {
                offRating: blendedOff,
                defRating: blendedDef,
                netRating:
                    blendedOff != null && blendedDef != null
                        ? blendedOff - blendedDef
                        : base.netRating,
            };
        }
    } catch (err) {
        console.warn('[players-ratings] 3Steps blend unavailable:', err);
    }

    return {
        base,
        final,
        teamOn,
    };
}
