// src/analytics/odds.js
// Fun-only win-prob model based on ratings/pace + home-court tweak.
// DISCLAIMER: Not financial advice; for entertainment only.

import { safeDiv, round } from './util.js';

// Defaults (tweak later if needed)
const DEFAULTS = {
    // Net rating bonus to the HOME team, in points per 100 possessions
    hcaPer100: 2.5,
    // Logistic slope: how strongly margin maps to win prob (per “game point” of margin)
    // For EuroLeague, 0.18–0.22 is sensible. 0.20 is a balanced starting point.
    k: 0.20,
};

export function expectedMarginPer100(a, b, { home = 'A', hcaPer100 = DEFAULTS.hcaPer100 } = {}) {
    // Use both ORTG vs opponent's DRTG (two-way view), average them:
    const a_vs_b = (a.ortg - b.drtg);
    const b_vs_a = (b.ortg - a.drtg);
    let marginPer100 = (a_vs_b - b_vs_a) / 2; // positive favors A

    // Home-court advantage (as per-100 margin bonus to home side)
    if (home === 'A') marginPer100 += hcaPer100;
    if (home === 'B') marginPer100 -= hcaPer100;

    return marginPer100; // points per 100 poss
}

export function expectedPace(a, b) {
    // Simple blend of their paces; clamp to avoid zero
    const p = (a.pace + b.pace) / 2;
    return Math.max(60, Math.min(105, p || 70));
}

export function expectedGameMargin(a, b, opts) {
    const per100 = expectedMarginPer100(a, b, opts);
    const pace = expectedPace(a, b);
    return (per100 * pace) / 100; // points over a game at this pace
}

export function winProbFromMargin(marginGamePoints, { k = DEFAULTS.k } = {}) {
    // Logistic → probability team A wins
    return 1 / (1 + Math.exp(-k * marginGamePoints));
}

export function toDecimalOdds(p) {
    // Fair (no-vig) decimal odds
    const clamp = (x) => Math.max(0.0001, Math.min(0.9999, x));
    const pc = clamp(p);
    return {
        a: round(1 / pc, 3),
        b: round(1 / (1 - pc), 3),
    };
}

export function computeMatchupOdds(a, b, { home = 'A', hcaPer100, k } = {}) {
    const marginGame = expectedGameMargin(a, b, { home, hcaPer100 });
    const pA = winProbFromMargin(marginGame, { k });
    const odds = toDecimalOdds(pA);
    return {
        marginGame,        // + → favors A, - → favors B
        pA,                // prob Team A wins
        pB: 1 - pA,        // prob Team B wins
        odds,              // decimal odds
    };
}
export function selectVenueRatings(Aoverall, Boverall, Asplit, Bsplit, venue /* 'A' | 'B' | null */) {
    const minGames = 2;
    const Ahome = Asplit?.home?.games >= minGames ? Asplit.home : null;
    const Aaway = Asplit?.away?.games >= minGames ? Asplit.away : null;
    const Bhome = Bsplit?.home?.games >= minGames ? Bsplit.home : null;
    const Baway = Bsplit?.away?.games >= minGames ? Bsplit.away : null;

    if (venue === 'A' && Ahome && Baway) {
        return {
            A: { ...Aoverall, ortg: Ahome.ortg, drtg: Ahome.drtg, pace: Aoverall.pace },
            B: { ...Boverall, ortg: Baway.ortg, drtg: Baway.drtg, pace: Boverall.pace },
            used: 'Ahome vs Baway',
        };
    }
    if (venue === 'B' && Bhome && Aaway) {
        return {
            A: { ...Aoverall, ortg: Aaway.ortg, drtg: Aaway.drtg, pace: Aoverall.pace },
            B: { ...Boverall, ortg: Bhome.ortg, drtg: Bhome.drtg, pace: Boverall.pace },
            used: 'Aaway vs Bhome',
        };
    }

    // Neutral: average splits if both sides have them; otherwise overall
    if (!venue && Ahome && Aaway && Bhome && Baway) {
        const Aavg = { ortg: (Ahome.ortg + Aaway.ortg) / 2, drtg: (Ahome.drtg + Aaway.drtg) / 2 };
        const Bavg = { ortg: (Bhome.ortg + Baway.ortg) / 2, drtg: (Bhome.drtg + Baway.drtg) / 2 };
        return {
            A: { ...Aoverall, ...Aavg, pace: Aoverall.pace },
            B: { ...Boverall, ...Bavg, pace: Boverall.pace },
            used: 'neutral (avg splits)',
        };
    }

    return { A: Aoverall, B: Boverall, used: 'overall' };
}

// Estimate each team's offensive efficiency vs the opponent, then scale by pace.
// Very simple blend: vs-DRTG adjustment averaged with own ORTG.
export function projectPoints(A, B, pace) {
    const aPer100 = (A.ortg + (200 - B.drtg)) / 2; // if B.drtg < 100 → tougher defense → lowers A
    const bPer100 = (B.ortg + (200 - A.drtg)) / 2;
    const aPts = (aPer100 * pace) / 100;
    const bPts = (bPer100 * pace) / 100;
    return { aPts, bPts, total: aPts + bPts };
}