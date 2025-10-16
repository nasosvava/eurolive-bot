// src/handlers/players/insight.js
import { fetchCompetitionPlayers } from '../../api/playerStats.js';
import { resolveSeasonAndCompetition } from '../../utils/season.js';
import { competitionLabel } from '../../config/competitions.js';
import { colorIntFromHex } from '../../analytics/util.js';

const normalize = (value) =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const dataSourceLabel = (competitionCode) =>
    competitionCode === 'E' || competitionCode === 'U'
        ? 'EuroLeague API v3'
        : '3Steps analytics dataset';

const safeNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const toNumberOrNull = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const fmtNumber = (value, digits = 1) => {
    const n = toNumberOrNull(value);
    return n == null ? '—' : n.toFixed(digits);
};

const pctLine = (made, attempted) => {
    const m = toNumberOrNull(made);
    const a = toNumberOrNull(attempted);
    if (!a) return '—';
    const pct = ((m ?? 0) / a) * 100;
    return `${pct.toFixed(1)}% (${fmtNumber(m, 1)}/${fmtNumber(a, 1)})`;
};

const pctValue = (value) => {
    const n = toNumberOrNull(value);
    return n == null ? '—' : `${n.toFixed(1)}%`;
};

const matchesTeam = (row, query) => {
    const needle = normalize(query);
    if (!needle) return true;
    const candidates = [
        row?.teamName,
        row?.teamCode,
        row?.player?.team?.name,
        row?.player?.team?.code,
        row?.player?.team?.tvCodes,
    ]
        .filter(Boolean)
        .map(normalize)
        .filter(Boolean);
    if (!candidates.length) return false;
    return candidates.some((cand) => cand.includes(needle) || needle.includes(cand));
};

const matchesPlayerName = (row, query) => {
    const needle = normalize(query);
    if (!needle) return false;
    const name = normalize(row?.player?.name || row?.playerName);
    if (!name) return false;
    const tokens = needle.split(' ').filter(Boolean);
    return tokens.every((token) => name.includes(token));
};

const sortCandidates = (a, b) => {
    const gamesDelta = safeNum(b.gamesPlayed) - safeNum(a.gamesPlayed);
    if (gamesDelta !== 0) return gamesDelta;
    const pirDelta = safeNum(b.pir) - safeNum(a.pir);
    if (pirDelta !== 0) return pirDelta;
    const pointsDelta = safeNum(b.pointsScored) - safeNum(a.pointsScored);
    if (pointsDelta !== 0) return pointsDelta;
    const ratingDelta = safeNum(b.overallRating) - safeNum(a.overallRating);
    if (ratingDelta !== 0) return ratingDelta;
    return (b.player?.name || '').localeCompare(a.player?.name || '');
};

export async function playerInsight(interaction) {
    await interaction.deferReply();

    const playerInput = interaction.options.getString('player', true);
    const competitionInput = interaction.options.getString('competition', true);
    const seasonInput = interaction.options.getString('season') || null;
    const teamInput = interaction.options.getString('team') || null;

    const { seasonCode, competitionCode } = resolveSeasonAndCompetition({
        seasonInput,
        competitionInput,
    });

    try {
        const payload = await fetchCompetitionPlayers({ seasonCode, competitionCode });
        const players = Array.isArray(payload?.players) ? payload.players : [];

        if (!players.length) {
            await interaction.editReply({
                content: `No player data available for **${competitionLabel(competitionCode)}** (${payload?.season || seasonCode}).`,
            });
            return;
        }

        let pool = players;
        if (teamInput) {
            pool = pool.filter((row) => matchesTeam(row, teamInput));
        }

        let candidates = pool.filter((row) => matchesPlayerName(row, playerInput));

        if (!candidates.length && !teamInput) {
            const loose = normalize(playerInput);
            if (loose) {
                candidates = pool.filter((row) => {
                    const name = normalize(row?.player?.name || row?.playerName);
                    return name.includes(loose) || loose.includes(name);
                });
            }
        }

        if (!candidates.length) {
            await interaction.editReply({
                content: `Could not find **${playerInput}**${teamInput ? ` on team **${teamInput}**` : ''} in **${competitionLabel(competitionCode)}** (${payload?.season || seasonCode}).`,
            });
            return;
        }

        candidates.sort(sortCandidates);
        const row = candidates[0];

        const teamName = row?.player?.team?.name || row?.teamName || row?.clubNames || 'Unknown team';
        const games = safeNum(row?.gamesPlayed);
        const minutes = toNumberOrNull(row?.minutesPlayed);
        const points = toNumberOrNull(row?.pointsScored ?? row?.points);
        const rebounds = toNumberOrNull(row?.totalRebounds);
        const assists = toNumberOrNull(row?.assists);
        const steals = toNumberOrNull(row?.steals);
        const blocks = toNumberOrNull(row?.blocks);
        const turnovers = toNumberOrNull(row?.turnovers);
        const fouls = toNumberOrNull(row?.foulsCommited);
        const foulsDrawn = toNumberOrNull(row?.foulsDrawn ?? row?.foulsReceived);

        const twoMade = toNumberOrNull(row?.twoPointersMade);
        const twoAtt = toNumberOrNull(row?.twoPointersAttempted);
        const threeMade = toNumberOrNull(row?.threePointersMade);
        const threeAtt = toNumberOrNull(row?.threePointersAttempted);
        const ftMade = toNumberOrNull(row?.freeThrowsMade);
        const ftAtt = toNumberOrNull(row?.freeThrowsAttempted);
        const fgm = (twoMade ?? 0) + (threeMade ?? 0);
        const fga = (twoAtt ?? 0) + (threeAtt ?? 0);

        const usage = row?.usgRate ?? row?.usageRate ?? row?.usagePct;
        const assistPct = row?.assistPct ?? row?.assistPercentage;
        const turnoverPct = row?.trnPct ?? row?.turnoverPct;
        const reboundPct = row?.rbPct ?? row?.reboundPct;

        const teamPoints = toNumberOrNull(row?.teamPoints);
        const oppPoints = toNumberOrNull(row?.oppPoints);
        const teamPoss = toNumberOrNull(row?.teamPossessionsNet);
        const oppPoss = toNumberOrNull(row?.oppPossessionsNet);
        const onOrt = teamPoints != null && teamPoss > 0 ? (teamPoints / teamPoss) * 100 : null;
        const onDrt = oppPoints != null && oppPoss > 0 ? (oppPoints / oppPoss) * 100 : null;
        const onNet = onOrt != null && onDrt != null ? onOrt - onDrt : null;

        const competitionName = competitionLabel(competitionCode);
        const seasonLabel = payload?.season || payload?.competitionId || seasonCode;
        const dataSource = dataSourceLabel(competitionCode);

        const colorHex =
            row?.primaryColor ||
            row?.player?.team?.colors?.primaryColor ||
            row?.teamColors?.primaryColor ||
            '#0099ff';
        const color = colorIntFromHex(colorHex);
        const thumbnailCandidates = [
            row?.imageUrl,
            row?.player?.imageUrl,
            row?.player?.team?.imageUrl,
            row?.player?.team?.logo,
            row?.player?.team?.crest,
        ];
        const thumbnail = thumbnailCandidates
            .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
            .find((url) => url && /^(https?:)?\/\//i.test(url));

        const statsLine = [
            `PTS **${fmtNumber(points)}**`,
            `REB **${fmtNumber(rebounds)}**`,
            `AST **${fmtNumber(assists)}**`,
        ];
        if (minutes != null) statsLine.push(`MIN **${fmtNumber(minutes)}**`);

        const shootingLines = [
            `FG: ${pctLine(fgm, fga)}`,
            `2P: ${pctLine(twoMade, twoAtt)}`,
            `3P: ${pctLine(threeMade, threeAtt)}`,
            `FT: ${pctLine(ftMade, ftAtt)}`,
        ];

        const advancedEntries = [
            { label: 'Usage', value: usage, formatter: pctValue },
            { label: 'Assist%', value: assistPct, formatter: pctValue },
            { label: 'Turnover%', value: turnoverPct, formatter: pctValue },
            { label: 'Rebound%', value: reboundPct, formatter: pctValue },
            { label: 'Overall Rating', value: row?.overallRating, formatter: (v) => fmtNumber(v, 1) },
            { label: 'PIR', value: row?.pir, formatter: (v) => fmtNumber(v, 1) },
        ];
        const advancedLines = advancedEntries
            .filter(({ value }) => toNumberOrNull(value) != null)
            .map(({ label, value, formatter }) => `${label}: ${formatter(value)}`);

        const defenseEntries = [
            { label: 'STL', value: steals },
            { label: 'BLK', value: blocks },
            { label: 'TOV', value: turnovers },
        ];
        const foulsEntries = [
            { label: 'Fouls', value: fouls },
            { label: 'Drawn', value: foulsDrawn },
        ];

        const defenseLines = [];
        const primaryDefense = defenseEntries
            .filter(({ value }) => toNumberOrNull(value) != null)
            .map(({ label, value }) => `${label} **${fmtNumber(value)}**`);
        if (primaryDefense.length) {
            defenseLines.push(primaryDefense.join(' | '));
        }
        const foulsLine = foulsEntries
            .filter(({ value }) => toNumberOrNull(value) != null)
            .map(({ label, value }) => `${label}: **${fmtNumber(value)}**`)
            .join(' | ');
        if (foulsLine) {
            defenseLines.push(foulsLine);
        }

        const onOffLines = [];
        if (onOrt != null && onDrt != null) {
            onOffLines.push(`On/Off ORtg **${fmtNumber(onOrt)}** | DRtg **${fmtNumber(onDrt)}** | Net **${fmtNumber(onNet)}**`);
        }
        if (teamPoints != null && oppPoints != null) {
            onOffLines.push(`Team pts **${fmtNumber(teamPoints)}** vs Opp pts **${fmtNumber(oppPoints)}** (per game while on court)`);
        }

        const fields = [];
        fields.push({ name: 'Shooting Splits', value: shootingLines.join('\n'), inline: false });
        if (advancedLines.length) {
            fields.push({ name: 'Playmaking & Advanced', value: advancedLines.join('\n'), inline: false });
        }
        if (defenseLines.length) {
            fields.push({ name: 'Defense & Control', value: defenseLines.join('\n'), inline: false });
        }

        const embed = {
            title: `${row?.player?.name || row?.playerName || playerInput} - ${teamName}`,
            description: [
                `Season: **${seasonLabel}**`,
                `Competition: **${competitionName}**`,
                `Games: **${games}**`,
                statsLine.join(' | '),
            ].join('\n'),
            color,
            fields,
            footer: { text: `${competitionName} | ${dataSource}` },
            timestamp: new Date().toISOString(),
        };

        if (onOffLines.length) {
            embed.fields.push({ name: 'On/Off Snapshot', value: onOffLines.join('\n'), inline: false });
        }

        if (thumbnail) {
            const resolved = thumbnail.startsWith('http') ? thumbnail : `https:${thumbnail}`;
            embed.thumbnail = { url: resolved };
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[playerInsight] failed', err);
        await interaction.editReply({
            content: 'Failed to load player analytics. Please try again in a moment.',
        });
    }
}
