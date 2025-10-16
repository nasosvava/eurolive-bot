// src/v3/players/stats/leaders.js
import { EmbedBuilder } from 'discord.js';
import { fetchCompetitionPlayers } from '../../../api/playerStats.js';
import { competitionLabel } from '../../../config/competitions.js';

const normalizeHexColor = (value) => {
    if (!value) return null;
    let str = String(value).trim();
    if (!str) return null;
    if (str.startsWith('rgb')) return null;
    if (/^0x/i.test(str)) str = str.replace(/^0x/i, '#');
    if (!str.startsWith('#')) str = `#${str}`;
    if (/^#[0-9a-f]{3}$/i.test(str)) {
        str = `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`;
    }
    if (!/^#[0-9a-f]{6}$/i.test(str)) return null;
    return str.toUpperCase();
};

const pickColor = (...sources) => {
    for (const candidate of sources) {
        const color = normalizeHexColor(candidate);
        if (color) return color;
    }
    return null;
};

const extractTeamVisual = (row) => {
    const team = row?.player?.team ?? row?.team ?? {};

    const containers = [
        team,
        team.colors,
        team.teamColors,
        row?.teamColors,
        row?.clubColors,
    ].filter(Boolean);

    const primaryCandidates = [];
    containers.forEach((container) => {
        primaryCandidates.push(
            container.primaryColor,
            container.primary_colour,
            container.primaryColour,
            container.primary_color,
            container.primary,
            container.main,
            container.mainColor,
            container.mainColour,
            container.colorPrimary,
            container.colourPrimary,
            container.hex,
            container.hex1,
            container.color1,
            container.colour1,
        );
    });

    const teamColor = pickColor(...primaryCandidates);

    const imageCandidates = [
        team.imageUrl,
        team.logoUrl,
        team.logo,
        team.crest,
        team.badge,
        team.media?.logo,
        team.media?.image,
    ];

    for (const candidate of imageCandidates) {
        const url = String(candidate || '').trim();
        if (!url) continue;
        if (/^(https?:)?\/\//i.test(url)) {
            return {
                teamColor,
                teamImage: url.startsWith('http') ? url : `https:${url}`,
            };
        }
    }

    return { teamColor, teamImage: null };
};

async function loadTraditional({ seasonCode, competitionCode }) {
    const payload = await fetchCompetitionPlayers({ seasonCode, competitionCode });
    return payload;
}

const safeNum = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const fmtMinutesDecimalToMMSS = (minDec) => {
    const totalSeconds = Math.round(safeNum(minDec) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const baseRow = (source) => {
    const { teamColor, teamImage } = extractTeamVisual(source);
    return {
        name: source?.player?.name ?? source?.playerName ?? 'Unknown',
        team: source?.player?.team?.name ?? source?.clubNames ?? source?.teamName ?? 'N/A',
        games: safeNum(source?.gamesPlayed, 0),
        teamColor,
        teamImage,
    };
};

const top20 = (rows, keySelector, tiebreakers = []) => {
    const ordered = rows.slice();
    ordered.sort((a, b) => {
        const keyA = keySelector(a);
        const keyB = keySelector(b);
        if (keyB !== keyA) return keyB - keyA;
        for (const tb of tiebreakers) {
            const valueA = tb(a);
            const valueB = tb(b);
            if (valueB !== valueA) return valueB - valueA;
        }
        return a.name.localeCompare(b.name);
    });
    return ordered.filter((row) => keySelector(row) > 0).slice(0, 20);
};

function dataSourceLabel(competitionCode) {
    return competitionCode === 'E' || competitionCode === 'U'
        ? 'EuroLeague API v3'
        : '3Steps analytics dataset';
}

export function buildLeadersEmbed(rows, { payload, title, unit, valueFormatter } = {}) {
    const seasonLabel = payload?.season || payload?.competitionId || 'Season unknown';
    const competitionCode = payload?.competitionCode;
    const competitionName = competitionLabel(competitionCode);
    const embed = new EmbedBuilder()
        .setTitle(`${title} - ${seasonLabel}`)
        .setTimestamp(new Date());

    if (competitionName) {
        embed.setFooter({ text: `${competitionName} • ${dataSourceLabel(competitionCode)}` });
    }

    if (!rows?.length) {
        embed.setDescription('No data');
        return embed;
    }

    const firstColor = rows[0]?.teamColor;
    const firstImage = rows[0]?.teamImage;
    if (firstColor) embed.setColor(firstColor);
    if (firstImage) embed.setThumbnail(firstImage);

    const lines = rows.map((row, index) => {
        const rawValue = valueFormatter ? valueFormatter(row) : row.statValue.toFixed(1);
        return `**${index + 1}. ${row.name}**\n(${row.team})\n${unit}: ${rawValue} • GP: ${row.games}`;
    });

    embed.setDescription(lines.join('\n\n'));
    return embed;
}

export async function getTop20Leaders({ seasonCode, competitionCode, stat = 'pointsScored' }) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        return { ...row, statValue: safeNum(player?.[stat], 0) };
    });
    const rows = top20(mapped, (row) => row.statValue, [(row) => row.games]);
    return { rows, payload };
}

export async function getTop20OffReb({ seasonCode, competitionCode } = {}) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        return { ...row, statValue: safeNum(player?.offensiveRebounds, 0) };
    });
    const rows = top20(mapped, (row) => row.statValue, [(row) => row.games]);
    return { rows, payload };
}

export async function getTop20DefReb({ seasonCode, competitionCode } = {}) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        return { ...row, statValue: safeNum(player?.defensiveRebounds, 0) };
    });
    const rows = top20(mapped, (row) => row.statValue, [(row) => row.games]);
    return { rows, payload };
}

export async function getTop20ThreePtPct({ seasonCode, competitionCode, minAttempts = 1 }) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        const makes = safeNum(player?.threePointersMade, 0);
        const attempts = safeNum(player?.threePointersAttempted, 0);
        const pct = attempts > 0 ? makes / attempts : 0;
        return { ...row, makes, att: attempts, statValue: pct };
    });
    const filtered = mapped.filter((row) => row.att >= minAttempts);
    const rows = top20(filtered, (row) => row.statValue, [(row) => row.makes, (row) => row.games]);
    return { rows, payload };
}

export async function getTop20FGPct({ seasonCode, competitionCode, minFGA = 2 }) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        const twoMade = safeNum(player?.twoPointersMade, 0);
        const twoAtt = safeNum(player?.twoPointersAttempted, 0);
        const threeMade = safeNum(player?.threePointersMade, 0);
        const threeAtt = safeNum(player?.threePointersAttempted, 0);
        const made = twoMade + threeMade;
        const attempted = twoAtt + threeAtt;
        const pct = attempted > 0 ? made / attempted : 0;
        return { ...row, fgm: made, fga: attempted, statValue: pct };
    });
    const filtered = mapped.filter((row) => row.fga >= minFGA);
    const rows = top20(filtered, (row) => row.statValue, [(row) => row.fgm, (row) => row.games]);
    return { rows, payload };
}

export async function getTop20FTPct({ seasonCode, competitionCode, minFTA = 2 }) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        const made = safeNum(player?.freeThrowsMade, 0);
        const attempted = safeNum(player?.freeThrowsAttempted, 0);
        const pct = attempted > 0 ? made / attempted : 0;
        return { ...row, ftm: made, fta: attempted, statValue: pct };
    });
    const filtered = mapped.filter((row) => row.fta >= minFTA);
    const rows = top20(filtered, (row) => row.statValue, [(row) => row.ftm, (row) => row.games]);
    return { rows, payload };
}

export async function getTop20Minutes({ seasonCode, competitionCode } = {}) {
    const payload = await loadTraditional({ seasonCode, competitionCode });
    const players = Array.isArray(payload?.players) ? payload.players : [];
    const mapped = players.map((player) => {
        const row = baseRow(player);
        return { ...row, statValue: safeNum(player?.minutesPlayed, 0) };
    });
    const rows = top20(mapped, (row) => row.statValue, [(row) => row.games]);
    return { rows, payload };
}

export const formatters = {
    pct: (row) => `${(row.statValue * 100).toFixed(1)}%`,
    mmss: (row) => fmtMinutesDecimalToMMSS(row.statValue),
};
