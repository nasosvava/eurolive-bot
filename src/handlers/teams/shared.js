// src/handlers/teams/shared.js

// Small helper to consistently print season
export function seasonLineFrom(data, requestedSeason) {
    return `Season: **${data?.season ?? requestedSeason ?? 'Current'}**`;
}

// Numeric helpers
export const safeDiv = (num, den) => (den > 0 ? num / den : 0);
export const pct = (num, den) => (den > 0 ? (100 * num / den) : 0);
export const toPct = (x) => `${x.toFixed(1)}%`;
export const to1 = (x) => x.toFixed(1);
