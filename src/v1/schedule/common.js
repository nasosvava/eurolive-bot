import {
    DEFAULT_SEASON,
    EUROLEAGUE_SCHEDULES,
    EUROLEAGUE_BOXSCORE,
} from '../../env.js';
import { XMLParser } from 'fast-xml-parser';

// Flip on if you want to see verbose logs while developing
export const DEBUG_SCHEDULE = false;
const DEFAULT_TIME_ZONE = 'Europe/Athens';
const MONTH_LOOKUP = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
};
const TEAM_TIMEZONES = {
    ASV: 'Europe/Paris',
    BAR: 'Europe/Madrid',
    BAS: 'Europe/Madrid',
    DUB: 'Asia/Dubai',
    HTA: 'Asia/Jerusalem',
    IST: 'Europe/Istanbul',
    MAD: 'Europe/Madrid',
    MCO: 'Europe/Monaco',
    MIL: 'Europe/Rome',
    MUN: 'Europe/Berlin',
    OLY: 'Europe/Athens',
    PAM: 'Europe/Madrid',
    PAN: 'Europe/Athens',
    PAR: 'Europe/Belgrade',
    PRS: 'Europe/Paris',
    RED: 'Europe/Belgrade',
    TEL: 'Asia/Jerusalem',
    ULK: 'Europe/Istanbul',
    VIR: 'Europe/Rome',
    ZAL: 'Europe/Vilnius',
};

/* ----------------------------- Fetchers ----------------------------- */
export async function fetchSchedule(seasonCode) {
    const sc = (seasonCode || '').trim();
    const url = `${EUROLEAGUE_SCHEDULES}?seasoncode=${encodeURIComponent(sc || DEFAULT_SEASON)}`;

    const res = await fetch(url, { headers: { accept: '*/*' } });
    const text = await res.text();

    if (!res.ok) {
        if (DEBUG_SCHEDULE) console.error(`[SCHEDULE] error body: ${text.slice(0, 500)}`);
        throw new Error(`Failed to fetch schedule`);
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        trimValues: true,
    });

    const parsed = parser.parse(text);
    if (DEBUG_SCHEDULE) {
        const topKeys = Object.keys(parsed || {});
        console.log(`[SCHEDULE] parsed ok. top-level keys:`, topKeys);
    }
    return parsed;
}

export async function tryFetchAny(url) {
    try {
        const res = await fetch(url, { headers: { accept: '*/*' } });
        const text = await res.text();
        if (DEBUG_SCHEDULE) {
            console.log(`[HTTP] GET ${url} → ${res.status} ${res.statusText}`);
            const ct = res.headers.get('content-type') || '';
            console.log(`[HTTP] content-type: ${ct}`);
            console.log(`[HTTP] payload preview: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
        }
        if (!res.ok) return null;

        try {
            return JSON.parse(text);
        } catch {
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                parseAttributeValue: true,
                trimValues: true,
            });
            return parser.parse(text);
        }
    } catch {
        return null;
    }
}

/* ----------------------------- Helpers ----------------------------- */
export function firstKey(obj, keys, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const k of keys) {
        if (obj[k] != null) return obj[k];
        const lower = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
        if (lower && obj[lower] != null) return obj[lower];
    }
    return fallback;
}

export function parseDateAny(v) {
    if (!v) return null;
    const d = new Date(v);
    if (!isNaN(d)) return d;
    if (typeof v === 'string' && v.includes(' ')) {
        const try2 = new Date(v.replace(' ', 'T'));
        if (!isNaN(try2)) return try2;
    }
    return null;
}

export function formatTimeHHMM(date, timeZone) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

export function formatDateLabel(date, timeZone) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

export function localDateKey(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function getTeamName(game, which) {
    const obj =
        which === 'home'
            ? firstKey(game, ['HomeTeam', 'homeTeam', 'home', 'Home', 'TeamA', 'clubHome'])
            : firstKey(game, ['AwayTeam', 'awayTeam', 'away', 'Away', 'TeamB', 'clubAway']);
    if (obj && typeof obj === 'object') {
        return firstKey(obj, ['Name', 'name', 'TeamName', 'teamName', 'clubName', 'ClubName']) || '—';
    }
    return obj || '—';
}

function getHomeCode(game) {
    const direct =
        firstKey(game, ['homecode', 'homeCode', 'HomeCode', '@_homecode']) ?? null;
    if (direct) return direct;

    const homeObj = firstKey(game, ['HomeTeam', 'homeTeam', 'home', 'Home']);
    if (homeObj && typeof homeObj === 'object') {
        return (
            firstKey(homeObj, ['code', 'Code', 'clubCode', 'ClubCode']) ??
            firstKey(homeObj, ['abbreviation', 'Abbreviation']) ??
            null
        );
    }
    return null;
}

function resolveHomeTimeZone(game, fallback) {
    const code = getHomeCode(game);
    if (code && TEAM_TIMEZONES[code]) return TEAM_TIMEZONES[code];
    return fallback;
}

function parseDatePart(datePart) {
    if (!datePart) return null;

    const isoMatch = String(datePart).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        return {
            year: Number(isoMatch[1]),
            month: Number(isoMatch[2]),
            day: Number(isoMatch[3]),
        };
    }

    const textualMatch = String(datePart).match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (textualMatch) {
        const monthKey = textualMatch[1].slice(0, 3).toLowerCase();
        const month = MONTH_LOOKUP[monthKey];
        if (!month) return null;
        return {
            year: Number(textualMatch[3]),
            month,
            day: Number(textualMatch[2]),
        };
    }

    const fallback = parseDateAny(datePart);
    if (fallback) {
        return {
            year: fallback.getUTCFullYear(),
            month: fallback.getUTCMonth() + 1,
            day: fallback.getUTCDate(),
        };
    }
    return null;
}

function parseTimePart(timePart) {
    if (!timePart) return null;
    const cleaned = String(timePart).trim();
    const match = cleaned.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = match[3] != null ? Number(match[3]) : 0;
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
    return { hour, minute, second };
}

function getTimeZoneOffsetMs(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') map[part.type] = part.value;
    }
    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second),
    );
    return asUtc - date.getTime();
}

function buildZonedDate(datePart, timePart, timeZone) {
    const dateInfo = parseDatePart(datePart);
    const timeInfo = parseTimePart(timePart);
    if (!dateInfo || !timeInfo) return null;
    const baseUtc = new Date(Date.UTC(
        dateInfo.year,
        dateInfo.month - 1,
        dateInfo.day,
        timeInfo.hour,
        timeInfo.minute,
        timeInfo.second,
    ));
    const offsetMs = getTimeZoneOffsetMs(baseUtc, timeZone);
    return new Date(baseUtc.getTime() - offsetMs);
}

/** Date/time extraction with explicit timezone handling */
export function getGameDate(game, timeZone = DEFAULT_TIME_ZONE) {
    const utcKeys = [
        'GameDateUTC', 'gameDateUTC',
        'DateTimeUTC', 'dateTimeUTC',
        'GameDateTimeUTC', 'gameDateTimeUTC',
    ];
    for (const k of utcKeys) {
        const v = firstKey(game, [k]);
        if (v) {
            const parsed = parseDateAny(v);
            if (parsed) return parsed;
        }
    }
    const datePart = firstKey(game, ['date', 'Date', 'gameDate', 'GameDate']);
    const timePart = firstKey(game, ['startime', 'Startime', 'starttime', 'StartTime', 'time', 'Time']);
    if (datePart && timePart) {
        const localZone = resolveHomeTimeZone(game, timeZone || DEFAULT_TIME_ZONE);
        const zoned = buildZonedDate(datePart, timePart, localZone);
        if (zoned) return zoned;

        const combined = `${datePart} ${timePart}`;
        const parsed = parseDateAny(combined);
        if (parsed) return parsed;
    }

    const asText = JSON.stringify(game);
    const match = asText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed)) return parsed;
    }
    return null;
}

/* ----------------------------- Identifiers & Names ----------------------------- */
/**
 * Extract seasoncode from item (if present) and a clean numeric gamecode.
 * Handles shapes like "E2025_22" → 22.
 */
export function getGameIdentifiers(game, fallbackSeason = DEFAULT_SEASON) {
    const seasonFromItem =
        firstKey(game, ['seasoncode', 'SeasonCode', '@_seasoncode']) ||
        firstKey(game, ['Season', 'season']) ||
        null;
    const seasoncode = (seasonFromItem || fallbackSeason || DEFAULT_SEASON).toString().toUpperCase();

    let raw =
        firstKey(game, ['GameCode', 'gameCode', 'gamecode', 'Code', 'code', '@_gamecode', '@_code']) ??
        firstKey(game, ['GameId', 'gameId', '@_id', 'Id', 'id']) ??
        null;

    if (raw == null && game && typeof game === 'object') {
        for (const k of Object.keys(game)) {
            if (/code/i.test(k) && game[k] != null) {
                raw = game[k];
                break;
            }
        }
    }

    if (raw == null) return { seasoncode, gamecode: null };

    const asStr = String(raw).trim();
    const numDirect = Number(asStr);
    if (Number.isFinite(numDirect)) return { seasoncode, gamecode: numDirect };

    const allNums = asStr.match(/(\d+)/g);
    if (allNums && allNums.length) {
        const last = allNums[allNums.length - 1];
        const asNum = Number(last.replace(/^0+/, ''));
        if (Number.isFinite(asNum)) return { seasoncode, gamecode: asNum };
    }

    return { seasoncode, gamecode: asStr };
}

export function firstKeyNum(obj, keys) {
    const v = firstKey(obj, keys);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function normalizeName(s) {
    return String(s || '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();
}

export function sumQuarters(entry) {
    if (!entry || typeof entry !== 'object') return null;
    let total = 0;
    let found = false;

    for (const [k, v] of Object.entries(entry)) {
        if (/^Quarter\d+$/i.test(k) || /^OT\d*$/i.test(k) || /^Overtime\d*$/i.test(k)) {
            const n = Number(v);
            if (Number.isFinite(n)) {
                total += n;
                found = true;
            }
        }
    }
    return found ? total : null;
}

/* ----------------------------- Score extraction ----------------------------- */
export function getScoresFromSchedule(game) {
    const hs = firstKey(game, [
        'HomeScore', 'homeScore', 'HomePoints', 'homepoints', 'HomePts',
        'homescore', 'scoreHome', 'ScoreHome',
    ]);
    const as = firstKey(game, [
        'AwayScore', 'awayScore', 'AwayPoints', 'awaypoints', 'AwayPts',
        'awayscore', 'scoreAway', 'ScoreAway',
    ]);

    let homeScore = hs != null ? Number(hs) : null;
    let awayScore = as != null ? Number(as) : null;

    if ((homeScore == null || Number.isNaN(homeScore)) && game.HomeTeam && typeof game.HomeTeam === 'object') {
        const n = firstKey(game.HomeTeam, ['Score', 'score', 'Pts', 'points']);
        if (n != null) homeScore = Number(n);
    }
    if ((awayScore == null || Number.isNaN(awayScore)) && game.AwayTeam && typeof game.AwayTeam === 'object') {
        const n = firstKey(game.AwayTeam, ['Score', 'score', 'Pts', 'points']);
        if (n != null) awayScore = Number(n);
    }

    const played = Number.isFinite(homeScore) && Number.isFinite(awayScore);
    return { played, homeScore: played ? homeScore : null, awayScore: played ? awayScore : null };
}

/** Deep, forgiving score finder using team names & ByQuarter fallback */
export function deepFindScoresWithTeams(payload, homeName, awayName) {
    if (!payload || typeof payload !== 'object') return null;

    const box = payload.boxscore || payload;

    // Direct shapes
    const directHome = firstKeyNum(box, ['HomeScore', 'homeScore', 'HomePoints', 'homePoints']);
    const directAway = firstKeyNum(box, ['AwayScore', 'awayScore', 'AwayPoints', 'awayPoints']);
    if (directHome != null && directAway != null) return { home: directHome, away: directAway };

    // Nested {home/away}
    const homeObj = firstKey(box, ['home', 'Home']);
    const awayObj = firstKey(box, ['away', 'Away']);
    if (homeObj && awayObj && typeof homeObj === 'object' && typeof awayObj === 'object') {
        const h = firstKeyNum(homeObj, ['score', 'Score', 'Total', 'total']);
        const a = firstKeyNum(awayObj, ['score', 'Score', 'Total', 'total']);
        if (h != null && a != null) return { home: h, away: a };
    }

    // Linescore container
    const linescore = firstKey(box, ['Linescore', 'linescore']);
    if (linescore && typeof linescore === 'object') {
        const h = firstKeyNum(linescore.Home || {}, ['Total', 'total', 'Score', 'score']);
        const a = firstKeyNum(linescore.Away || {}, ['Total', 'total', 'Score', 'score']);
        if (h != null && a != null) return { home: h, away: a };
    }

    // ByQuarter: [{ Team, Quarter1.., OT.. }, {...}]
    const byQ = firstKey(box, ['ByQuarter', 'byQuarter', 'ByQuarters', 'byQuarters']);
    if (Array.isArray(byQ) && byQ.length >= 2) {
        const HN = normalizeName(homeName);
        const AN = normalizeName(awayName);

        let homeTotal = null;
        let awayTotal = null;

        for (const row of byQ) {
            const team = normalizeName(firstKey(row, ['Team', 'team', 'Club', 'club', 'Name', 'name'], ''));
            const total = sumQuarters(row);
            if (team && total != null) {
                if (team === HN && homeTotal == null) homeTotal = total;
                else if (team === AN && awayTotal == null) awayTotal = total;
            }
        }

        // Fallback if names don't match perfectly and we only have two rows
        if ((homeTotal == null || awayTotal == null) && byQ.length === 2) {
            const t1 = sumQuarters(byQ[0]);
            const t2 = sumQuarters(byQ[1]);
            if (t1 != null && t2 != null) {
                // Try a naive mapping by similarity:
                const b1 = normalizeName(firstKey(byQ[0], ['Team', 'team', 'Name', 'name'], ''));
                const b2 = normalizeName(firstKey(byQ[1], ['Team', 'team', 'Name', 'name'], ''));
                const homeLike1 = HN && b1 && b1.includes(HN);
                const homeIdx = homeLike1 ? 0 : (HN && b2 && b2.includes(HN) ? 1 : 0);
                const awayIdx = homeIdx === 0 ? 1 : 0;
                homeTotal = [t1, t2][homeIdx];
                awayTotal = [t1, t2][awayIdx];
            }
        }

        if (homeTotal != null && awayTotal != null) {
            return { home: homeTotal, away: awayTotal };
        }
    }

    // Exhaustive crawl
    const stack = [box];
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== 'object') continue;
        const dh = firstKeyNum(cur, ['HomeScore', 'homeScore', 'HomePoints', 'homePoints']);
        const da = firstKeyNum(cur, ['AwayScore', 'awayScore', 'AwayPoints', 'awayPoints']);
        if (dh != null && da != null) return { home: dh, away: da };
        for (const k of Object.keys(cur)) {
            if (cur[k] && typeof cur[k] === 'object') stack.push(cur[k]);
        }
    }

    return null;
}

/** Boxscore score fetcher trying common param combinations */
export async function fetchBoxScoreScores(cleanGamecode, seasoncode, homeName, awayName) {
    if (!EUROLEAGUE_BOXSCORE || !cleanGamecode) return { played: false, homeScore: null, awayScore: null };

    const sc = (seasoncode || DEFAULT_SEASON).toUpperCase(); // E2025
    const year = sc.replace(/^E/i, ''); // 2025
    const gcStr = String(cleanGamecode);
    const gc3 = gcStr.padStart(3, '0');

    const urls = [
        `${EUROLEAGUE_BOXSCORE}?gamecode=${gcStr}&seasoncode=${sc}`,
        `${EUROLEAGUE_BOXSCORE}?gamecode=${gc3}&seasoncode=${sc}`,
        `${EUROLEAGUE_BOXSCORE}?seasoncode=${sc}&gamecode=${gc3}`,
        `${EUROLEAGUE_BOXSCORE}?gamecode=${gcStr}&seasoncode=E${year}`,
    ];

    for (const url of urls) {
        const payload = await tryFetchAny(url);
        if (!payload) continue;

        const found = deepFindScoresWithTeams(payload, homeName, awayName);
        if (found && Number.isFinite(found.home) && Number.isFinite(found.away)) {
            const liveFlag = typeof payload.Live === 'boolean' ? payload.Live : null;
            const isFinal = liveFlag === false;
            return {
                played: isFinal,
                homeScore: found.home,
                awayScore: found.away,
            };
        }
    }
    return { played: false, homeScore: null, awayScore: null };
}
