// src/handlers/autocomplete.js
import { previousTeamAutocomplete } from '../../v1/schedule/previous.js';
import { METRICS } from '../../analytics/statsCatalog.js';
import { fetchTeamStats } from '../../api/teamStats.js';
import {
    resolveSeasonAndCompetition,
    buildSeasonSuggestions,
    normalizeCompetitionCode,
} from '../../utils/season.js';

const SUPPORTED_COMMANDS = new Set([
    'teams-points-diff',
    'teams-chart',
    'teams-stat',
    'teams-compare',
    'teams-net-rating',
    'teams-offensive-rating',
    'teams-defensive-rating',
    'team-analytics',
    'team-rating',
    'teams-rating-chart',
    'teams-odds',
    'teams-season-compare',
]);

function normaliseSeason(value) {
    if (!value) return undefined;
    return value.trim();
}

const normaliseText = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '');

async function loadTeamNames(seasonCode, competitionCode) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });

    const data = await fetchTeamStats(season, competition);
    const aliasToDisplay = new Map();
    const primaryNames = new Set();

    const pushAlias = (displayName, alias) => {
        const trimmed = (alias || '').trim();
        if (!trimmed) return;
        const norm = normaliseText(trimmed);
        if (!norm) return;
        if (!aliasToDisplay.has(norm)) aliasToDisplay.set(norm, displayName);
    };

    for (const team of data?.teams ?? []) {
        const display = (team.teamName || team.shortName || team.teamCode || 'Team').trim();
        if (!display) continue;

        primaryNames.add(display);
        pushAlias(display, display);
        pushAlias(display, team.shortName);
        pushAlias(display, team.teamCode);
        pushAlias(display, team.alias);

        if (typeof team.teamCode === 'string' && team.teamCode.includes('-')) {
            pushAlias(display, team.teamCode.replace(/-/g, ' '));
        }
    }

    return { aliasToDisplay, primaryNames: Array.from(primaryNames) };
}

function competitionInput(interaction) {
    try {
        return interaction.options.getString('competition') || null;
    } catch {
        return null;
    }
}

async function respondWithSeasons(interaction, focused) {
    const competitionCode = normalizeCompetitionCode(competitionInput(interaction));
    const seasons = buildSeasonSuggestions({ competitionCode });
    const query = (focused?.value ?? '').toString().trim();
    const digits = query.replace(/[^0-9]/g, '');
    const matches = seasons
        .filter((year) => !digits || year.startsWith(digits))
        .slice(0, 25)
        .map((year) => ({ name: `${competitionCode}${year}`, value: year }));
    try {
        await interaction.respond(matches);
    } catch {
        try { await interaction.respond([]); } catch {}
    }
}

export async function handleAutocomplete(interaction) {
    const cmd = interaction.commandName;

    if (!SUPPORTED_COMMANDS.has(cmd)) return;

    if (cmd === 'teams-points-diff') {
        return previousTeamAutocomplete(interaction);
    }

    let focused;
    try {
        focused = interaction.options.getFocused(true);
    } catch {
        try { await interaction.respond([]); } catch {}
        return;
    }

    const q = String(focused?.value ?? '').toLowerCase();
    if (focused?.name && ['season', 'seasoncode', 'season_a', 'season_b'].includes(focused.name)) {
        await respondWithSeasons(interaction, focused);
        return;
    }

    // Metric autocomplete
    const handleMetricAutocomplete = async (search, existingKeys) => {
        const lowerSearch = search.toLowerCase();
        const used = new Set(existingKeys.map((key) => key.toLowerCase()));
        const matches = METRICS
            .filter((metric) => !used.has(metric.key.toLowerCase()))
            .filter((metric) => {
                if (!lowerSearch) return true;
                const label = metric.label.toLowerCase();
                const key = metric.key.toLowerCase();
                return label.includes(lowerSearch) || key.includes(lowerSearch);
            })
            .slice(0, 25);
        return matches;
    };

    if ((cmd === 'teams-chart' || cmd === 'teams-stat') && focused?.name === 'metric') {
        const matches = await handleMetricAutocomplete(q, []);
        const items = matches.map((metric) => ({ name: metric.label, value: metric.key }));
        await interaction.respond(items);
        return;
    }

    if (cmd === 'teams-compare' && focused?.name === 'metrics') {
        const raw = String(focused.value ?? '');
        const segments = raw.split(',').map((segment) => segment.trim()).filter(Boolean);
        if (!raw.trim()) {
            // Show everything when empty so metrics stay optional.
            const matches = await handleMetricAutocomplete('', []);
            const payload = matches.map((metric) => ({ name: metric.label, value: metric.key }));
            await interaction.respond(payload);
            return;
        }

        const hasTrailingComma = raw.endsWith(',');
        const selected = hasTrailingComma ? segments : segments.slice(0, -1);
        const currentSearch = hasTrailingComma ? '' : (segments[segments.length - 1] || '');

        const matches = await handleMetricAutocomplete(currentSearch, selected);
        const payload = matches.map((metric) => {
            const nextSelection = hasTrailingComma
                ? [...segments, metric.key]
                : [...selected, metric.key];
            const value = nextSelection.filter(Boolean).join(', ');
            return { name: metric.label, value };
        });
        await interaction.respond(payload);
        return;
    }

    // Team suggestions
    const respondWithTeams = async (seasonCodes) => {
        const seasons = seasonCodes.filter(Boolean);
        const competition = competitionInput(interaction);
        if (!competition && (cmd === 'teams-compare' || cmd === 'team-analytics')) {
            try { await interaction.respond([]); } catch {}
            return;
        }
        const aliasToDisplay = new Map();
        const displayCandidates = new Set();

        if (!seasons.length) {
            seasons.push(undefined);
        }

        for (const season of seasons) {
            try {
                const { aliasToDisplay: aliasMap, primaryNames } = await loadTeamNames(season, competition);
                primaryNames.forEach((name) => displayCandidates.add(name));
                for (const [alias, display] of aliasMap.entries()) {
                    if (!aliasToDisplay.has(alias)) aliasToDisplay.set(alias, display);
                }
            } catch {
                // ignore and continue
            }
        }

        const queryNorm = normaliseText(q);
        const matches = new Set();

        if (queryNorm) {
            for (const [alias, display] of aliasToDisplay.entries()) {
                if (alias.includes(queryNorm)) matches.add(display);
            }
        } else {
            displayCandidates.forEach((name) => matches.add(name));
        }

        const list = Array.from(matches);
        const filtered = list.slice(0, 25);
        const payload = filtered.map((name) => ({ name, value: name }));
        try {
            await interaction.respond(payload);
        } catch {
            try { await interaction.respond([]); } catch {}
        }
    };

    if (focused?.name === 'team') {
        const season = normaliseSeason(interaction.options.getString?.('season'));
        await respondWithTeams([season]);
        return;
    }

    if (cmd === 'teams-season-compare' && focused?.name === 'team') {
        const seasonA = normaliseSeason(interaction.options.getString?.('season_a'));
        const seasonB = normaliseSeason(interaction.options.getString?.('season_b'));
        await respondWithTeams([seasonA, seasonB]);
        return;
    }

    if (cmd === 'teams-compare' && (focused?.name === 'team_a' || focused?.name === 'team_b')) {
        const season = normaliseSeason(interaction.options.getString?.('season'));
        await respondWithTeams([season]);
        return;
    }

    if (cmd === 'teams-odds' && (focused?.name === 'team_a' || focused?.name === 'team_b')) {
        await respondWithTeams([undefined]);
        return;
    }

    try { await interaction.respond([]); } catch {}
}
