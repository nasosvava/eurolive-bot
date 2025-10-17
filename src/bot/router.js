// src/bot/router.js
import { Events } from 'discord.js';
import { enforceChannel } from './guards.js';

import {
    handleAutocomplete as coreAuto,
    ping, standings, today, week, live, previousGame,
} from '../handlers/core.js';

import {
    teamsTopOffense, teamsTopDefense, teamsTop3ptPct, teamsWorst3ptPct,
    teamsTop2ptPct, teamsWorst2ptPct, teamsTopFtPct, teamsWorstFtPct, teamsPointsDiff,
    teamsOffensiveRating, teamsDefensiveRating, teamsNetRating, teamAnalytics, teamRating, teamsStat,
    teamsChart, teamsCompare, teamsOdds, teamsSeasonCompare, teamsRatingChart
} from '../handlers/teams.js';

import {
    handleAutocomplete as playersAuto,
    playersPir,
    playersTopScorers, playersTopRebounders, playersTopAssists, playersTopSteals,
    playersTopBlocks, playersTopTurnovers, playersTopFouls,
    playersTopOffReb, playersTopDefReb, playersTop3ptPct, playersTopFgPct, playersTopFtPct,
    playersTopMinutes, playersRatings, playerInsight,
} from '../handlers/players.js';
import { handleAutocomplete as teamsAuto } from '../handlers/teams/autocomplete.js';
import { leagueInsight } from '../handlers/threeSteps/leagueInsight.js';
import {chartTest, fontTest} from "../handlers/debug.js";



export function wireInteractions(client) {
    client.on(Events.InteractionCreate, async (interaction) => {
        try {
            // ---- Autocomplete
            if (interaction.isAutocomplete()) {
                if (await enforceChannel(interaction)) return;
                await coreAuto(interaction);
                await teamsAuto(interaction);
                await playersAuto(interaction);
                return;
            }

            if (!interaction.isChatInputCommand()) return;
            if (await enforceChannel(interaction)) return;

            // ---- Core
            if (interaction.commandName === 'ping') return ping(interaction);
            if (interaction.commandName === 'standings') return wrap(standings, interaction);
            if (interaction.commandName === 'today') return wrap(today, interaction);
            if (interaction.commandName === 'week') return wrap(week, interaction);
            if (interaction.commandName === 'live') return wrap(live, interaction);
            if (interaction.commandName === 'previous-game') return wrap(previousGame, interaction);

            // ---- Teams
            if (interaction.commandName === 'teams-top-offense') return wrap(teamsTopOffense, interaction);
            if (interaction.commandName === 'teams-top-defense') return wrap(teamsTopDefense, interaction);
            if (interaction.commandName === 'teams-top-3pt-pct') return wrap(teamsTop3ptPct, interaction);
            if (interaction.commandName === 'teams-worst-3pt-pct') return wrap(teamsWorst3ptPct, interaction);
            if (interaction.commandName === 'teams-top-2pt-pct') return wrap(teamsTop2ptPct, interaction);
            if (interaction.commandName === 'teams-worst-2pt-pct') return wrap(teamsWorst2ptPct, interaction);
            if (interaction.commandName === 'teams-top-ft-pct') return wrap(teamsTopFtPct, interaction);
            if (interaction.commandName === 'teams-worst-ft-pct') return wrap(teamsWorstFtPct, interaction);
            if (interaction.commandName === 'teams-points-diff') return wrap(teamsPointsDiff, interaction);
            if (interaction.commandName === 'team-analytics') return wrap(teamAnalytics, interaction);
            if (interaction.commandName === 'team-rating') return wrap(teamRating, interaction);
            if (interaction.commandName === 'teams-offensive-rating') return wrap(teamsOffensiveRating, interaction);
            if (interaction.commandName === 'teams-defensive-rating') return wrap(teamsDefensiveRating, interaction);
            if (interaction.commandName === 'teams-net-rating') return wrap(teamsNetRating, interaction);
            if (interaction.commandName === 'teams-compare') return wrap(teamsCompare, interaction);
            if (interaction.commandName === 'teams-stat') return wrap(teamsStat, interaction);
            if (interaction.commandName === 'teams-chart') return wrap(teamsChart, interaction);
            if (interaction.commandName === 'teams-rating-chart') return wrap(teamsRatingChart, interaction);
            if (interaction.commandName === 'teams-odds') return wrap(teamsOdds, interaction);
            if (interaction.commandName === 'teams-season-compare') return wrap(teamsSeasonCompare, interaction);
            if (interaction.commandName === 'league-insight') return wrap(leagueInsight, interaction);


            // ---- Players
            if (interaction.commandName === 'players-pir') return wrap(playersPir, interaction);

            if (interaction.commandName === 'players-top-scorers') return wrap(playersTopScorers, interaction);
            if (interaction.commandName === 'players-top-rebounders') return wrap(playersTopRebounders, interaction);
            if (interaction.commandName === 'players-top-assists') return wrap(playersTopAssists, interaction);
            if (interaction.commandName === 'players-top-steals') return wrap(playersTopSteals, interaction);
            if (interaction.commandName === 'players-top-blocks') return wrap(playersTopBlocks, interaction);
            if (interaction.commandName === 'players-top-turnovers') return wrap(playersTopTurnovers, interaction);
            if (interaction.commandName === 'players-top-fouls') return wrap(playersTopFouls, interaction);
            if (interaction.commandName === 'players-top-off-reb') return wrap(playersTopOffReb, interaction);
            if (interaction.commandName === 'players-top-def-reb') return wrap(playersTopDefReb, interaction);
            if (interaction.commandName === 'players-top-3pt-pct') return wrap(playersTop3ptPct, interaction);
            if (interaction.commandName === 'players-top-fg-pct') return wrap(playersTopFgPct, interaction);
            if (interaction.commandName === 'players-top-ft-pct') return wrap(playersTopFtPct, interaction);
            if (interaction.commandName === 'players-top-minutes') return wrap(playersTopMinutes, interaction);
            if (interaction.commandName === 'players-ratings') return wrap(playersRatings, interaction);
            if (interaction.commandName === 'player-insight') return wrap(playerInsight, interaction);
            if (interaction.commandName === 'font-test') return wrap(fontTest, interaction);
            if (interaction.commandName === 'chart-test') return wrap(chartTest, interaction);

        } catch (err) {
            console.error('interaction error:', err);
            try {
                if (interaction.isRepliable()) {
                    await interaction.reply({ content: 'Something went wrong while processing that command.', ephemeral: true });
                }
            } catch {}
        }
    });
}

// small helper to keep try/catch noise localized
async function wrap(fn, interaction) {
    try {
        await fn(interaction);
    } catch (err) {
        console.error(`${interaction.commandName} error:`, err);
        // Most handlers already deferReply() and editReply with specific messages.
        // If something throws before deferring, show a generic ephemeral error:
        if (!interaction.deferred && !interaction.replied) {
            await interaction.reply({ content: `⚠️ Couldn’t process **/${interaction.commandName}**.`, ephemeral: true });
        }
    }
}



