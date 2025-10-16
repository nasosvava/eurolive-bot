// src/handlers/players/leaders.js
import { resolveSeasonAndCompetition } from '../../utils/season.js';

import {
    getTop20Leaders,
    buildLeadersEmbed,
    getTop20OffReb,
    getTop20DefReb,
    getTop20ThreePtPct,
    getTop20FGPct,
    getTop20FTPct,
    getTop20Minutes,
    formatters,
} from '../../v3/players/stats/leaders.js';

function seasonContext(interaction) {
    const seasonInput = interaction.options.getString('seasoncode');
    const competitionInput = interaction.options.getString('competition') || null;
    return resolveSeasonAndCompetition({ seasonInput, competitionInput });
}

// ---- Leaders (points, rebounds, etc.)
export async function playersTopScorers(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'pointsScored' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Scorers', unit: 'PTS' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopRebounders(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'totalRebounds' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Rebounders', unit: 'REB' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopAssists(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'assists' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Assists', unit: 'AST' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopSteals(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'steals' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Steals', unit: 'STL' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopBlocks(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'blocks' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Blocks', unit: 'BLK' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopTurnovers(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'turnovers' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Turnovers', unit: 'TOV' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopFouls(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Leaders({ seasonCode, competitionCode, stat: 'foulsDrawn' });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Fouls Drawn', unit: 'FD' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopOffReb(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20OffReb({ seasonCode, competitionCode });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Offensive Rebounds', unit: 'OREB' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopDefReb(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20DefReb({ seasonCode, competitionCode });
    const embed = buildLeadersEmbed(rows, { payload, title: 'Top 20 Defensive Rebounds', unit: 'DREB' });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTop3ptPct(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    const minAttempts = interaction.options.getInteger('min_attempts') ?? 1;
    await interaction.deferReply();
    const { rows, payload } = await getTop20ThreePtPct({ seasonCode, competitionCode, minAttempts });
    const embed = buildLeadersEmbed(rows, {
        payload,
        title: `Top 20 3PT% (min ${minAttempts} 3PA)`,
        unit: '3PT%',
        valueFormatter: formatters.pct,
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopFgPct(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
   const minFGA = interaction.options.getInteger('min_fga') ?? 2;
    await interaction.deferReply();
    const { rows, payload } = await getTop20FGPct({ seasonCode, competitionCode, minFGA });
    const embed = buildLeadersEmbed(rows, {
        payload,
        title: `Top 20 FG% (min ${minFGA} FGA)`,
        unit: 'FG%',
        valueFormatter: formatters.pct,
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopFtPct(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    const minFTA = interaction.options.getInteger('min_fta') ?? 2;
    await interaction.deferReply();
    const { rows, payload } = await getTop20FTPct({ seasonCode, competitionCode, minFTA });
    const embed = buildLeadersEmbed(rows, {
        payload,
        title: `Top 20 FT% (min ${minFTA} FTA)`,
        unit: 'FT%',
        valueFormatter: formatters.pct,
    });
    await interaction.editReply({ embeds: [embed] });
}

export async function playersTopMinutes(interaction) {
    const { seasonCode, competitionCode } = seasonContext(interaction);
    await interaction.deferReply();
    const { rows, payload } = await getTop20Minutes({ seasonCode, competitionCode });
    const embed = buildLeadersEmbed(rows, {
        payload,
        title: 'Top 20 Minutes',
        unit: 'MIN',
        valueFormatter: formatters.mmss,
    });
    await interaction.editReply({ embeds: [embed] });
}
