// src/v3/players/stats/pir.js
import { EmbedBuilder } from 'discord.js';
import { EUROLEAGUE_SEASON_CODE } from '../../../env.js';
import { fetchCompetitionPlayers } from '../../../api/playerStats.js';
import { buildSeasonSuggestions, resolveSeasonAndCompetition } from '../../../utils/season.js';
import { competitionLabel } from '../../../config/competitions.js';

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

const pickColorFromSources = (...sources) => {
    for (const source of sources) {
        const normalized = normalizeHexColor(source);
        if (normalized) return normalized;
    }
    return null;
};

const extractTeamVisual = (row) => {
    const team = row?.player?.team ?? row?.team ?? {};
    const containers = [
        team,
        team.colors,
        team.teamColors,
        team.teamcolors,
        team.clubColors,
        row?.teamColors,
        row?.clubColors,
    ].filter(Boolean);

    const primaryCandidates = [];
    const imageCandidates = [
        team.imageUrl,
        team.logoUrl,
        team.logo,
        team.crest,
        team.badge,
        team.photo,
        team.media?.logo,
        team.media?.image,
    ];

    for (const container of containers) {
        primaryCandidates.push(
            container.primaryColor,
            container.primary_colour,
            container.primaryColour,
            container.primary_color,
            container.primary,
            container.main,
            container.mainColor,
            container.mainColour,
            container.colorPrimary,
            container.colourPrimary,
            container.hex,
            container.hex1,
            container.color1,
            container.colour1,
        );
    }

    const teamColor = pickColorFromSources(...primaryCandidates);

    for (const candidate of imageCandidates) {
        const url = String(candidate || '').trim();
        if (!url) continue;
        if (/^(https?:)?\/\//i.test(url)) {
            const normalized = url.startsWith('http') ? url : `https:${url}`;
            return { teamColor, teamImage: normalized };
        }
    }

    return { teamColor, teamImage: null };
};

function normalizeRow(row) {
    const name =
        (row.player?.name && String(row.player.name).trim()) ||
        (row.playerName && String(row.playerName).trim()) ||
        'Unknown';

    const teamName =
        row.player?.team?.name ||
        row.player?.team?.code ||
        row.clubNames ||
        row.teamName ||
        'N/A';

    const games = num(row.gamesPlayed, 0);
    const pirAvg = num(row.pir, 0);
    if (!name || pirAvg <= 0) return null;

    const { teamColor, teamImage } = extractTeamVisual(row);

    return {
        name,
        team: teamName,
        gp: games,
        pirAvg,
        teamColor,
        teamImage,
    };
}

function matchesPlayer(query, candidate) {
    const q = String(query).trim().toUpperCase();
    const c = String(candidate || '').trim().toUpperCase();
    if (!q || !c) return false;

    const qTokens = q.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    const cTokens = c.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    return qTokens.every((qt) => cTokens.some((ct) => ct === qt || ct.startsWith(qt)));
}

async function loadPirRows({ seasonCode, competitionCode }) {
    const payload = await fetchCompetitionPlayers({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const rows = players.map(normalizeRow).filter(Boolean);
    return { rows, payload };
}

function dataSourceLabel(competitionCode) {
    return competitionCode === 'E' || competitionCode === 'U'
        ? 'EuroLeague API v3'
        : '3Steps analytics dataset';
}

export async function getTop20PirForCurrentSeason({ seasonCode, competitionCode } = {}) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode || EUROLEAGUE_SEASON_CODE,
        competitionInput: competitionCode,
    });

    const { rows, payload } = await loadPirRows({ seasonCode: season, competitionCode: competition });
    rows.sort((a, b) => (b.pirAvg - a.pirAvg) || (b.gp - a.gp));
    return { rows: rows.slice(0, 20), payload };
}

export async function getPlayerPirForSeason({ player, seasonCode, competitionCode }) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });

    const { rows } = await loadPirRows({ seasonCode: season, competitionCode: competition });
    const matches = rows.filter((candidate) => matchesPlayer(player, candidate.name));
    if (!matches.length) return null;
    matches.sort((a, b) => (b.pirAvg - a.pirAvg) || (b.gp - a.gp));
    return matches[0];
}

export async function getPlayerPirAllSeasons({ player, competitionCode, limit = 20 }) {
    const { competitionCode: competition } = resolveSeasonAndCompetition({ competitionInput: competitionCode });
    const seasons = buildSeasonSuggestions({ competitionCode: competition, limit }).map((year) => `${competition}${year}`);
    const results = [];

    for (const season of seasons) {
        const row = await getPlayerPirForSeason({ player, seasonCode: season, competitionCode: competition });
        if (row) results.push({ season, ...row });
    }

    results.sort((a, b) => b.season.localeCompare(a.season));
    return results;
}

export function buildPirTop20Embed(rows, { payload } = {}) {
    const seasonLabel = payload?.season || payload?.competitionId || EUROLEAGUE_SEASON_CODE;
    const competitionCode = payload?.competitionCode;
    const competitionName = competitionLabel(competitionCode);

    const embed = new EmbedBuilder()
        .setTitle(`Top 20 PIR Leaders - ${seasonLabel}`)
        .setTimestamp(new Date());

    if (competitionName) {
        embed.setFooter({ text: `${competitionName} • ${dataSourceLabel(competitionCode)}` });
    }

    if (rows?.length) {
        const firstColor = rows[0]?.teamColor;
        const firstImage = rows[0]?.teamImage;
        if (firstColor) embed.setColor(firstColor);
        if (firstImage) embed.setThumbnail(firstImage);
    }

    if (!rows?.length) {
        embed.addFields({ name: 'No data', value: 'No results available.' });
        return embed;
    }

    embed.addFields(
        rows.map((entry, index) => ({
            name: `${index + 1}. ${entry.name} (${entry.team})`,
            value: `PIR: **${entry.pirAvg.toFixed(1)}** per game - GP: ${entry.gp}`,
            inline: false,
        })),
    );

    return embed;
}

export function buildPirPlayerSeasonEmbed({ player, seasonCode, competitionCode, row }) {
    const seasonLabel = seasonCode || 'Unknown season';
    const competitionName = competitionLabel(competitionCode);

    const embed = new EmbedBuilder()
        .setTitle(`PIR - ${player} (${seasonLabel})`)
        .setTimestamp(new Date());

    if (competitionName) {
        embed.setFooter({ text: `${competitionName} • ${dataSourceLabel(competitionCode)}` });
    }

    if (!row) {
        embed.addFields({ name: 'No data', value: `No PIR entry found for **${player}** in **${seasonLabel}**.` });
        return embed;
    }

    if (row.teamColor) embed.setColor(row.teamColor);
    if (row.teamImage) embed.setThumbnail(row.teamImage);

    embed.addFields({
        name: `${row.name} (${row.team})`,
        value: `PIR: **${row.pirAvg.toFixed(1)}** per game - GP: ${row.gp}`,
        inline: false,
    });

    return embed;
}

export function buildPirPlayerAllSeasonsEmbed({ player, rows, competitionCode }) {
    const competitionName = competitionLabel(competitionCode);

    const embed = new EmbedBuilder()
        .setTitle(`PIR - ${player} (all seasons)`)
        .setTimestamp(new Date());

    if (competitionName) {
        embed.setFooter({ text: `${competitionName} • ${dataSourceLabel(competitionCode)}` });
    }

    if (!rows?.length) {
        embed.addFields({ name: 'No data', value: `No seasons found for **${player}**.` });
        return embed;
    }

    const firstColor = rows[0]?.teamColor;
    const firstImage = rows[0]?.teamImage;
    if (firstColor) embed.setColor(firstColor);
    if (firstImage) embed.setThumbnail(firstImage);

    embed.addFields(
        rows.map((entry) => ({
            name: `${entry.season}: ${entry.name} (${entry.team})`,
            value: `PIR: **${entry.pirAvg.toFixed(1)}** per game - GP: ${entry.gp}`,
            inline: false,
        })),
    );

    return embed;
}
