// src/handlers/teams/compare.js
import { AttachmentBuilder } from 'discord.js';
import { fetchTeamStats } from '../../api/teamStats.js';
import { METRICS, metricByKey } from '../../analytics/statsCatalog.js';
import { renderMultiComparisonChart } from '../../charts/render.js';
import { colorIntFromHex, round } from '../../analytics/util.js';
import { seasonLineFrom } from './shared.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';

function normalise(value) {
    return String(value || '').trim().toLowerCase();
}

function findTeam(teams, name) {
    const target = normalise(name);
    return (
        teams.find((team) => normalise(team.teamName) === target || normalise(team.shortName) === target) ||
        teams.find((team) => normalise(team.teamName).includes(target))
    ) || null;
}

export async function teamsCompare(interaction) {
    await interaction.deferReply();

    const teamAName = interaction.options.getString('team_a', true);
    const teamBName = interaction.options.getString('team_b', true);
    const metricsRaw = interaction.options.getString('metrics');
    const competitionInput = interaction.options.getString('competition');
    if (!competitionInput) {
        await interaction.editReply({ content: 'Please select a competition first.' });
        return;
    }

    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput: null,
        competitionInput,
    });

    const data = await fetchTeamStats(seasonCode, competitionCode);
    const teams = data.teams || [];
    const seasonLabel = seasonLineFrom(data, seasonCode);

    const teamA = findTeam(teams, teamAName);
    const teamB = findTeam(teams, teamBName);

    if (!teamA || !teamB) {
        await interaction.editReply({ content: 'Could not find one or both teams.' });
        return;
    }

    let metricKeys;
    if (metricsRaw && metricsRaw.trim().length) {
        metricKeys = metricsRaw.split(',').map((entry) => entry.trim()).filter(Boolean);
    } else {
        metricKeys = METRICS.map((m) => m.key);
    }

    const used = new Set();
    const metas = metricKeys
        .map((key) => metricByKey(key))
        .filter((meta) => meta && !used.has(meta.key) && used.add(meta.key));

    if (!metas.length) {
        await interaction.editReply({ content: 'No valid metrics selected.' });
        return;
    }

    const labels = metas.map((meta) => meta.label);
    const teamAValues = metas.map((meta) => Number(meta.getter(teamA)) || 0);
    const teamBValues = metas.map((meta) => Number(meta.getter(teamB)) || 0);

    const seasonText = data.season || seasonCode || '';
    const chartTitle = `Comparison - ${teamA.teamName} vs ${teamB.teamName}${seasonText ? ` (${seasonText})` : ''}`;

    const teamAColor = teamA.primaryColor || '#0099ff';
    const teamBColor = teamB.primaryColor || '#ff3b30';

    const image = await renderMultiComparisonChart({
        labels,
        teamA: { label: teamA.teamName, values: teamAValues, color: teamAColor },
        teamB: { label: teamB.teamName, values: teamBValues, color: teamBColor },
        title: chartTitle,
    });

    const file = new AttachmentBuilder(image, { name: 'compare.png' });

    const summaryLines = metas.slice(0, 10).map((meta, index) => {
        const aVal = round(teamAValues[index], 2);
        const bVal = round(teamBValues[index], 2);
        return `- **${meta.label}** - ${teamA.teamName}: **${aVal}**, ${teamB.teamName}: **${bVal}**`;
    });

    const extraLine = metas.length > 10 ? `- ...and ${metas.length - 10} more metrics in the chart.` : '';

    const embed = {
        title: 'Teams - Multi-metric Comparison',
        description: [seasonLabel, '', ...summaryLines, extraLine].filter(Boolean).join('\n'),
        color: colorIntFromHex(teamAColor),
        image: { url: 'attachment://compare.png' },
        thumbnail: teamA.imageUrl ? { url: teamA.imageUrl } : undefined,
        footer: teamB.imageUrl
            ? { text: teamB.teamName, icon_url: teamB.imageUrl }
            : { text: teamB.teamName },
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed], files: [file] });
}
