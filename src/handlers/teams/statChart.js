// src/handlers/teams/statChart.js
import { AttachmentBuilder } from 'discord.js';
import { fetchTeamStats } from '../../api/teamStats.js';
import { metricByKey } from '../../analytics/statsCatalog.js';
import { renderHorizontalBar } from '../../charts/render.js';
import { colorIntFromHex, round, mapTeamsAnalytics } from '../../analytics/util.js';
import { seasonLineFrom } from './shared.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';

function buildRows(teams, meta) {
    return teams.map((team) => ({
        teamName: team.teamName || team.shortName || 'Unknown',
        shortName: team.shortName || '',
        primaryColor: team.primaryColor || '#0099ff',
        imageUrl: team.imageUrl || null,
        value: meta.getter(team),
    }));
}

function findRowIndex(rows, query) {
    const q = query.trim().toLowerCase();
    return rows.findIndex((row) => {
        const name = row.teamName.toLowerCase();
        const short = row.shortName.toLowerCase();
        return name === q || short === q || name.includes(q) || q.includes(name);
    });
}

async function loadTeams(metricKey, seasonInput, competitionInput) {
    const meta = metricByKey(metricKey);
    if (!meta) return { meta: null, rows: [], seasonLabel: null, data: null };

    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput,
        competitionInput,
    });

    const data = await fetchTeamStats(seasonCode, competitionCode);
    const teams = Array.isArray(data.teams) ? data.teams : [];
    const rows = buildRows(teams, meta).sort((a, b) =>
        meta.dir === 'asc' ? a.value - b.value : b.value - a.value,
    );

    return {
        meta,
        rows,
        seasonLabel: seasonLineFrom(data, seasonCode),
        data,
    };
}

export async function teamsStat(interaction) {
    await interaction.deferReply();

    const metricKey = interaction.options.getString('metric', true);
    const queryTeam = interaction.options.getString('team') || null;
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition') || null;

    const { meta, rows, seasonLabel } = await loadTeams(metricKey, seasonInput, competitionInput);
    if (!meta) {
        await interaction.editReply({ content: `Unknown metric: ${metricKey}` });
        return;
    }

    if (rows.length === 0) {
        await interaction.editReply({ content: 'No team data available.' });
        return;
    }

    if (queryTeam) {
        const idx = findRowIndex(rows, queryTeam);
        if (idx === -1) {
            await interaction.editReply({ content: `Team **${queryTeam}** not found.` });
            return;
        }

        const row = rows[idx];
        const rank = idx + 1;
        const embed = {
            title: `Teams - ${meta.label}`,
            description: [
                seasonLabel,
                '',
                `**${rank}. ${row.teamName}** - **${row.value}**`,
                meta.dir === 'asc' ? '_Lower is better_' : '_Higher is better_',
            ].join('\n'),
            color: colorIntFromHex(row.primaryColor),
            thumbnail: row.imageUrl ? { url: row.imageUrl } : undefined,
            timestamp: new Date().toISOString(),
        };
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const lines = rows.map((row, index) => {
        const rank = String(index + 1).padStart(2, ' ');
        return `${rank}. **${row.teamName}** - **${row.value}**`;
    });

    const embed = {
        title: `Teams - ${meta.label}`,
        description: [
            seasonLabel,
            '',
            ...lines,
            '',
            meta.dir === 'asc' ? '_Sorted ascending (lower is better)_' : '_Sorted descending (higher is better)_',
        ].join('\n'),
        color: colorIntFromHex(rows[0]?.primaryColor),
        thumbnail: rows[0]?.imageUrl ? { url: rows[0].imageUrl } : undefined,
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
}

export async function teamsChart(interaction) {
    await interaction.deferReply();

    try {
        const metricKey = interaction.options.getString('metric', true);
        const limit = interaction.options.getInteger('limit') ?? 20;
        const seasonInput = interaction.options.getString('season') || undefined;
        const competitionInput = interaction.options.getString('competition') || null;

        const { meta, rows, data } = await loadTeams(metricKey, seasonInput, competitionInput);
        if (!meta) {
            await interaction.editReply({ content: `Unknown metric: ${metricKey}` });
            return;
        }

        if (rows.length === 0) {
            await interaction.editReply({ content: 'No team data available.' });
            return;
        }

        const seasonText = data?.season ?? seasonInput ?? null;
        const slice = rows.slice(0, Math.min(Math.max(limit, 5), 20));
        const labels = slice.map((row) => row.teamName);
        const values = slice.map((row) => row.value);

        const colors = slice.map((row) => row.primaryColor || '#0099ff');
        const png = await renderHorizontalBar({
            labels,
            values,
            title: `${meta.label} - Top ${slice.length}${seasonText ? ` (${seasonText})` : ''}`,
            xLabel: meta.label,
            colors,
        });

        const file = new AttachmentBuilder(png, { name: 'chart.png' });

        const listLines = slice
            .map((row, index) => {
                const rank = String(index + 1).padStart(2, ' ');
                const val = Number.isFinite(row.value) ? round(row.value, 1) : row.value;
                return `${rank}. **${row.teamName}** - **${val}**`;
            })
            .join('\n');

        const embed = {
            title: `Teams - ${meta.label}${seasonText ? ` (${seasonText})` : ''}`,
            description: [
                meta.dir === 'asc'
                    ? '_Sorted ascending (lower is better)_'
                    : '_Sorted descending (higher is better)_',
                '',
                listLines,
            ].join('\n'),
            color: colorIntFromHex(slice[0]?.primaryColor),
            image: { url: 'attachment://chart.png' },
            thumbnail: slice[0]?.imageUrl ? { url: slice[0].imageUrl } : undefined,
            timestamp: new Date().toISOString(),
        };

        await interaction.editReply({ embeds: [embed], files: [file] });
    } catch (err) {
        console.error('teams-chart error:', err);
        await interaction.editReply({
            content:
                'Stats service is temporarily unavailable (502/timeout). Cached data will be used when possible. Please try again later or omit the `season` option to use the current season.',
        });
    }
}

export async function teamsRatingChart(interaction) {
    await interaction.deferReply();

    try {
        const seasonInput = interaction.options.getString('season') || undefined;
        const competitionInput = interaction.options.getString('competition') || null;
        const includeOffensive = interaction.options.getBoolean('offensive');
        const includeDefensive = interaction.options.getBoolean('defensive');
        const includePace = interaction.options.getBoolean('pace');
        const anySpecified = [includeOffensive, includeDefensive, includePace].some((value) => value !== null);

        const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
            seasonInput,
            competitionInput,
        });

        const data = await fetchTeamStats(seasonCode, competitionCode);
        const analytics = mapTeamsAnalytics(data.teams || []);

        if (!analytics.length) {
            await interaction.editReply({ content: 'No team data available.' });
            return;
        }

        const seasonLabel = seasonLineFrom(data, seasonCode);

        const charts = [
            {
                id: 'offensive',
                metric: 'ortg',
                label: 'Offensive Rating',
                asc: false,
                file: 'offensive-rating.png',
                note: '_Sorted descending (higher is better)_',
            },
            {
                id: 'defensive',
                metric: 'drtg',
                label: 'Defensive Rating',
                asc: true,
                file: 'defensive-rating.png',
                note: '_Sorted ascending (lower is better)_',
            },
            {
                id: 'pace',
                metric: 'pace',
                label: 'Pace (possessions per game)',
                asc: false,
                file: 'pace.png',
                note: '_Sorted descending (higher is faster)_',
            },
        ];

        const activeCharts = charts.filter((chart) => {
            if (!anySpecified) return true;
            if (chart.id === 'offensive') return includeOffensive === true;
            if (chart.id === 'defensive') return includeDefensive === true;
            if (chart.id === 'pace') return includePace === true;
            return false;
        });

        if (!activeCharts.length) {
            await interaction.editReply({
                content: 'Please enable at least one of the `offensive`, `defensive`, or `pace` options.',
            });
            return;
        }

        const attachments = [];
        const sections = [];

        for (const chart of activeCharts) {
            const sorted = analytics
                .slice()
                .sort((a, b) => (chart.asc ? a[chart.metric] - b[chart.metric] : b[chart.metric] - a[chart.metric]));

            const labels = sorted.map((team) => team.teamName);
            const values = sorted.map((team) => round(team[chart.metric], 1));
            const colors = sorted.map((team) => team.colors?.primary || '#0099ff');

            const buffer = await renderHorizontalBar({
                labels,
                values,
                title: `${chart.label} (${seasonCode})`,
                xLabel: chart.label,
                colors,
            });

            attachments.push(new AttachmentBuilder(buffer, { name: chart.file }));

            const fullPreview = sorted.map((team, index) => {
                const value = round(team[chart.metric], 1).toFixed(1);
                return `${index + 1}. **${team.teamName}** — ${value}`;
            });

            sections.push([
                `**${chart.label}**`,
                chart.note,
                ...fullPreview,
                `[see attachment: ${chart.file}]`,
            ].join('\n'));
        }

        const chosenLabels = activeCharts.map((chart) => chart.label).join(', ');
        const embed = {
            title: 'Team Ratings Overview',
            description: [seasonLabel, '', ...sections].join('\n\n'),
            color: 0x0099ff,
            footer: { text: `Charts: ${chosenLabels}` },
            timestamp: new Date().toISOString(),
        };

        await interaction.editReply({ embeds: [embed], files: attachments });
    } catch (err) {
        console.error('teams-rating-chart error:', err);
        await interaction.editReply({
            content:
                'Unable to render rating charts right now. Please try again shortly.',
        });
    }
}
