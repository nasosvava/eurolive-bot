// src/analytics/util.js
// Pure helpers to compute advanced metrics from clubs-full-stats JSON team entries.
//
// Each "team" object is assumed to have the fields seen in your endpoint:
// - madeTwo/attemptedTwo, madeThree/attemptedThree, madeFt/attemptedFt
// - oppMadeTwo/oppAttemptedTwo, oppMadeThree/oppAttemptedThree, oppMadeFt/oppAttemptedFt
// - offPossessions, defPossessions, offPlays, defPlays
// - offRebounds, defRebounds, oppOffRebounds, oppDefRebounds
// - assists, steals, blocks, turnovers, fouls, games, secondsPlayed
// - teamName, shortName, primaryColor, secondaryColor
//
// All functions are defensive against missing/NaN values.

//// ─────────────────────────────────────────────────────────────────────────────
// Basic numeric guards
//// ─────────────────────────────────────────────────────────────────────────────
export const num = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
};

export const safeDiv = (a, b, fallback = 0) => (num(b) > 0 ? num(a) / num(b) : fallback);

export const round = (x, d = 1) => {
    const n = num(x);
    const p = 10 ** d;
    return Math.round(n * p) / p;
};

export const pct = (a, b, d = 1) => `${round(safeDiv(a, b) * 100, d)}%`;

//// ─────────────────────────────────────────────────────────────────────────────
// Primitive derived totals
//// ─────────────────────────────────────────────────────────────────────────────
export const fga = (t) => num(t?.attemptedTwo) + num(t?.attemptedThree);
export const fgm = (t) => num(t?.madeTwo) + num(t?.madeThree);
export const fta = (t) => num(t?.attemptedFt);
export const ftm = (t) => num(t?.madeFt);

export const oppFga = (t) => num(t?.oppAttemptedTwo) + num(t?.oppAttemptedThree);
export const oppFgm = (t) => num(t?.oppMadeTwo) + num(t?.oppMadeThree);
export const oppFta = (t) => num(t?.oppAttemptedFt);
export const oppFtm = (t) => num(t?.oppMadeFt);

export const points = (t) =>
    2 * num(t?.madeTwo) + 3 * num(t?.madeThree) + num(t?.madeFt);

export const oppPoints = (t) =>
    2 * num(t?.oppMadeTwo) + 3 * num(t?.oppMadeThree) + num(t?.oppMadeFt);

//// ─────────────────────────────────────────────────────────────────────────────
// # Shooting percentages (team & opp)
//// ─────────────────────────────────────────────────────────────────────────────
export const fgPct = (t) => safeDiv(fgm(t), fga(t));
export const twoPtPct = (t) => safeDiv(num(t?.madeTwo), num(t?.attemptedTwo));
export const threePtPct = (t) => safeDiv(num(t?.madeThree), num(t?.attemptedThree));
export const ftPct = (t) => safeDiv(num(t?.madeFt), num(t?.attemptedFt));

export const oppFgPct = (t) => safeDiv(oppFgm(t), oppFga(t));
export const oppTwoPtPct = (t) => safeDiv(num(t?.oppMadeTwo), num(t?.oppAttemptedTwo));
export const oppThreePtPct = (t) => safeDiv(num(t?.oppMadeThree), num(t?.oppAttemptedThree));
export const oppFtPct = (t) => safeDiv(num(t?.oppMadeFt), num(t?.oppAttemptedFt));

//// ─────────────────────────────────────────────────────────────────────────────
// # Shot mix & rates
//// ─────────────────────────────────────────────────────────────────────────────
export const threePARate = (t) => safeDiv(num(t?.attemptedThree), fga(t)); // 3PA/FGA
export const ftRate = (t) => safeDiv(fta(t), fga(t)); // FTA/FGA

//// ─────────────────────────────────────────────────────────────────────────────
// # Possessions, ratings, pace
//// ─────────────────────────────────────────────────────────────────────────────
export const offPoss = (t) => num(t?.offPossessions);
export const defPoss = (t) => num(t?.defPossessions);

export const ortg = (t) => safeDiv(points(t), offPoss(t)) * 100;
export const drtg = (t) => safeDiv(oppPoints(t), defPoss(t)) * 100;
export const netRtg = (t) => ortg(t) - drtg(t);

export const pacePerGame = (t) => {
    const g = Math.max(1, num(t?.games));
    return (offPoss(t) + defPoss(t)) / g;
};

//// ─────────────────────────────────────────────────────────────────────────────
// # Turnovers, assists, rebounding
//// ─────────────────────────────────────────────────────────────────────────────
export const tovRate = (t) => {
    // Prefer provided plays; if missing, fall back to possessions.
    const plays = num(t?.offPlays) || offPoss(t);
    return safeDiv(num(t?.turnovers), plays);
};

export const astPerMadeFg = (t) => safeDiv(num(t?.assists), fgm(t));

export const oRebPct = (t) => {
    const oreb = num(t?.offRebounds);
    const oAvail = oreb + num(t?.oppDefRebounds);
    return safeDiv(oreb, oAvail);
};

export const dRebPct = (t) => {
    const dreb = num(t?.defRebounds);
    const dAvail = dreb + num(t?.oppOffRebounds);
    return safeDiv(dreb, dAvail);
};

//// ─────────────────────────────────────────────────────────────────────────────
// # Misc counters
//// ─────────────────────────────────────────────────────────────────────────────
export const record = (t) => {
    const g = num(t?.games);
    const w = num(t?.wins);
    return { games: g, wins: w, losses: Math.max(0, g - w) };
};

export const minutesPlayed = (t) => safeDiv(num(t?.secondsPlayed), 60);

//// ─────────────────────────────────────────────────────────────────────────────
// # Color helpers
//// ─────────────────────────────────────────────────────────────────────────────
export const colorIntFromHex = (hex = '#0099ff') => {
    const clean = String(hex).trim().replace('#', '');
    const v = Number.parseInt(clean, 16);
    return Number.isFinite(v) ? v : 0x0099ff;
};

//// ─────────────────────────────────────────────────────────────────────────────
// # Aggregators
//// ─────────────────────────────────────────────────────────────────────────────
export function deriveTeamAnalytics(t) {
    const rec = record(t);

    const obj = {
        teamName: t?.teamName || t?.shortName || 'Unknown',
        shortName: t?.shortName || '',
        imageUrl: t?.imageUrl || null,
        colors: {
            primary: t?.primaryColor || '#0099ff',
            secondary: t?.secondaryColor || '#222222',
            int: colorIntFromHex(t?.primaryColor),
        },

        // Totals
        points: points(t),
        oppPoints: oppPoints(t),

        // Ratings
        ortg: ortg(t),
        drtg: drtg(t),
        netRtg: netRtg(t),
        pace: pacePerGame(t),

        // Shooting (fractions; format with pct() if you want % strings)
        fgPct: fgPct(t),
        twoPtPct: twoPtPct(t),
        threePtPct: threePtPct(t),
        ftPct: ftPct(t),

        // Shot mix & rates
        threePARate: threePARate(t),
        ftRate: ftRate(t),

        // Ball control / creation
        tovRate: tovRate(t),
        astPerMadeFg: astPerMadeFg(t),

        // Rebounding %
        oRebPct: oRebPct(t),
        dRebPct: dRebPct(t),

        // Counters & context
        assists: num(t?.assists),
        steals: num(t?.steals),
        blocks: num(t?.blocks),
        turnovers: num(t?.turnovers),
        fouls: num(t?.fouls),

        // Record / minutes
        games: rec.games,
        wins: rec.wins,
        losses: rec.losses,
        minutes: minutesPlayed(t),
    };

    return obj;
}

export function mapTeamsAnalytics(teams = []) {
    return (Array.isArray(teams) ? teams : []).map(deriveTeamAnalytics);
}

export function sortByNetRtg(desc = true) {
    return (a, b) => (desc ? b.netRtg - a.netRtg : a.netRtg - b.netRtg);
}

export function sortByOrtg(desc = true) {
    return (a, b) => (desc ? b.ortg - a.ortg : a.ortg - b.ortg);
}

export function sortByDrtg(desc = false) {
    // By default ascending for defense (lower is better)
    return (a, b) => (desc ? b.drtg - a.drtg : a.drtg - b.drtg);
}
