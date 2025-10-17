// src/bot/liveBoxscore.js
import { Events } from 'discord.js';
import { LIVE_BOX_CHANNEL_ID, DEFAULT_SEASON, EUROLEAGUE_BOXSCORE } from '../env.js';
import { fetchLiveGames } from '../v1/schedule/live.js';
import { formatDateLabel, formatTimeHHMM } from '../v1/schedule/common.js';

const POLL_INTERVAL_MS = 1000;
const NO_GAMES_KEY = '__no_games__';
const LOG_LIVE_BOX = process.env.LIVE_BOX_DEBUG === '1';
const DISPLAY_TZ = 'Europe/Athens';

const logDebug = (...args) => {
    if (!LOG_LIVE_BOX) return;
    console.debug('[live-boxscore]', ...args);
};
const logWarn = (...args) => {
    if (!LOG_LIVE_BOX) return;
    console.warn('[live-boxscore]', ...args);
};
const logError = (...args) => {
    if (!LOG_LIVE_BOX) return;
    console.error('[live-boxscore]', ...args);
};

function hashEmbedData(embed) {
    return JSON.stringify({
        title: embed.title,
        description: embed.description,
        fields: embed.fields,
        color: embed.color,
    });
}

function formatScore(value) {
    return Number.isFinite(value) ? String(value) : 'N/A';
}

function aggregateLegacyPlayers(players = []) {
    const totals = {
        points: 0,
        rebounds: 0,
        assists: 0,
        turnovers: 0,
        steals: 0,
    };

    const mapped = players.map((p) => {
        const stats = p.stats || p || {};
        const entry = {
            name:
                stats.Player ||
                p.player?.person?.abbreviatedName ||
                p.player?.person?.name ||
                'Player',
            points: Number(stats.Points ?? stats.points) || 0,
            rebounds:
                Number(
                    stats.TotalRebounds ??
                    stats.totalRebounds ??
                    (stats.OffensiveRebounds ?? stats.offensiveRebounds ?? 0) +
                        (stats.DefensiveRebounds ?? stats.defensiveRebounds ?? 0),
                ) || 0,
            assists: Number(stats.Assistances ?? stats.assistances) || 0,
            turnovers: Number(stats.Turnovers ?? stats.turnovers) || 0,
            steals: Number(stats.Steals ?? stats.steals) || 0,
        };

        totals.points += entry.points;
        totals.rebounds += entry.rebounds;
        totals.assists += entry.assists;
        totals.turnovers += entry.turnovers;
        totals.steals += entry.steals;

        return entry;
    });

    const leaders = mapped
        .filter((p) => p.points || p.rebounds || p.assists)
        .sort((a, b) => b.points - a.points || b.rebounds - a.rebounds || b.assists - a.assists)
        .slice(0, 3);

    return { totals, leaders };
}

function formatLeaders(leaders = []) {
    if (!leaders.length) return '_No notable stats yet_';

    return leaders
        .map((p) => `**${p.name}** - PTS ${p.points} | REB ${p.rebounds} | AST ${p.assists}`)
        .join('\n');
}

function buildTeamSummary(totals) {
    if (!totals) return '_Not available_';
    const points = Number(totals.points) || 0;
    const rebounds = Number(totals.rebounds) || 0;
    const assists = Number(totals.assists) || 0;
    const turnovers = Number(totals.turnovers) || 0;
    return `PTS **${points}** | REB **${rebounds}** | AST **${assists}** | TOV **${turnovers}**`;
}

function matchTeamBoxscore(boxscore, teamName) {
    const list = boxscore?.Stats;
    if (!Array.isArray(list)) return null;
    const target = (teamName || '').trim().toLowerCase();
    return (
        list.find((item) => (item.Team || '').trim().toLowerCase() === target) ||
        list.find((item) => (item.Team || '').trim().toLowerCase().includes(target))
    );
}

function buildEmbed(game, boxscore) {
    const status = game.isFinal ? 'FINAL' : 'LIVE';
    const title = `${status} - ${game.home} vs ${game.away}`;
    const description = `**${game.home}** ${formatScore(game.homeScore)}\n**${game.away}** ${formatScore(game.awayScore)}`;

    const fields = [];

    if (game.date instanceof Date && !Number.isNaN(game.date)) {
        const tipLabel = `${formatDateLabel(game.date, DISPLAY_TZ)} ${formatTimeHHMM(game.date, DISPLAY_TZ)}`;
        fields.push({
            name: 'Tip-off (Greece)',
            value: tipLabel,
            inline: false,
        });
    }

    const homeBox = matchTeamBoxscore(boxscore, game.home);
    const awayBox = matchTeamBoxscore(boxscore, game.away);

    if (homeBox && awayBox) {
        const homeAgg = aggregateLegacyPlayers(homeBox.PlayersStats || []);
        const awayAgg = aggregateLegacyPlayers(awayBox.PlayersStats || []);

        fields.push({
            name: `${game.home} Totals`,
            value: buildTeamSummary(homeAgg.totals),
            inline: false,
        });

        fields.push({
            name: `${game.away} Totals`,
            value: buildTeamSummary(awayAgg.totals),
            inline: false,
        });

        fields.push({
            name: `${game.home} Leaders`,
            value: formatLeaders(homeAgg.leaders),
            inline: false,
        });

        fields.push({
            name: `${game.away} Leaders`,
            value: formatLeaders(awayAgg.leaders),
            inline: false,
        });
    } else {
        fields.push({
            name: 'Stats',
            value: '_Box score data will appear once the league publishes it._',
            inline: false,
        });
    }

    const embed = {
        title,
        description,
        color: game.isFinal ? 0xe74c3c : 0x1abc9c,
        fields,
        timestamp: new Date().toISOString(),
    };

    return embed;
}

const legacyBoxscoreCache = new Map();
const LEGACY_CACHE_TTL_MS = 30_000;

async function fetchLegacyBoxscore(seasonCode, gameCode) {
    if (!EUROLEAGUE_BOXSCORE) return null;
    const numericCode = Number(gameCode);
    const codeParam = Number.isFinite(numericCode) ? String(numericCode) : String(gameCode).trim();
    const url = `${EUROLEAGUE_BOXSCORE}?gamecode=${codeParam}&seasoncode=${encodeURIComponent(seasonCode)}`;
    const maxAttempts = 3;
    const cacheKey = `${seasonCode}:${codeParam}`;
    const cachedEntry = legacyBoxscoreCache.get(cacheKey);
    const cached =
        cachedEntry && Date.now() - cachedEntry.fetchedAt <= LEGACY_CACHE_TTL_MS ? cachedEntry : null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const res = await fetch(url, { headers: { accept: 'application/json' } });
            if (!res.ok) throw new Error(`live boxscore HTTP ${res.status}`);

            const text = await res.text();
            if (!text || !text.trim()) {
                throw new Error('empty response');
            }

            try {
                const parsed = JSON.parse(text);
                legacyBoxscoreCache.set(cacheKey, { data: parsed, fetchedAt: Date.now() });
                return parsed;
            } catch (jsonErr) {
                const message = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
                throw new Error(`invalid JSON (${message})`);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            const lowerMessage = error.message.toLowerCase();
            const recoverable =
                lowerMessage.includes('invalid json') ||
                lowerMessage.includes('unexpected end of json input') ||
                lowerMessage.includes('empty response');

            if (attempt < maxAttempts - 1 && recoverable) {
                const backoffMs = 200 * (attempt + 1);
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                continue;
            }

            if (recoverable) {
                if (cached?.data) {
                    logWarn(
                        `using cached boxscore after ${attempt + 1} attempt${attempt ? 's' : ''}: ${error.message}`,
                    );
                    return cached.data;
                }

                logWarn(
                    `boxscore not ready after ${attempt + 1} attempt${attempt ? 's' : ''}: ${error.message}`,
                );
                return null;
            }

            logError(`fetch failed after ${attempt + 1} attempt${attempt ? 's' : ''}:`, error);
            return null;
        }
    }

    return null;
}

class LiveBoxscoreManager {
    constructor(channel) {
        this.channel = channel;
        this.intervalId = null;
        this.tracked = new Map(); // gameId -> { messageId, hash }
        this.polling = false;
    }

    async removeTrackedMessage(gameId) {
        const tracked = this.tracked.get(gameId);
        if (!tracked) return;
        try {
            await this.channel.messages.delete(tracked.messageId);
        } catch {
            // ignore failures
        }
        this.tracked.delete(gameId);
    }

    async ensureNoGamesMessage() {
        const embed = {
            title: 'EuroLeague Live',
            description: 'No live games right now.',
            color: 0x95a5a6,
        };
        const hash = hashEmbedData(embed);
        const tracked = this.tracked.get(NO_GAMES_KEY);

        if (tracked) {
            if (tracked.hash === hash) return;
            try {
                await this.channel.messages.edit(tracked.messageId, { embeds: [embed] });
                tracked.hash = hash;
            } catch (err) {
                logError('failed to update no-games message:', err);
                this.tracked.delete(NO_GAMES_KEY);
            }
            return;
        }

        try {
            const message = await this.channel.send({ embeds: [embed] });
            this.tracked.set(NO_GAMES_KEY, { messageId: message.id, hash });
        } catch (err) {
            logError('failed to send no-games message:', err);
        }
    }

    async clearNoGamesMessage() {
        await this.removeTrackedMessage(NO_GAMES_KEY);
    }

    start() {
        if (this.intervalId) return;
        this.tick().catch(() => {});
        this.intervalId = setInterval(() => this.tick().catch(() => {}), POLL_INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async tick() {
        if (this.polling) return;
        this.polling = true;
        try {
            const games = await fetchLiveGames({ seasoncode: DEFAULT_SEASON, timeZone: DISPLAY_TZ });
            logDebug(`fetched ${games.length} games`);

            const liveGames = [];
            const finishedGameIds = [];

            for (const game of games) {
                const sc = game._ids?.scFromItem || DEFAULT_SEASON;
                const gc = game._ids?.gcClean;
                if (gc == null) continue;

                const gameId = `${sc}:${gc}`;

                if (game.isFinal) {
                    finishedGameIds.push(gameId);
                    continue;
                }

                liveGames.push({ game, sc, gc, gameId });
            }

            for (const gameId of finishedGameIds) {
                await this.removeTrackedMessage(gameId);
            }

            if (liveGames.length === 0) {
                await this.ensureNoGamesMessage();
            } else {
                await this.clearNoGamesMessage();
            }

            const activeGameIds = new Set();

            for (const { game, sc, gc, gameId } of liveGames) {
                activeGameIds.add(gameId);

                const boxscore = await fetchLegacyBoxscore(sc, gc);
                const embed = buildEmbed(game, boxscore);
                const hash = hashEmbedData(embed);
                const tracked = this.tracked.get(gameId);

                if (!tracked) {
                    try {
                        const message = await this.channel.send({ embeds: [embed] });
                        this.tracked.set(gameId, { messageId: message.id, hash });
                    } catch (err) {
                        logError('send error:', err);
                    }
                    continue;
                }

                if (tracked.hash === hash) continue;

                try {
                    await this.channel.messages.edit(tracked.messageId, { embeds: [embed] });
                    tracked.hash = hash;
                } catch (err) {
                    logError('edit error:', err);
                    this.tracked.delete(gameId);
                }
            }

            for (const [gameId] of [...this.tracked.entries()]) {
                if (gameId === NO_GAMES_KEY) continue;
                if (activeGameIds.has(gameId)) continue;
                await this.removeTrackedMessage(gameId);
            }
        } finally {
            this.polling = false;
        }
    }
}

let manager = null;

export function startLiveBoxscoreLoop(client) {
    if (!LIVE_BOX_CHANNEL_ID) return;

    client.once(Events.ClientReady, async () => {
        try {
            const channel = await client.channels.fetch(LIVE_BOX_CHANNEL_ID);
            if (!channel || !channel.isTextBased()) {
                logWarn('Channel is not text-based or not found.');
                return;
            }
            manager = new LiveBoxscoreManager(channel);
            manager.start();
            const cleanup = () => stopLiveBoxscoreLoop();
            process.once('SIGINT', cleanup);
            process.once('SIGTERM', cleanup);
        } catch (err) {
            logError('Failed to start polling:', err);
        }
    });
}

export function stopLiveBoxscoreLoop() {
    if (manager) {
        manager.stop();
        manager = null;
    }
}
