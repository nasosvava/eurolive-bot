// src/handlers/teams/seasonCompare.js
import { AttachmentBuilder } from 'discord.js';
import { fetchTeamStats } from '../../api/teamStats.js';
import { METRICS } from '../../analytics/statsCatalog.js';
import { renderMultiComparisonChart } from '../../charts/render.js';
import { colorIntFromHex, round } from '../../analytics/util.js';
import { resolveSeasonAndCompetition, seasonYearFromInput } from '../../utils/season.js';

const DARK_GREY = '#444444';

const normalise = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

function findTeam(teams, nameRaw) {
    const q = normalise(nameRaw);
    if (!q) return null;

    return (
        teams.find((team) => normalise(team.teamName) === q || normalise(team.shortName) === q) ||
        teams.find((team) => {
            const tn = normalise(team.teamName);
            const sn = normalise(team.shortName);
            return tn.includes(q) || sn.includes(q) || q.includes(tn) || q.includes(sn);
        }) ||
        teams.find((team) => {
            const tn = normalise(team.teamName);
            const sn = normalise(team.shortName);
            const tokens = `${tn} ${sn}`.split(' ').filter(Boolean);
            const overlap = tokens.filter((token) => q.includes(token));
            return overlap.length >= 2;
        }) ||
        null
    );
}

function normaliseHex(color) {
    if (!color) return null;
    let value = String(color).trim().toLowerCase();
    if (value.startsWith('rgb')) return null;
    if (!value.startsWith('#')) value = `#${value}`;
    if (value.length === 4) {
        value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}

function hexToRgb(hex) {
    const normalised = normaliseHex(hex);
    if (!normalised) return null;
    return {
        r: parseInt(normalised.slice(1, 3), 16),
        g: parseInt(normalised.slice(3, 5), 16),
        b: parseInt(normalised.slice(5, 7), 16),
    };
}

function luminance({ r, g, b }) {
    const toLinear = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    const R = toLinear(r);
    const G = toLinear(g);
    const B = toLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function visibleColor(color, fallback = '#007bff') {
    const rgb = hexToRgb(color) || hexToRgb(fallback);
    if (!rgb) return DARK_GREY;
    const L = luminance(rgb);
    return L > 0.92 ? DARK_GREY : normaliseHex(color) || normaliseHex(fallback) || DARK_GREY;
}

function validateSeasons(yearA, yearB) {
    const currentYear = new Date().getFullYear();
    if (!yearA || !yearB) return `Seasons must include a valid year between 2020 and ${currentYear}.`;
    if (yearA < 2020 || yearB < 2020) return 'Seasons earlier than 2020 are not supported.';
    if (yearA > currentYear || yearB > currentYear) return `Seasons cannot be later than ${currentYear}.`;
    return null;
}

export async function teamsSeasonCompare(interaction) {
    await interaction.deferReply();

    const teamName = interaction.options.getString('team', true);
    const seasonAInputRaw = interaction.options.getString('season_a', true);
    const seasonBInputRaw = interaction.options.getString('season_b', true);
    const competitionInput = interaction.options.getString('competition') || null;

    const yearA = seasonYearFromInput(seasonAInputRaw);
    const yearB = seasonYearFromInput(seasonBInputRaw);
    const seasonValidation = validateSeasons(Number(yearA), Number(yearB));
    if (seasonValidation) {
        await interaction.editReply({ content: seasonValidation });
        return;
    }

    const { competitionCode } = resolveSeasonAndCompetition({ competitionInput });
    const seasonAInput = resolveSeasonAndCompetition({ seasonInput: seasonAInputRaw, competitionInput: competitionCode }).seasonCode;
    const seasonBInput = resolveSeasonAndCompetition({ seasonInput: seasonBInputRaw, competitionInput: competitionCode }).seasonCode;

    const [seasonAData, seasonBData] = await Promise.all([
        fetchTeamStats(seasonAInput, competitionCode),
        fetchTeamStats(seasonBInput, competitionCode),
    ]);

    const teamA = findTeam(seasonAData.teams || [], teamName);
    const teamB = findTeam(seasonBData.teams || [], teamName);

    if (!teamA || !teamB) {
        const labelA = seasonAData?.season ?? seasonAInput;
        const labelB = seasonBData?.season ?? seasonBInput;
        const message = [
            !teamA ? `season ${labelA}` : '',
            !teamB ? `season ${labelB}` : '',
        ]
            .filter(Boolean)
            .join(' and ');
        await interaction.editReply({ content: `Could not find **${teamName}** in ${message}.` });
        return;
    }

    const labels = METRICS.map((metric) => metric.label);
    const valuesA = METRICS.map((metric) => Number(metric.getter(teamA)) || 0);
    const valuesB = METRICS.map((metric) => Number(metric.getter(teamB)) || 0);

    const colorA = visibleColor(teamA.primaryColor || '#007bff');
    const colorB = visibleColor(teamB.primaryColor || teamB.secondaryColor || '#ff3b30', '#ff3b30');

    const chart = await renderMultiComparisonChart({
        labels,
        teamA: { label: `${teamA.teamName} - ${seasonAData.season ?? seasonAInput}`, values: valuesA, color: colorA },
        teamB: { label: `${teamB.teamName} - ${seasonBData.season ?? seasonBInput}`, values: valuesB, color: colorB },
        title: `Season Comparison - ${teamA.teamName}`,
    });

    const file = new AttachmentBuilder(chart, { name: 'season-compare.png' });

    const summaryLines = labels.slice(0, 12).map((label, index) => {
        const valueA = round(valuesA[index], 2);
        const valueB = round(valuesB[index], 2);
        return `- **${label}** - ${seasonAData.season ?? seasonAInput}: **${valueA}**, ${seasonBData.season ?? seasonBInput}: **${valueB}**`;
    });

    const extraLine = labels.length > 12 ? `- ...and ${labels.length - 12} more metrics in the chart.` : '';

    const embed = {
        title: `Teams - Season Compare (${teamA.teamName})`,
        description: [
            `Season A: **${seasonAData.season ?? seasonAInput}** - Season B: **${seasonBData.season ?? seasonBInput}**`,
            '',
            ...summaryLines,
            extraLine,
        ]
            .filter(Boolean)
            .join('\n'),
        color: colorIntFromHex(colorA),
        image: { url: 'attachment://season-compare.png' },
        thumbnail: teamA.imageUrl ? { url: teamA.imageUrl } : undefined,
        footer: teamB.imageUrl
            ? { text: teamB.teamName, icon_url: teamB.imageUrl }
            : { text: teamB.teamName },
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed], files: [file] });
}
