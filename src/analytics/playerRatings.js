// src/analytics/playerRatings.js
// Implements Hack a Stat calculations for individual Offensive/Defensive/Net Rating
// plus helpers for team on-court ratings derived from player tracking data.

import { num, safeDiv } from './util.js';

const EPS = 1e-9;

function squared(x) {
    const n = num(x);
    return n * n;
}

function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
}

function perGame(teamStat) {
    return num(teamStat);
}

function resolveTeamMatch(keys = []) {
    return keys
        .map((k) => (k == null ? null : String(k).trim().toLowerCase()))
        .filter(Boolean);
}

export function indexTeamsByKeys(teams = []) {
    const index = new Map();
    for (const team of teams) {
        const keys = resolveTeamMatch([
            team.teamName,
            team.shortName,
            team.clubId,
        ]);
        for (const key of keys) {
            if (!index.has(key)) index.set(key, team);
        }
    }
    index.allTeams = Array.isArray(teams) ? teams : [];
    return index;
}

export function findTeamForPlayer(playerRow, teamIndex) {
    if (!playerRow) return null;
    const name = playerRow?.player?.team?.name;
    const code = playerRow?.player?.team?.code ?? playerRow?.player?.team?.tvCodes;
    const alt = playerRow?.teamName ?? playerRow?.clubNames;
    const keys = resolveTeamMatch([name, code, alt]);
    for (const key of keys) {
        if (teamIndex.has(key)) return teamIndex.get(key);
    }

    const allTeams = Array.isArray(teamIndex?.allTeams) ? teamIndex.allTeams : [];
    if (!allTeams.length) return null;

    const normalize = (value) =>
        (value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]/g, '');

    const candidateStrings = Array.from(
        new Set(
            [name, alt, code]
                .filter(Boolean)
                .map(normalize)
                .filter(Boolean),
        ),
    );

    for (const team of allTeams) {
        const teamStrings = [
            team.teamName,
            team.shortName,
            team.clubId,
        ]
            .filter(Boolean)
            .map(normalize)
            .filter(Boolean);

        if (!teamStrings.length) continue;

        if (candidateStrings.some((cand) => teamStrings.includes(cand))) {
            return team;
        }

        if (candidateStrings.some((cand) => teamStrings.some((ts) => ts.includes(cand) || cand.includes(ts)))) {
            return team;
        }
    }

    return null;
}

function buildTeamPerGame(team) {
    const games = Math.max(1, num(team?.games));
    const secondsPlayed = num(team?.secondsPlayed);
    const minutesPerGame = secondsPlayed > 0 ? secondsPlayed / 60 / games : 40;
    const TeMP = Math.max(200, minutesPerGame * 5); // total team minutes per game (5 players)

    const madeTwo = perGame(team?.madeTwo, games);
    const attemptedTwo = perGame(team?.attemptedTwo, games);
    const madeThree = perGame(team?.madeThree, games);
    const attemptedThree = perGame(team?.attemptedThree, games);
    const madeFt = perGame(team?.madeFt, games);
    const attemptedFt = perGame(team?.attemptedFt, games);

    const oppMadeTwo = perGame(team?.oppMadeTwo, games);
    const oppAttemptedTwo = perGame(team?.oppAttemptedTwo, games);
    const oppMadeThree = perGame(team?.oppMadeThree, games);
    const oppAttemptedThree = perGame(team?.oppAttemptedThree, games);
    const oppMadeFt = perGame(team?.oppMadeFt, games);
    const oppAttemptedFt = perGame(team?.oppAttemptedFt, games);

    const offRebounds = perGame(team?.offRebounds, games);
    const defRebounds = perGame(team?.defRebounds, games);
    const oppOffRebounds = perGame(team?.oppOffRebounds, games);
    const oppDefRebounds = perGame(team?.oppDefRebounds, games);

    const assists = perGame(team?.assists, games);
    const steals = perGame(team?.steals, games);
    const blocks = perGame(team?.blocks, games);
    const turnovers = perGame(team?.turnovers, games);
    const fouls = perGame(team?.fouls, games);
    const oppTurnovers = perGame(team?.oppTurnovers, games);

    const TeFGM = madeTwo + madeThree;
    const TeFGA = attemptedTwo + attemptedThree;
    const Te3PM = madeThree;
    const TePts = 2 * madeTwo + 3 * madeThree + madeFt;
    const oppFGM = oppMadeTwo + oppMadeThree;
    const oppFGA = oppAttemptedTwo + oppAttemptedThree;
    const oppPts = 2 * oppMadeTwo + 3 * oppMadeThree + oppMadeFt;

    const offPossessions = perGame(team?.offPossessions, games);
    const defPossessions = perGame(team?.defPossessions, games);

    return {
        games,
        TeMP,
        TeFGM,
        TeFGA,
        Te3PM,
        TePts,
        TeFTM: madeFt,
        TeFTA: attemptedFt,
        TeAst: assists,
        TeOR: offRebounds,
        TeORPct: safeDiv(offRebounds, offRebounds + oppDefRebounds),
        TeTO: turnovers,
        TeScPoss: null, // computed later
        TePlPct: null,
        TeORW: null,
        TeDefRtg: safeDiv(oppPts, defPossessions, 0) * 100,
        offPossessions,
        defPossessions,
        madeFt,
        attemptedFt,
        madeTwo,
        attemptedTwo,
        madeThree,
        attemptedThree,
        assists,
        offRebounds,
        defRebounds,
        turnovers,
        steals,
        blocks,
        fouls,
        oppStats: {
            pts: oppPts,
            fgm: oppFGM,
            fga: oppFGA,
            ftm: oppMadeFt,
            fta: oppAttemptedFt,
            offensiveReb: oppOffRebounds,
            defensiveReb: oppDefRebounds,
            turnovers: oppTurnovers,
        },
    };
}

function computeTeamOffensiveFactors(teamPg) {
    const games = Math.max(1, num(teamPg?.games));
    const TeFTM = teamPg.TeFTM * games;
    const TeFTA = teamPg.TeFTA * games;
    const TeFGM = teamPg.TeFGM * games;
    const TeFGA = teamPg.TeFGA * games;
    const TeTO = teamPg.TeTO * games;
    const TeOR = teamPg.TeOR * games;

    const ftPct = safeDiv(TeFTM, TeFTA, 0);
    const TeScPoss =
        TeFGM + (1 - squared(1 - ftPct)) * TeFTA * 0.4;

    const TeTotalPoss = TeFGA + 0.44 * TeFTA + TeTO;
    const TePlPct = safeDiv(TeScPoss, TeTotalPoss, 0);
    const TeORPct = clamp01(teamPg.TeORPct);

    const numerator = (1 - TeORPct) * TePlPct;
    const denominator = numerator + (1 - TePlPct) * TeORPct;
    const TeORW = safeDiv(numerator, denominator, 0);

    return {
        ftPct,
        TeScPoss,
        TePlPct,
        TeORPct,
        TeORW,
        a:
            1 -
            safeDiv(TeOR, TeScPoss, 0) *
                TeORW *
                TePlPct,
    };
}

function computeIndividualOffense(playerRow, teamPg) {
    const gamesPlayed = Math.max(1, num(playerRow?.gamesPlayed));
    const teamGames = Math.max(1, num(teamPg?.games));

    const MP = num(playerRow?.minutesPlayed) * gamesPlayed;
    const PTS = num(playerRow?.pointsScored) * gamesPlayed;
    const twoMade = num(playerRow?.twoPointersMade) * gamesPlayed;
    const threeMade = num(playerRow?.threePointersMade) * gamesPlayed;
    const twoAtt = num(playerRow?.twoPointersAttempted) * gamesPlayed;
    const threeAtt = num(playerRow?.threePointersAttempted) * gamesPlayed;
    const FGM = twoMade + threeMade;
    const FGA = twoAtt + threeAtt;
    const FG3M = num(playerRow?.threePointersMade) * gamesPlayed;
    const FTM = num(playerRow?.freeThrowsMade) * gamesPlayed;
    const FTA = num(playerRow?.freeThrowsAttempted) * gamesPlayed;
    const AST = num(playerRow?.assists) * gamesPlayed;
    const OR = num(playerRow?.offensiveRebounds) * gamesPlayed;
    const TO = num(playerRow?.turnovers) * gamesPlayed;

    const teamTeAst = teamPg.TeAst * teamGames;
    const teamTeFGM = teamPg.TeFGM * teamGames;
    const teamTeFGA = teamPg.TeFGA * teamGames;
    const teamTe3PM = teamPg.Te3PM * teamGames;
    const teamTePts = teamPg.TePts * teamGames;
    const teamTeFTM = teamPg.TeFTM * teamGames;
    const teamTeFTA = teamPg.TeFTA * teamGames;

    const { ftPct, TeScPoss, TePlPct, TeORPct, TeORW, a } =
        computeTeamOffensiveFactors(teamPg);

    const TeMP = Math.max(EPS, teamPg.TeMP * teamGames);

    const shareMinutes = safeDiv(5 * MP, TeMP, 0);

    const qAst =
        shareMinutes * 1.14 * safeDiv(teamTeAst - AST, teamTeFGM, 0) +
        (1 - shareMinutes) *
            safeDiv(
                safeDiv(teamTeAst, TeMP, 0) * MP * 5 - AST,
                safeDiv(teamTeFGM, TeMP, 0) * MP * 5 - FGM,
                0,
            );

    const ptsGenFG =
        2 *
        (FGM + 0.5 * FG3M) *
        (1 - 0.5 * safeDiv(PTS - FTM, 2 * FGA, 0) * qAst);

    const ratioNumerator =
        (teamTeFGM - FGM) + 0.5 * (teamTe3PM - FG3M);
    const ratioDenominator = teamTeFGM - FGM;
    const assistFgWeight = safeDiv(ratioNumerator, ratioDenominator, 1);

    const assistPtsFactor = safeDiv(
        (teamTePts - teamTeFTM) - (PTS - FTM),
        2 * (teamTeFGM - FGM),
        0,
    );
    const ptsGenAst =
        2 * assistFgWeight * 0.5 * assistPtsFactor * AST;

    const scoringPossFG =
        FGM * (1 - 0.5 * safeDiv(PTS - FTM, 2 * FGA, 0) * qAst);

    const scoringPossAst =
        0.5 *
        assistPtsFactor *
        AST;

    const ftPctPlayer = safeDiv(FTM, FTA, 0);
    const scoringPossFT =
        (1 - squared(1 - ftPctPlayer)) * 0.4 * FTA;

    const scoringPossOR = OR * TeORW * TePlPct;

    const fgxPoss = (FGA - FGM) * (1 - 1.07 * TeORPct);
    const ftxPoss = squared(1 - ftPctPlayer) * 0.4 * FTA;

    const ptsGenOR =
        OR *
        TeORW *
        TePlPct *
        safeDiv(
            teamTePts,
            teamTeFGM +
                (1 - squared(1 - ftPct)) * 0.4 * teamTeFTA,
            0,
        );

    const ptsGen = (ptsGenFG + ptsGenAst + FTM) * a + ptsGenOR;

    const possTot =
        (scoringPossFG + scoringPossAst + scoringPossFT) * a +
        scoringPossOR +
        fgxPoss +
        ftxPoss +
        TO;

    const offRating =
        possTot > EPS ? (ptsGen / possTot) * 100 : null;

    return {
        offRating,
        ptsGen,
        possTot,
        intermediates: {
            qAst,
            ptsGenFG,
            ptsGenAst,
            ptsGenOR,
            scoringPossFG,
            scoringPossAst,
            scoringPossFT,
            scoringPossOR,
            fgxPoss,
            ftxPoss,
            a,
            TeScPoss,
            TePlPct,
            TeORPct,
            TeORW,
        },
    };
}

function computeIndividualDefense(playerRow, teamPg) {
    const gamesPlayed = Math.max(1, num(playerRow?.gamesPlayed));
    const teamGames = Math.max(1, num(teamPg?.games));

    const MP = Math.max(EPS, num(playerRow?.minutesPlayed) * gamesPlayed);
    const DR = num(playerRow?.defensiveRebounds) * gamesPlayed;
    const ST = num(playerRow?.steals) * gamesPlayed;
    const BL = num(playerRow?.blocks) * gamesPlayed;
    const PF = num(playerRow?.foulsCommited) * gamesPlayed;

    const opp = {
        fgm: teamPg.oppStats.fgm * teamGames,
        fga: teamPg.oppStats.fga * teamGames,
        ftm: teamPg.oppStats.ftm * teamGames,
        fta: teamPg.oppStats.fta * teamGames,
        offensiveReb: teamPg.oppStats.offensiveReb * teamGames,
        defensiveReb: teamPg.oppStats.defensiveReb * teamGames,
        turnovers: teamPg.oppStats.turnovers * teamGames,
        pts: teamPg.oppStats.pts * teamGames,
    };

    const teamDefReb = teamPg.defRebounds * teamGames;
    const teamBlocks = teamPg.blocks * teamGames;
    const teamSteals = teamPg.steals * teamGames;
    const teamFouls = teamPg.fouls * teamGames;

    const oppFGPct = safeDiv(opp.fgm, opp.fga, 0);
    const oppFTPct = safeDiv(opp.ftm, opp.fta, 0);
    const oppORPct = clamp01(
        safeDiv(opp.offensiveReb, opp.offensiveReb + teamDefReb, 0),
    );

    const FMwt = safeDiv(
        oppFGPct * (1 - oppORPct),
        oppFGPct * (1 - oppORPct) + oppORPct * (1 - oppFGPct),
        0,
    );

    const Stop1 =
        ST +
        BL * FMwt * (1 - 1.07 * oppORPct) +
        DR * (1 - FMwt);

    const TeMP = Math.max(EPS, teamPg.TeMP * teamGames);
    const oppPoss =
        opp.fga + 0.44 * opp.fta + opp.turnovers;
    const OppMP = TeMP; // same game length

    const Stop2FG =
        safeDiv(
            opp.fga - opp.fgm - teamBlocks,
            TeMP,
            0,
        ) *
        FMwt *
        (1 - 1.07 * oppORPct) *
        MP;
    const Stop2TO =
        safeDiv(opp.turnovers - teamSteals, TeMP, 0) * MP;
    const Stop2FT =
        safeDiv(PF, teamFouls, 0) *
        0.4 *
        opp.fta *
        squared(1 - oppFTPct);

    const Stop = Stop1 + Stop2FG + Stop2TO + Stop2FT;
    const StopPct = safeDiv(Stop, oppPoss * safeDiv(MP, OppMP, 0), 0);

    const oppScPoss =
        opp.fgm + (1 - squared(1 - oppFTPct)) * 0.4 * opp.fta;
    const oppPts = opp.pts;

    const teamDefPoss = teamPg.defPossessions * teamGames;
    const teamDefRtg = teamDefPoss > EPS ? safeDiv(oppPts, teamDefPoss, 0) * 100 : teamPg.TeDefRtg;

    const term =
        100 * safeDiv(oppPts, oppScPoss, 0) * (1 - StopPct) -
        teamDefRtg;
    const defRating = teamDefRtg + 0.2 * term;

    return {
        defRating,
        Stop,
        StopPct,
        intermediates: {
            FMwt,
            Stop1,
            Stop2FG,
            Stop2TO,
            Stop2FT,
            oppPoss,
            oppScPoss,
        },
    };
}

export function computeIndividualRatings({ playerRow, team }) {
    const teamPg = buildTeamPerGame(team);
    const offense = computeIndividualOffense(playerRow, teamPg);
    const defense = computeIndividualDefense(playerRow, teamPg);
    const offRating = offense.offRating;
    const defRating = defense.defRating;
    const netRating =
        offRating != null && defRating != null
            ? offRating - defRating
            : null;

    return {
        offRating,
        defRating,
        netRating,
        offense,
        defense,
        team: teamPg,
    };
}
