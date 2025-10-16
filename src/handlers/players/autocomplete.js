// src/handlers/players/autocomplete.js
import { fetchTeamStats } from '../../api/teamStats.js';
import { fetchCompetitionPlayers } from '../../api/playerStats.js';
import {
    resolveSeasonAndCompetition,
    buildSeasonSuggestions,
    normalizeCompetitionCode,
} from '../../utils/season.js';

// ---- Autocomplete (player names for players-pir player subcommand)
const PLAYERS_CACHE = new Map(); // cacheKey -> { at, payload }
const PLAYERS_CACHE_TTL = 60 * 1000;
const TEAMS_CACHE = new Map(); // cacheKey -> { at, data }
const TEAMS_CACHE_TTL = 60 * 1000;

const normalize = (value) =>
    (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '');

async function loadTeamLookup(seasonCode, competitionCode) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });
    const cacheKey = `${competition}:${season}`;
    const cached = TEAMS_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.at < TEAMS_CACHE_TTL) return cached.data;

    try {
        const data = await fetchTeamStats(season, competition);
        const teams = Array.isArray(data?.teams) ? data.teams : [];
        const set = new Set();

        for (const team of teams) {
            const strings = [
                team.teamName,
                team.shortName,
                team.teamCode,
            ]
                .filter(Boolean)
                .map(normalize)
                .filter(Boolean);
            for (const str of strings) set.add(str);
        }

        const result = { teams, set };
        TEAMS_CACHE.set(cacheKey, { at: now, data: result });
        return result;
    } catch (err) {
        console.error('[players autocomplete] failed to load teams:', err);
        return { teams: [], set: new Set() };
    }
}

async function loadPlayersPayload(seasonCode, competitionCode) {
    const { seasonCode: season, competitionCode: competition } = resolveSeasonAndCompetition({
        seasonInput: seasonCode,
        competitionInput: competitionCode,
    });
    const cacheKey = `${competition}:${season}`;
    const cached = PLAYERS_CACHE.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.at < PLAYERS_CACHE_TTL) return cached.payload;

    try {
        const [payload, teamLookup] = await Promise.all([
            fetchCompetitionPlayers({ seasonCode: season, competitionCode: competition }),
            loadTeamLookup(season, competition),
        ]);

        const teamSet = teamLookup.set;
        const players = Array.isArray(payload?.players) ? payload.players : [];

        const filtered = players.filter((row) => {
            if (!teamSet.size) return true;
            const tokens = [
                row?.player?.team?.name,
                row?.player?.team?.code,
                row?.player?.team?.tvCodes,
                row?.teamName,
                row?.teamCode,
                row?.clubNames,
            ]
                .filter(Boolean)
                .map(normalize)
                .filter(Boolean);
            return tokens.some((t) => teamSet.has(t));
        });

        const names = Array.from(
            new Set(
                filtered
                    .map((row) => (row?.player?.name || row?.playerName || '').trim())
                    .filter(Boolean),
            ),
        );

        const payloadWithNames = { payload, names };
        PLAYERS_CACHE.set(cacheKey, { at: now, payload: payloadWithNames });
        return payloadWithNames;
    } catch (err) {
        console.error('[players autocomplete] failed to load players:', err);
        return { payload: { players: [] }, names: [] };
    }
}

async function respondWithPlayers(interaction, query, seasonCode, competitionCode) {
    const { names } = await loadPlayersPayload(seasonCode, competitionCode);
    const filtered = (query ? names.filter((n) => n.toLowerCase().includes(query)) : names).slice(0, 25);
    try {
        await interaction.respond(filtered.map((n) => ({ name: n, value: n })));
    } catch {
        try { await interaction.respond([]); } catch {}
    }
}

async function respondWithTeams(interaction, query, seasonCode, competitionCode) {
    const { teams } = await loadTeamLookup(seasonCode, competitionCode);
    const normalizedQuery = normalize(query);
    const seen = new Set();
    const suggestions = [];

    for (const team of teams) {
        const candidates = [
            team?.teamName,
            team?.shortName,
            team?.teamCode,
        ].filter(Boolean);

        for (const name of candidates) {
            const norm = normalize(name);
            if (!norm || seen.has(norm)) continue;
            if (normalizedQuery && !norm.includes(normalizedQuery)) continue;
            seen.add(norm);
            suggestions.push(name);
        }
    }

    const payload = suggestions.slice(0, 25).map((name) => ({ name, value: name }));
    try {
        await interaction.respond(payload);
    } catch {
        try { await interaction.respond([]); } catch {}
    }
}

function resolveSeasonInput(interaction) {
    const candidateKeys = ['seasoncode', 'season', 'season_a', 'season_b'];
    for (const key of candidateKeys) {
        try {
            const val = interaction.options?.getString?.(key);
            if (val) return val;
        } catch {
            // ignore
        }
    }
    return null;
}

function resolveCompetitionInput(interaction) {
    try {
        return interaction.options?.getString?.('competition') || null;
    } catch {
        return null;
    }
}

async function respondWithSeasons(interaction, focused) {
    const competitionCode = normalizeCompetitionCode(resolveCompetitionInput(interaction));
    const seasons = buildSeasonSuggestions({ competitionCode });
    const rawQuery = (focused?.value ?? '').toString().trim();
    const digitsQuery = rawQuery.replace(/[^0-9]/g, '');
    const filtered = seasons
        .filter((year) => !digitsQuery || year.startsWith(digitsQuery))
        .slice(0, 25)
        .map((year) => ({
            name: `${competitionCode}${year}`,
            value: year,
        }));
    try {
        await interaction.respond(filtered);
    } catch {
        try { await interaction.respond([]); } catch {}
    }
}

export async function handleAutocomplete(interaction) {
    let focused;
    try {
        focused = interaction.options.getFocused(true);
    } catch {
        try { await interaction.respond([]); } catch {}
        return;
    }

    const cmd = interaction.commandName;

    const focusedName = focused?.name;
    if (focusedName && ['seasoncode', 'season', 'season_a', 'season_b'].includes(focusedName)) {
        await respondWithSeasons(interaction, focused);
        return;
    }

    if (focused?.name === 'player') {
        const q = (focused.value ?? '').toString().toLowerCase();
        const seasonInput = resolveSeasonInput(interaction);
        const competitionInput = resolveCompetitionInput(interaction);
        await respondWithPlayers(interaction, q, seasonInput, competitionInput);
        return;
    }

    if (focused?.name === 'team') {
        const seasonInput = resolveSeasonInput(interaction);
        const competitionInput = resolveCompetitionInput(interaction);
        const query = (focused.value ?? '').toString();
        await respondWithTeams(interaction, query, seasonInput, competitionInput);
        return;
    }

    try { await interaction.respond([]); } catch {}
}
