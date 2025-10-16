// src/handlers/players/pir.js
import { resolveSeasonAndCompetition } from '../../utils/season.js';

import {
    getTop20PirForCurrentSeason,
    buildPirTop20Embed,
    getPlayerPirForSeason,
    getPlayerPirAllSeasons,
    buildPirPlayerSeasonEmbed,
    buildPirPlayerAllSeasonsEmbed,
} from '../../v3/players/stats/pir.js';

// ---- PIR
export async function playersPir(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    if (sub === 'leaders') {
        const competitionInput = interaction.options.getString('competition') || null;
        const { seasonCode, competitionCode } = resolveSeasonAndCompetition({ competitionInput });
        const { rows, payload } = await getTop20PirForCurrentSeason({ seasonCode, competitionCode });
        const embed = buildPirTop20Embed(rows, { payload });
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    if (sub === 'player') {
        const player = interaction.options.getString('player', true);
        const seasoncode = interaction.options.getString('seasoncode') || null;
        const allSeasons = interaction.options.getBoolean('all_seasons') || false;
        const competitionInput = interaction.options.getString('competition') || null;
        const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
            seasonInput: seasoncode,
            competitionInput,
        });

        if (allSeasons) {
            const rows = await getPlayerPirAllSeasons({ player, competitionCode });
            const embed = buildPirPlayerAllSeasonsEmbed({ player, rows, competitionCode });
            await interaction.editReply({ embeds: [embed] });
        } else {
            const row = await getPlayerPirForSeason({ player, seasonCode, competitionCode });
            const embed = buildPirPlayerSeasonEmbed({ player, seasonCode, competitionCode, row });
            await interaction.editReply({ embeds: [embed] });
        }
    }
}
