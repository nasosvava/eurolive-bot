import { EmbedBuilder } from "discord.js";
import { fetchTeamStats } from "../../api/teamStats.js";
import { fetchCompetitionPlayers } from "../../api/playerStats.js";
import { indexTeamsByKeys, findTeamForPlayer } from "../../analytics/playerRatings.js";
import { computeIndividualRatingsBlended } from "../../analytics/playerRatingsBlend.js";
import { resolveSeasonAndCompetition } from "../../utils/season.js";

function normaliseName(value) {
    return String(value || '')
        .replace(/[,/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function tokenize(value) {
    return normaliseName(value)
        .split(' ')
        .filter(Boolean);
}

function matchesPlayer(query, candidate) {
    const qTokens = tokenize(query);
    const cTokens = tokenize(candidate);
    if (!qTokens.length || !cTokens.length) return false;
    return qTokens.every((qt) => cTokens.some((ct) => ct.startsWith(qt)));
}

function formatNumber(value, digits = 1, prefixSign = false) {
    if (value == null || !Number.isFinite(value)) return '-';
    const fixed = value.toFixed(digits);
    if (!prefixSign) return fixed;
    return Number(fixed) > 0 ? '+' + fixed : fixed;
}

function calcTeamRating(points, possessions) {
    const pts = Number(points);
    const poss = Number(possessions);
    if (!Number.isFinite(pts) || !Number.isFinite(poss) || poss <= 0) return null;
    return (pts / poss) * 100;
}

function buildTeamField(baseTeam) {
    if (!baseTeam) {
        return { name: 'Team Ratings (per 100 poss)', value: '_Not available for this player._', inline: false };
    }

    const off = calcTeamRating(baseTeam?.TePts, baseTeam?.offPossessions);
    const def = calcTeamRating(baseTeam?.oppStats?.pts, baseTeam?.defPossessions);
    const net = off != null && def != null ? off - def : null;

    const lines = [
        `TM ORtg: **${formatNumber(off)}**`,
        `TM DRtg: **${formatNumber(def)}**`,
        `TM Net: **${formatNumber(net, 1, true)}**`,
    ];

    return {
        name: 'Team Ratings (per 100 poss)',
        value: lines.join('\n'),
        inline: false,
    };
}

export async function playersRatings(interaction) {
    await interaction.deferReply();

    const playerName = interaction.options.getString('player', true);
    const seasonInput = interaction.options.getString('seasoncode') || null;
    const competitionInput = interaction.options.getString('competition') || null;
    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput,
        competitionInput,
    });

    let playersPayload;
    try {
        playersPayload = await fetchCompetitionPlayers({ seasonCode, competitionCode });
    } catch (err) {
        console.error('players-ratings: failed to fetch players', err);
        await interaction.editReply({ content: 'Could not load player stats for that season.' });
        return;
    }

    const players = Array.isArray(playersPayload?.players) ? playersPayload.players : [];

    const candidates = players.filter((row) =>
        matchesPlayer(playerName, row?.player?.name || row?.playerName || ''),
    );

    if (!candidates.length) {
        await interaction.editReply({ content: `Could not find **${playerName}** in ${seasonCode}.` });
        return;
    }

    const playerRow = candidates[0];
    const clubName = playerRow?.player?.team?.name || playerRow?.teamName || 'Unknown team';

    let teamsData;
    try {
        teamsData = await fetchTeamStats(seasonCode, competitionCode);
    } catch (err) {
        console.error('players-ratings: fetchTeamStats failed', err);
        await interaction.editReply({ content: 'Failed to load team stats for that season.' });
        return;
    }

    const teamIndex = indexTeamsByKeys(teamsData?.teams || []);
    const team = findTeamForPlayer(playerRow, teamIndex);
    if (!team) {
        await interaction.editReply({
            content: `Could not locate team data for **${clubName}** (${seasonCode}).`,
        });
        return;
    }

    const ratings = await computeIndividualRatingsBlended({
        playerRow,
        team,
        seasonCode,
    });
    const individual = ratings.final;

    const avatarUrl = [
        playerRow?.player?.imageUrl,
        playerRow?.player?.image,
        playerRow?.details?.imageUrl,
        playerRow?.imageUrl,
    ]
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .find((url) => url.length > 0) || null;

    const embed = new EmbedBuilder()
        .setTitle(`${playerRow?.player?.name || playerName}`)
        .setDescription(
            [
                `Team: **${clubName}**`,
                `Season: **${seasonCode}**`,
                `Games: **${playerRow?.gamesPlayed ?? '-'}**  |  Minutes: **${formatNumber(playerRow?.minutesPlayed, 1)} mpg**`,
            ].join('\n'),
        )
        .setColor(team.primaryColor || '#0099ff')
        .addFields(
            buildTeamField(ratings.base.team),
            {
                name: 'Individual Ratings (per 100 poss)',
                value: [
                    `IND ORtg: **${formatNumber(individual.offRating)}**`,
                    `IND DRtg: **${formatNumber(individual.defRating)}**`,
                    `IND Net: **${formatNumber(individual.netRating, 1, true)}**`,
                ].join('\n'),
                inline: false,
            },
        )
        .setTimestamp(new Date());

    if (avatarUrl) {
        embed.setThumbnail(avatarUrl);
    }

    await interaction.editReply({ embeds: [embed] });
}


