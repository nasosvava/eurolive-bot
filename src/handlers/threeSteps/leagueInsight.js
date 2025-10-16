// src/handlers/threeSteps/leagueInsight.js
import { fetchThreeStepsDataset } from '../../api/threeStepsGeneric.js';
import { colorIntFromHex, round } from '../../analytics/util.js';

const COMPETITION_LABELS = new Map([
    ['euroleague', 'EuroLeague'],
    ['eurocup', 'EuroCup'],
    ['nba', 'NBA'],
    ['esake', 'ESAKE'],
    ['bundesliga', 'Bundesliga'],
    ['bcl', 'Basketball Champions League'],
    ['lnb', 'LNB'],
    ['tbf', 'TBF'],
    ['eurobasket', 'EuroBasket'],
    ['acb', 'ACB'],
    ['lba', 'LBA'],
]);

const DATASET_LABELS = {
    best_players: 'Best Players',
    club_stats: 'Club Stats',
    standings: 'Standings',
};

const DEFAULT_COLOR = 0x0099ff;

function formatSeasonsList(payload) {
    const seasons = payload?.seasons;
    if (!Array.isArray(seasons) || !seasons.length) return null;
    const items = seasons.slice(0, 8).map((season) => {
        const label = season.season || season.competitionId || 'Unknown';
        const id = season.competitionId ? ` (${season.competitionId})` : '';
        return `${label}${id}`;
    });
    const suffix = seasons.length > items.length ? '…' : '';
    return `Available seasons: ${items.join(', ')}${suffix}`;
}

function formatBestPlayersEmbed({ data, leagueLabel }) {
    const players = Array.isArray(data?.players) ? data.players : [];
    if (!players.length) {
        return {
            title: `${leagueLabel} — Best Players`,
            description: 'No player data returned.',
            color: DEFAULT_COLOR,
        };
    }

    const lines = players.slice(0, 12).map((player, idx) => {
        const name = `${player.firstname ?? ''} ${player.surname ?? ''}`.trim() || 'Unknown';
        const club = player.clubName || player.clubId || 'Team';
        const pts = round(player.points, 1).toFixed(1);
        const reb = round((player.offRebounds || 0) + (player.defRebounds || 0), 1).toFixed(1);
        const ast = round(player.assists, 1).toFixed(1);
        return `${idx + 1}. **${name}** (${club}) — PTS **${pts}** • REB **${reb}** • AST **${ast}**`;
    });

    return {
        title: `${leagueLabel} — Best Players`,
        description: lines.join('\n'),
        color: colorIntFromHex(players[0]?.primaryColor || DEFAULT_COLOR),
    };
}

function deriveRatings(team) {
    const pointsFor =
        (team.madeTwo ?? 0) * 2 +
        (team.madeThree ?? 0) * 3 +
        (team.madeFt ?? 0);
    const pointsAgainst =
        (team.oppMadeTwo ?? 0) * 2 +
        (team.oppMadeThree ?? 0) * 3 +
        (team.oppMadeFt ?? 0);

    const ortg = team.offPossessions > 0 ? (pointsFor) / team.offPossessions * 100 : null;
    const drtg = team.defPossessions > 0 ? (pointsAgainst) / team.defPossessions * 100 : null;
    const net = (ortg != null && drtg != null) ? ortg - drtg : null;
    return { ortg, drtg, net };
}

function formatClubStatsEmbed({ data, leagueLabel }) {
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    if (!teams.length) {
        return {
            title: `${leagueLabel} — Club Stats`,
            description: 'No team data returned.',
            color: DEFAULT_COLOR,
        };
    }

    const withRatings = teams.map((team) => ({
        team,
        ...deriveRatings(team),
    }));

    const ranked = withRatings
        .filter((entry) => entry.ortg != null && entry.drtg != null)
        .sort((a, b) => (b.net ?? -Infinity) - (a.net ?? -Infinity))
        .slice(0, 12);

    const lines = ranked.map((entry, idx) => {
        const name = entry.team.teamName || entry.team.shortName || entry.team.clubId || 'Team';
        const ortg = entry.ortg != null ? round(entry.ortg, 1).toFixed(1) : '—';
        const drtg = entry.drtg != null ? round(entry.drtg, 1).toFixed(1) : '—';
        const net = entry.net != null ? round(entry.net, 1).toFixed(1) : '—';
        return `${idx + 1}. **${name}** — ORTG **${ortg}** • DRTG **${drtg}** • NET **${net}**`;
    });

    return {
        title: `${leagueLabel} — Club Stats`,
        description: lines.join('\n'),
        color: colorIntFromHex(ranked[0]?.team?.primaryColor || DEFAULT_COLOR),
    };
}

function formatStandingsEmbed({ data, leagueLabel }) {
    const stages = Array.isArray(data?.stages) ? data.stages : [];
    const divisions = stages.flatMap((stage) => stage?.divisions || []);

    if (!divisions.length) {
        return {
            title: `${leagueLabel} — Standings`,
            description: 'No standings data returned.',
            color: DEFAULT_COLOR,
        };
    }

    const sections = divisions
        .map((division) => {
            const records = Array.isArray(division?.records) ? division.records : [];
            if (!records.length) return null;

            const lines = records.map((team, idx) => {
                const name = team.clubName || team.clubId || 'Team';
                const wins = team.wins ?? 0;
                const losses = Math.max(0, (team.games ?? wins) - wins);
                const pf = round(team.pointsFor ?? 0, 1).toFixed(0);
                const pa = round(team.pointsAgainst ?? 0, 1).toFixed(0);
                return `${idx + 1}. **${name}** — ${wins}-${losses} (PF ${pf} / PA ${pa})`;
            });

            const header = `**${division?.divisionName || 'Standings'}**`;
            return [header, ...lines].join('\n');
        })
        .filter(Boolean);

    return {
        title: `${leagueLabel} — Standings`,
        description: sections.join('\n\n'),
        color: DEFAULT_COLOR,
    };
}

function formatDatasetEmbed({ dataset, data, leagueLabel }) {
    switch (dataset) {
        case 'best_players':
            return formatBestPlayersEmbed({ data, leagueLabel });
        case 'club_stats':
            return formatClubStatsEmbed({ data, leagueLabel });
        case 'standings':
            return formatStandingsEmbed({ data, leagueLabel });
        default:
            return {
                title: `${leagueLabel} — ${DATASET_LABELS[dataset] || 'Dataset'}`,
                description: 'Unsupported dataset.',
                color: DEFAULT_COLOR,
            };
    }
}

export async function leagueInsight(interaction) {
    await interaction.deferReply();

    const competition = interaction.options.getString('competition', true);
    const dataset = interaction.options.getString('dataset', true);
    const seasonId = interaction.options.getString('season_id') || null;

    try {
        const data = await fetchThreeStepsDataset({ dataset, league: competition, seasonId });
        const leagueLabel = COMPETITION_LABELS.get(competition) || competition.toUpperCase();

        const embed = formatDatasetEmbed({ dataset, data, leagueLabel });

        const seasonLine = formatSeasonsList(data);
        if (seasonLine) {
            embed.fields = [
                { name: 'Season', value: data?.season || data?.competitionId || 'Current', inline: true },
                { name: 'Available Seasons', value: seasonLine, inline: false },
            ];
        } else if (data?.season || data?.competitionId) {
            embed.fields = [
                { name: 'Season', value: data.season || data.competitionId, inline: true },
            ];
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[leagueInsight]', err);
        await interaction.editReply({ content: `Failed to load data: ${err.message}` });
    }
}
