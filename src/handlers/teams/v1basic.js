// src/handlers/teams/v1basic.js
import { EmbedBuilder } from 'discord.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';
import { buildTopOffenseEmbed, getTopOffense } from '../../v1/stats/topOffense.js';
import { buildTopDefenseEmbed, getTopDefense } from '../../v1/stats/topDefense.js';
import { buildTop3ptEmbed, getTop3pt } from '../../v1/stats/top3pt.js';
import { buildWorst3ptEmbed, getWorst3pt } from '../../v1/stats/worst3pt.js';
import { buildWorst2ptEmbed, getWorst2pt } from '../../v1/stats/worst2pt.js';
import { buildTop2ptEmbed, getTop2pt } from '../../v1/stats/top2pts.js';
import { buildTopFTEmbed, getTopFT } from '../../v1/stats/topft.js';
import { buildWorstFTEmbed, getWorstFT } from '../../v1/stats/worstft.js';
import { buildPointsDiffEmbed, getPointsDiff } from '../../v1/stats/pointsDiff.js';

function seasonFromInteraction(interaction) {
    const seasonInput = interaction.options.getString('seasoncode');
    const competitionInput = interaction.options.getString('competition') || null;
    const { seasonCode } = resolveSeasonAndCompetition({ seasonInput, competitionInput });
    return seasonCode;
}

export async function teamsTopOffense(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    await interaction.deferReply();
    const rows = await getTopOffense(seasoncode);
    const embedRaw = buildTopOffenseEmbed(rows, { seasoncode });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.fields?.length) eb.setFields(embedRaw.fields);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsTopDefense(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    await interaction.deferReply();
    const rows = await getTopDefense(seasoncode);
    const embedRaw = buildTopDefenseEmbed(rows, { seasoncode });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.fields?.length) eb.setFields(embedRaw.fields);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsTop3ptPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getTop3pt({ seasoncode, minAttempts });
    const embedRaw = buildTop3ptEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.fields?.length) eb.setFields(embedRaw.fields);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsWorst3ptPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getWorst3pt({ seasoncode, minAttempts });
    const embedRaw = buildWorst3ptEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.fields?.length) eb.setFields(embedRaw.fields);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsTop2ptPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getTop2pt({ seasoncode, minAttempts });
    const embedRaw = buildTop2ptEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsWorst2ptPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getWorst2pt({ seasoncode, minAttempts });
    const embedRaw = buildWorst2ptEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsTopFtPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getTopFT({ seasoncode, minAttempts });
    const embedRaw = buildTopFTEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsWorstFtPct(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 50;
    await interaction.deferReply();
    const rows = await getWorstFT({ seasoncode, minAttempts });
    const embedRaw = buildWorstFTEmbed(rows, { seasoncode, minAttempts });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}

export async function teamsPointsDiff(interaction) {
    const seasoncode = seasonFromInteraction(interaction);
    const team = interaction.options.getString('team') || null;
    await interaction.deferReply();
    const rows = await getPointsDiff({ seasoncode });
    const embedRaw = buildPointsDiffEmbed(rows, { seasoncode, team });
    const eb = new EmbedBuilder().setTitle(embedRaw.title);
    if (embedRaw.description) eb.setDescription(embedRaw.description);
    if (embedRaw.timestamp) eb.setTimestamp(new Date(embedRaw.timestamp));
    await interaction.editReply({ embeds: [eb] });
}
