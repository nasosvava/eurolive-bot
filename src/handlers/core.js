// src/handlers/core.js
import { EmbedBuilder } from 'discord.js';
import { DEFAULT_SEASON } from '../env.js';
import { fetchStandings, buildStandingsEmbeds } from '../v1/standings/index.js';
import { fetchTodayGames, buildTodayEmbed } from '../v1/schedule/today.js';
import { fetchWeekGames, buildWeekEmbeds } from '../v1/schedule/week.js';
import { fetchLiveGames, buildLiveEmbeds, liveAutocomplete } from '../v1/schedule/live.js';
import { previousTeamAutocomplete, fetchPreviousGames, buildPreviousEmbeds } from '../v1/schedule/previous.js';

export const GREECE_TZ = 'Europe/Athens';

// ---- Autocomplete handlers (core)
export async function handleAutocomplete(interaction) {
    // live
    if (interaction.commandName === 'live') {
        return liveAutocomplete(interaction, { timeZone: GREECE_TZ });
    }

    // previous-game & teams-points-diff team autocomplete is provided in players/teams handlers
    return;
}

// ---- Command handlers (core)
export async function ping(interaction) {
    await interaction.reply({ content: '🏓 Pong!', ephemeral: true });
}

export async function standings(interaction) {
    const seasoncode = interaction.options.getString('seasoncode') || DEFAULT_SEASON;
    const phasecode = interaction.options.getString('phasecode') || null;

    await interaction.deferReply();
    const { rows } = await fetchStandings(seasoncode, phasecode);
    const embedsRaw = buildStandingsEmbeds(rows, { seasoncode, phasecode });
    const embeds = embedsRaw.map((e) => {
        const eb = new EmbedBuilder().setTitle(e.title);
        if (e.description) eb.setDescription(e.description);
        if (e.fields?.length) eb.setFields(e.fields);
        if (e.timestamp) eb.setTimestamp(new Date(e.timestamp));
        return eb;
    });
    await interaction.editReply({ embeds });
}

export async function today(interaction) {
    const seasoncode = DEFAULT_SEASON;
    await interaction.deferReply();
    const { gamesToday } = await fetchTodayGames({ seasoncode, timeZone: GREECE_TZ });
    const embedsRaw = buildTodayEmbed({ gamesToday, timeZone: GREECE_TZ });
    const embeds = embedsRaw.map((e) => {
        const eb = new EmbedBuilder().setTitle(`${e.title} (${GREECE_TZ})`);
        if (e.description) eb.setDescription(e.description);
        if (e.fields?.length) eb.setFields(e.fields);
        if (e.timestamp) eb.setTimestamp(new Date(e.timestamp));
        return eb;
    });
    await interaction.editReply({ embeds });
}

export async function week(interaction) {
    const seasoncode = DEFAULT_SEASON;
    await interaction.deferReply();
    const games = await fetchWeekGames({ seasoncode, timeZone: GREECE_TZ });
    const embedsRaw = buildWeekEmbeds(games, { timeZone: GREECE_TZ });
    const embeds = embedsRaw.map((e) => {
        const eb = new EmbedBuilder().setTitle(e.title);
        if (e.description) eb.setDescription(e.description);
        if (e.fields?.length) eb.setFields(e.fields);
        if (e.timestamp) eb.setTimestamp(new Date(e.timestamp));
        return eb;
    });
    await interaction.editReply({ embeds });
}

export async function live(interaction) {
    const gameId = interaction.options.getString('game');
    const team = interaction.options.getString('team');
    await interaction.deferReply();
    const games = await fetchLiveGames({ seasoncode: DEFAULT_SEASON, team, timeZone: GREECE_TZ, gameId });
    const embeds = buildLiveEmbeds(games, { team, timeZone: GREECE_TZ });
    await interaction.editReply({ embeds });
}

export async function previousGame(interaction) {
    const team = interaction.options.getString('team');
    const limit = interaction.options.getInteger('limit') ?? 10;
    await interaction.deferReply();
    const games = await fetchPreviousGames({ seasoncode: DEFAULT_SEASON, team, timeZone: GREECE_TZ, limit });
    const embeds = buildPreviousEmbeds(games, { team, seasoncode: DEFAULT_SEASON, timeZone: GREECE_TZ, limit });
    await interaction.editReply({ embeds });
}

// re-export for use in teams handler
export { previousTeamAutocomplete };
