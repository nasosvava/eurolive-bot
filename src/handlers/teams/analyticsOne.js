// src/handlers/teams/analyticsOne.js
import { fetchTeamStats } from '../../api/teamStats.js';
import { seasonLineFrom, safeDiv, pct, toPct, to1 } from './shared.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';
import { colorIntFromHex } from '../../analytics/util.js';
import { competitionLabel } from '../../config/competitions.js';

function findTeam(teams, needle) {
    const query = needle.trim().toLowerCase();
    return (teams || []).find((team) => {
        const name = String(team.teamName || '').trim().toLowerCase();
        const short = String(team.shortName || '').trim().toLowerCase();
        return (
            name === query ||
            short === query ||
            name.includes(query) ||
            short.includes(query) ||
            query.includes(name) ||
            query.includes(short)
        );
    }) || null;
}

export async function teamAnalytics(interaction) {
    await interaction.deferReply();

    const teamInput = interaction.options.getString('team', true);
    const seasonInput = interaction.options.getString('season') || undefined;
    const competitionInput = interaction.options.getString('competition');
    if (!competitionInput) {
        await interaction.editReply({ content: 'Please choose a competition before selecting a team.' });
        return;
    }

    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput,
        competitionInput,
    });

    const leagueName = competitionLabel(competitionCode);

    const data = await fetchTeamStats(seasonCode, competitionCode);
    const seasonLine = seasonLineFrom(data, seasonCode);
    const team = findTeam(data.teams, teamInput);

    if (!team) {
        await interaction.editReply({ content: `Team **${teamInput}** not found in ${leagueName} stats.` });
        return;
    }

    const {
        teamName,
        shortName,
        games = 0,
        wins = 0,
        secondsPlayed = 0,

        offPossessions = 0,
        defPossessions = 0,
        offPlays = 0,
        defPlays = 0,

        madeFt = 0,
        attemptedFt = 0,
        madeTwo = 0,
        attemptedTwo = 0,
        madeThree = 0,
        attemptedThree = 0,

        offRebounds = 0,
        defRebounds = 0,
        assists = 0,
        steals = 0,
        turnovers = 0,
        blocks = 0,
        fouls = 0,

        oppMadeFt = 0,
        oppAttemptedFt = 0,
        oppMadeTwo = 0,
        oppAttemptedTwo = 0,
        oppMadeThree = 0,
        oppAttemptedThree = 0,
        oppOffRebounds = 0,
        oppDefRebounds = 0,
        oppAssists = 0,
        oppSteals = 0,
        oppTurnovers = 0,
        oppBlocks = 0,
        oppFouls = 0,

        offRating: precomputedOrtg = null,
        defRating: precomputedDrtg = null,

        primaryColor,
        secondaryColor,
        imageUrl,
    } = team;

    const fieldGoalAttempts = attemptedTwo + attemptedThree;
    const fieldGoalsMade = madeTwo + madeThree;
    const pointsScored = 2 * madeTwo + 3 * madeThree + madeFt;

    const twoPct = pct(madeTwo, attemptedTwo);
    const threePct = pct(madeThree, attemptedThree);
    const ftPct = pct(madeFt, attemptedFt);
    const fgPct = pct(fieldGoalsMade, fieldGoalAttempts);
    const threeRate = pct(attemptedThree, Math.max(1, fieldGoalAttempts));
    const ftRate = pct(attemptedFt, Math.max(1, fieldGoalAttempts));

    let ortg = safeDiv(pointsScored, offPossessions) * 100;
    const pace = safeDiv(offPossessions + defPossessions, 2);

    const turnoverRate = pct(turnovers, Math.max(1, offPlays));
    const offRebPct = pct(offRebounds, offRebounds + oppDefRebounds);
    const defRebPct = pct(defRebounds, defRebounds + oppOffRebounds);
    const assistRate = pct(assists, Math.max(1, fieldGoalsMade));

    const oppFga = oppAttemptedTwo + oppAttemptedThree;
    const oppFgm = oppMadeTwo + oppMadeThree;
    const oppPoints = 2 * oppMadeTwo + 3 * oppMadeThree + oppMadeFt;

    let drtg = safeDiv(oppPoints, defPossessions) * 100;
    if (precomputedOrtg != null) {
        ortg = precomputedOrtg;
    }
    if (precomputedDrtg != null) {
        drtg = precomputedDrtg;
    }
    const net = (precomputedOrtg != null && precomputedDrtg != null)
        ? precomputedOrtg - precomputedDrtg
        : ortg - drtg;

    const losses = Math.max(0, games - wins);
    const minutesPlayed = secondsPlayed / 60;

    const fields = [
        {
            name: 'Record / Minutes / Pace',
            value: [
                `Record: **${wins}-${losses}** in **${games}** games`,
                `Minutes played: **${to1(minutesPlayed)}**`,
                `Pace (possessions per game): **${to1(pace)}**`,
            ].join('\n'),
            inline: false,
        },
        {
            name: 'Ratings (per 100 possessions)',
            value: [
                `Offensive Rating: **${to1(ortg)}**`,
                `Defensive Rating: **${to1(drtg)}**`,
                `Net Rating: **${to1(net)}**`,
            ].join(' - '),
            inline: false,
        },
        {
            name: 'Shooting',
            value: [
                `FG% **${toPct(fgPct)}** (FGM/FGA ${fieldGoalsMade}/${fieldGoalAttempts})`,
                `2P% **${toPct(twoPct)}** (2PM/2PA ${madeTwo}/${attemptedTwo})`,
                `3P% **${toPct(threePct)}** (3PM/3PA ${madeThree}/${attemptedThree})`,
                `FT% **${toPct(ftPct)}** (FTM/FTA ${madeFt}/${attemptedFt})`,
            ].join('\n'),
            inline: false,
        },
        {
            name: 'Shot Mix & Rates',
            value: [
                `3PA rate: **${toPct(threeRate)}**`,
                `FT rate (FTA/FGA): **${toPct(ftRate)}**`,
                `Turnover rate (per play): **${toPct(turnoverRate)}**`,
                `Assists per made FG: **${toPct(assistRate)}**`,
            ].join('\n'),
            inline: false,
        },
        {
            name: 'Rebounding Share',
            value: [
                `Offensive rebound%: **${toPct(offRebPct)}**`,
                `Defensive rebound%: **${toPct(defRebPct)}**`,
            ].join(' - '),
            inline: false,
        },
        {
            name: 'Counting Totals',
            value: `AST **${assists}** - STL **${steals}** - BLK **${blocks}** - TOV **${turnovers}** - PF **${fouls}**`,
            inline: false,
        },
        {
            name: 'Opponent Snapshot',
            value: [
                `Opponent points: **${oppPoints}** | Opp FGM/FGA: **${oppFgm}/${oppFga}**`,
                `AST **${oppAssists}** - STL **${oppSteals}** - BLK **${oppBlocks}** - TOV **${oppTurnovers}** - PF **${oppFouls}**`,
            ].join('\n'),
            inline: false,
        },
    ];

    const resolvedPrimary = primaryColor || '#0099ff';
    const resolvedSecondary = secondaryColor || '#222222';
    const colorInt = colorIntFromHex(resolvedPrimary);

    const embed = {
        title: `Team Analytics - ${teamName || shortName}`,
        description: `${seasonLine}  -  League: **${leagueName}**`,
        color: colorInt,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: `Primary: ${resolvedPrimary} - Secondary: ${resolvedSecondary}` },
        thumbnail: imageUrl ? { url: imageUrl } : undefined,
    };

    await interaction.editReply({ embeds: [embed] });
}
