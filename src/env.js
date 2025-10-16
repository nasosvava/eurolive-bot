import dotenv from 'dotenv';
dotenv.config();

function required(name) {
    const v = process.env[name];
    if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
    return v.trim();
}

function optional(name, def) {
    const v = process.env[name];
    return v && v.trim().length ? v.trim() : def;
}

// Discord bot
export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
export const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

// EuroLeague endpoints (legacy XML/JSON)
export const EUROLEAGUE_SCHEDULES = process.env.EUROLEAGUE_SCHEDULES;
export const EUROLEAGUE_BOXSCORE = process.env.EUROLEAGUE_BOXSCORE;
export const EUROLEAGUE_PLAYBYPLAY = process.env.EUROLEAGUE_PLAYBYPLAY;
export const EUROLEAGUE_POINTS = process.env.EUROLEAGUE_POINTS;
export const EUROLEAGUE_STANDINGS = process.env.EUROLEAGUE_STANDINGS;
export const EUROLEAGUE_STANDINGS_FORCE = process.env.EUROLEAGUE_STANDINGS_FORCE || null;
export const EUROLEAGUE_TEAMS = process.env.EUROLEAGUE_TEAMS;

export const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 60);
export const DEFAULT_SEASON = 'E2025';
export const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;
export const LIVE_BOX_CHANNEL_ID = process.env.LIVE_BOX_CHANNEL_ID || null;

// EuroLeague API v3 (modern JSON)
export const EUROLEAGUE_API_V3 = process.env.EUROLEAGUE_API_V3 || 'https://api-live.euroleague.net/v3';
export const EUROLEAGUE_COMPETITION_CODE = process.env.EUROLEAGUE_COMPETITION_CODE || 'E'; // E=EuroLeague, U=EuroCup
export const EUROLEAGUE_SEASON_CODE = process.env.EUROLEAGUE_SEASON_CODE || DEFAULT_SEASON;

// 3Steps (optional analytics overlays)
export const CLUBS_FULL_STATS_URL =
    process.env.CLUBS_FULL_STATS_URL ||
    'https://ycpcq74tr3.execute-api.eu-central-1.amazonaws.com/prod/league/euroleague/clubs-full-stats';
export const BEST_PLAYERS_URL =
    process.env.BEST_PLAYERS_URL ||
    'https://ycpcq74tr3.execute-api.eu-central-1.amazonaws.com/prod/league/euroleague/best-players';
export const MIN_COMPETITION_YEAR = 2020;
