// src/handlers/teams/ratings.js
import { fetchTeamStats } from '../../api/teamStats.js';
import {
    colorIntFromHex,
    mapTeamsAnalytics,
    round,
    sortByDrtg,
    sortByNetRtg,
    sortByOrtg,
} from '../../analytics/util.js';
import { seasonLineFrom } from './shared.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';

function findTeamIndex(analytics, query) {
    const needle = query.trim().toLowerCase();
    return analytics.findIndex((team) => {
        const name = team.teamName.toLowerCase();
        const short = team.shortName.toLowerCase();
        return (
            name === needle ||
            short === needle ||
            name.includes(needle) ||
            needle.includes(name)
        );
    });
}

async function loadAnalytics(seasonInput, competitionInput) {
    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput,
        competitionInput,
    });

    const data = await fetchTeamStats(seasonCode, competitionCode);
    const analytics = mapTeamsAnalytics(data.teams || []);
    const seasonLine = seasonLineFrom(data, seasonCode);

    return { analytics, seasonLine };
}

function formatAllTeamsEmbed({ title, seasonLine, lines, leader }) {
    const color = colorIntFromHex(leader?.colors?.primary || '#0099ff');
    return {
        title,
        description: [seasonLine, '', ...lines].join('\n'),
        color,
        thumbnail: leader?.imageUrl ? { url: leader.imageUrl } : undefined,
        timestamp: new Date().toISOString(),
    };
}

function formatSingleTeamEmbed({ title, seasonLine, team, rank, body }) {
    const color = colorIntFromHex(team.colors?.primary || '#0099ff');
    return {
        title,
        description: [
            seasonLine,
            '',
            `**${rank}. ${team.teamName}**`,
            body,
        ].join('\n'),
        color,
        thumbnail: team.imageUrl ? { url: team.imageUrl } : undefined,
        timestamp: new Date().toISOString(),
    };
}

export async function teamsNetRating(interaction) {
    await interaction.deferReply();

    const queryTeam = interaction.options.getString('team');
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition') || null;

    const { analytics, seasonLine } = await loadAnalytics(seasonInput, competitionInput);
    const sorted = analytics.sort(sortByNetRtg(true));

    if (!sorted.length) {
        await interaction.editReply({ content: 'No team data available.' });
        return;
    }

    if (queryTeam) {
        const idx = findTeamIndex(sorted, queryTeam);
        if (idx === -1) {
            await interaction.editReply({ content: `Team **${queryTeam}** not found.` });
            return;
        }

        const team = sorted[idx];
        const rank = idx + 1;
        const body = `NET **${round(team.netRtg, 1).toFixed(1)}** • ORTG ${round(team.ortg, 1).toFixed(1)} • DRTG ${round(team.drtg, 1).toFixed(1)}`;
        const embed = formatSingleTeamEmbed({
            title: 'Net Rating — Team',
            seasonLine,
            team,
            rank,
            body,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const lines = sorted.map((team, index) => {
        const rank = String(index + 1).padStart(2, ' ');
        const net = round(team.netRtg, 1).toFixed(1);
        const o = round(team.ortg, 1).toFixed(1);
        const d = round(team.drtg, 1).toFixed(1);
        return `${rank}. **${team.teamName}** — NET **${net}** (ORTG ${o} • DRTG ${d})`;
    });

    const embed = formatAllTeamsEmbed({
        title: 'Net Rating — All Teams',
        seasonLine,
        lines,
        leader: sorted[0],
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function teamsOffensiveRating(interaction) {
    await interaction.deferReply();

    const queryTeam = interaction.options.getString('team');
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition') || null;

    const { analytics, seasonLine } = await loadAnalytics(seasonInput, competitionInput);
    const sorted = analytics.sort(sortByOrtg(true));

    if (!sorted.length) {
        await interaction.editReply({ content: 'No team data available.' });
        return;
    }

    if (queryTeam) {
        const idx = findTeamIndex(sorted, queryTeam);
        if (idx === -1) {
            await interaction.editReply({ content: `Team **${queryTeam}** not found.` });
            return;
        }

        const team = sorted[idx];
        const rank = idx + 1;
        const body = `ORTG **${round(team.ortg, 1).toFixed(1)}** • DRTG ${round(team.drtg, 1).toFixed(1)} • NET ${round(team.netRtg, 1).toFixed(1)}`;
        const embed = formatSingleTeamEmbed({
            title: 'Offensive Rating — Team',
            seasonLine,
            team,
            rank,
            body,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const lines = sorted.map((team, index) => {
        const rank = String(index + 1).padStart(2, ' ');
        const o = round(team.ortg, 1).toFixed(1);
        const d = round(team.drtg, 1).toFixed(1);
        const n = round(team.netRtg, 1).toFixed(1);
        return `${rank}. **${team.teamName}** — ORTG **${o}** (DRTG ${d} • NET ${n})`;
    });

    const embed = formatAllTeamsEmbed({
        title: 'Offensive Rating — All Teams',
        seasonLine,
        lines,
        leader: sorted[0],
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function teamsDefensiveRating(interaction) {
    await interaction.deferReply();

    const queryTeam = interaction.options.getString('team');
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition') || null;

    const { analytics, seasonLine } = await loadAnalytics(seasonInput, competitionInput);
    const sorted = analytics.sort(sortByDrtg(false));

    if (!sorted.length) {
        await interaction.editReply({ content: 'No team data available.' });
        return;
    }

    if (queryTeam) {
        const idx = findTeamIndex(sorted, queryTeam);
        if (idx === -1) {
            await interaction.editReply({ content: `Team **${queryTeam}** not found.` });
            return;
        }

        const team = sorted[idx];
        const rank = idx + 1;
        const body = `DRTG **${round(team.drtg, 1).toFixed(1)}** • ORTG ${round(team.ortg, 1).toFixed(1)} • NET ${round(team.netRtg, 1).toFixed(1)}`;
        const embed = formatSingleTeamEmbed({
            title: 'Defensive Rating — Team',
            seasonLine,
            team,
            rank,
            body,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    const lines = sorted.map((team, index) => {
        const rank = String(index + 1).padStart(2, ' ');
        const d = round(team.drtg, 1).toFixed(1);
        const o = round(team.ortg, 1).toFixed(1);
        const n = round(team.netRtg, 1).toFixed(1);
        return `${rank}. **${team.teamName}** — DRTG **${d}** (ORTG ${o} • NET ${n})`;
    });

    const embed = formatAllTeamsEmbed({
        title: 'Defensive Rating — All Teams',
        seasonLine,
        lines,
        leader: sorted[0],
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function teamRating(interaction) {
    await interaction.deferReply();

    const teamQuery = interaction.options.getString('team', true);
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition') || null;

    const { analytics, seasonLine } = await loadAnalytics(seasonInput, competitionInput);
    if (!analytics.length) {
        await interaction.editReply({ content: 'No team data available.' });
        return;
    }

    const idx = findTeamIndex(analytics, teamQuery);
    if (idx === -1) {
        await interaction.editReply({ content: `Team **${teamQuery}** not found.` });
        return;
    }

    const team = analytics[idx];
    const color = colorIntFromHex(team.colors?.primary || '#0099ff');
    const embed = {
        title: `${team.teamName} — Ratings`,
        description: [
            seasonLine,
            '',
            `• Offensive Rating (per 100 possessions): **${round(team.ortg, 1).toFixed(1)}**`,
            `• Defensive Rating (per 100 possessions): **${round(team.drtg, 1).toFixed(1)}**`,
            `• Net Rating: **${round(team.netRtg, 1).toFixed(1)}**`,
            '',
            `Pace (possessions per game): **${round(team.pace, 1).toFixed(1)}**`,
        ].join('\n'),
        color,
        thumbnail: team.imageUrl ? { url: team.imageUrl } : undefined,
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
}
