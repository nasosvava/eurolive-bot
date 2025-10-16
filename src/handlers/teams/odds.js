// src/handlers/teams/odds.js
import { fetchTeamStats } from '../../api/teamStats.js';
import { deriveTeamAnalytics, colorIntFromHex, round } from '../../analytics/util.js';
import { getHomeAwaySplits } from '../../analytics/homeAway.js';
import { computeMatchupOdds, projectPoints, selectVenueRatings } from '../../analytics/odds.js';

function normalise(value) {
    return String(value || '').trim().toLowerCase();
}

function findTeam(teams, name) {
    const target = normalise(name);
    return (
        teams.find((t) => normalise(t.teamName) === target || normalise(t.shortName) === target) ||
        teams.find((t) => normalise(t.teamName).includes(target))
    );
}

export async function teamsOdds(interaction) {
    await interaction.deferReply();

    const teamAName = interaction.options.getString('team_a', true).trim();
    const teamBName = interaction.options.getString('team_b', true).trim();
    const venueOpt = interaction.options.getString('venue') || 'A'; // 'A' (home) or 'neutral'

    const data = await fetchTeamStats(); // current season
    const teams = Array.isArray(data.teams) ? data.teams : [];

    const rawA = findTeam(teams, teamAName);
    const rawB = findTeam(teams, teamBName);

    if (!rawA || !rawB) {
        await interaction.editReply({ content: 'Could not find one or both teams.' });
        return;
    }

    const teamA = deriveTeamAnalytics(rawA);
    const teamB = deriveTeamAnalytics(rawB);

    let venue = null;
    if (venueOpt === 'A') venue = 'A';
    if (venueOpt === 'B') venue = 'B';

    const splits = await getHomeAwaySplits({ seasoncode: data.season || undefined });
    const splitA = splits[teamA.teamName];
    const splitB = splits[teamB.teamName];

    const { A, B, used } = selectVenueRatings(teamA, teamB, splitA, splitB, venue);

    const { pA, pB, odds } = computeMatchupOdds(A, B, {
        home: venue,
        hcaPer100: venue ? 2.5 : 0,
        k: 0.2,
    });

    const pace = (A.pace + B.pace) / 2 || 70;
    const { aPts, bPts, total } = projectPoints(A, B, pace);

    const aPct = round(pA * 100, 1);
    const bPct = round(pB * 100, 1);
    const aPtsStr = round(aPts, 1);
    const bPtsStr = round(bPts, 1);
    const totalStr = round(total, 1);

    const color = colorIntFromHex(rawA.primaryColor || '#0099ff');

    const embed = {
        title: 'Fun Odds — Ratings-based Projection',
        description: [
            data.season ? `Season: **${data.season}**` : '',
            `**${teamA.teamName} (Home)** vs **${teamB.teamName} (Away)**`,
            `Venue model: **${venue ? (venue === 'A' ? 'Team A Home' : 'Team B Home') : 'Neutral'}**`,
            `Ratings used: **${used}**`,
            '',
            '**Win Probabilities (no-vig, for fun)**',
            `• ${teamA.teamName}: **${aPct}%** (decimal **${odds.a}**)`,
            `• ${teamB.teamName}: **${bPct}%** (decimal **${odds.b}**)`,
            '',
            `**Projected points (pace ~ ${round(pace, 1)})**`,
            `• ${teamA.teamName}: **${aPtsStr}**`,
            `• ${teamB.teamName}: **${bPtsStr}**`,
            `• **Total:** **${totalStr}**`,
            '',
            '_DISCLAIMER: Entertainment only — not betting advice._',
        ].join('\n'),
        color,
        thumbnail: rawA.imageUrl ? { url: rawA.imageUrl } : undefined,
        footer: rawB.imageUrl
            ? { text: teamB.teamName, icon_url: rawB.imageUrl }
            : { text: teamB.teamName },
        timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
}
