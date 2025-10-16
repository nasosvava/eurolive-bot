import {
    DEFAULT_SEASON,
    EUROLEAGUE_SCHEDULES,
    EUROLEAGUE_BOXSCORE,
} from '../../env.js';
import { XMLParser } from 'fast-xml-parser';

/** Toggle extra logging here */
const DEBUG_WEEK = true;

/* ----------------------------- FETCH (Schedules) ----------------------------- */
async function fetchSchedule(seasonCode) {
    const sc = (seasonCode || '').trim();
    const url = `${EUROLEAGUE_SCHEDULES}?seasoncode=${encodeURIComponent(sc || DEFAULT_SEASON)}`;

    const res = await fetch(url, { headers: { accept: '*/*' } });
    const text = await res.text();

    if (!res.ok) {
        console.error(text.slice(0, 400));
        throw new Error(`Failed to fetch schedule`);
    }

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        trimValues: true,
    });

    const parsed = parser.parse(text);
    if (DEBUG_WEEK) {
        const topKeys = Object.keys(parsed || {});
        console.log(`[SCHEDULE] parsed ok. top-level keys:`, topKeys);
    }
    return parsed;
}

/* ----------------------------- HELPERS ----------------------------- */
function firstKey(obj, keys, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const k of keys) {
        if (obj[k] != null) return obj[k];
        const lower = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
        if (lower && obj[lower] != null) return obj[lower];
    }
    return fallback;
}

function parseDateAny(v) {
    if (!v) return null;
    const d = new Date(v);
    if (!isNaN(d)) return d;
    if (typeof v === 'string' && v.includes(' ')) {
        const try2 = new Date(v.replace(' ', 'T'));
        if (!isNaN(try2)) return try2;
    }
    return null;
}

function formatTimeHHMM(date, timeZone) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

function formatDateLabel(date, timeZone) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function localDateKey(date, timeZone) {
    // YYYY-MM-DD in local tz
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function getTeamName(game, which) {
    const obj =
        which === 'home'
            ? firstKey(game, ['HomeTeam', 'homeTeam', 'home', 'Home', 'TeamA', 'clubHome'])
            : firstKey(game, ['AwayTeam', 'awayTeam', 'away', 'Away', 'TeamB', 'clubAway']);
    if (obj && typeof obj === 'object') {
        return (
            firstKey(obj, ['Name', 'name', 'TeamName', 'teamName', 'clubName', 'ClubName']) || '—'
        );
    }
    return obj || '—';
}

function getGameDate(game) {
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

    // EuroLeague quirk: "date" + "startime" (typo)
    const datePart = firstKey(game, ['date', 'Date', 'gameDate', 'GameDate']);
    const timePart = firstKey(game, ['startime', 'Startime', 'starttime', 'StartTime', 'time', 'Time']);
    if (datePart && timePart) {
        const combined = `${datePart} ${timePart}`;
        const parsed = parseDateAny(combined);
        if (parsed) return parsed;
    }

    // Deep search fallback
    const asText = JSON.stringify(game);
    const match = asText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    if (match) {
        const parsed = new Date(match[0]);
        if (!isNaN(parsed)) return parsed;
    }

    return null;
}

/* ----------------------------- GAME IDENTIFIERS ----------------------------- */
/**
 * Extracts seasoncode (prefer from item), and a clean numeric gamecode for Boxscore.
 * Handles weird shapes like "E2025_22", "GAME_022", etc.
 */
function getGameIdentifiers(game, fallbackSeason = DEFAULT_SEASON) {
    const seasonFromItem =
        firstKey(game, ['seasoncode', 'SeasonCode', '@_seasoncode']) ||
        firstKey(game, ['Season', 'season']) ||
        null;
    const seasoncode = (seasonFromItem || fallbackSeason || DEFAULT_SEASON).toString().toUpperCase();

    // Direct candidates for code/id
    let raw =
        firstKey(game, ['GameCode', 'gameCode', 'gamecode', 'Code', 'code', '@_gamecode', '@_code']) ??
        firstKey(game, ['GameId', 'gameId', '@_id', 'Id', 'id']) ??
        null;

    // Fallback: any key including "code"
    if (raw == null && game && typeof game === 'object') {
        for (const k of Object.keys(game)) {
            if (/code/i.test(k) && game[k] != null) {
                raw = game[k];
                break;
            }
        }
    }

    if (raw == null) {
        return { seasoncode, gamecode: null };
    }

    // Try numeric conversion first
    const asStr = String(raw).trim();
    const numDirect = Number(asStr);
    if (Number.isFinite(numDirect)) return { seasoncode, gamecode: numDirect };

    // If it's composite like "E2025_22" or "GAME_022", take the last number group
    const allNums = asStr.match(/(\d+)/g);
    if (allNums && allNums.length) {
        const last = allNums[allNums.length - 1];
        const asNum = Number(last.replace(/^0+/, '')); // strip leading zeros
        if (Number.isFinite(asNum)) return { seasoncode, gamecode: asNum };
    }

    // As a last resort, return string (may still succeed if endpoint accepts it)
    return { seasoncode, gamecode: asStr };
}

/* ----------------------------- BOX SCORE FETCH & PARSE ----------------------------- */
async function tryFetch(url) {
    try {
        const res = await fetch(url, { headers: { accept: '*/*' } });
        const text = await res.text();
        if (DEBUG_WEEK) {
            console.log(`[BOXSCORE] GET ${url} → ${res.status} ${res.statusText}`);
            const ct = res.headers.get('content-type') || '';
            console.log(`[BOXSCORE] content-type: ${ct}`);
            console.log(`[BOXSCORE] payload preview: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
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
    } catch (e) {
        if (DEBUG_WEEK) console.log(`[BOXSCORE] fetch failed: ${e?.message || e}`);
        return null;
    }
}

function firstKeyNum(obj, keys) {
    const v = firstKey(obj, keys);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeName(s) {
    return String(s || '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '') // strip punctuation/symbols
        .trim();
}

/** Sum all quarter/OT fields in an entry like { Quarter1:14, Quarter2:22, ... } */
function sumQuarters(entry) {
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

/** Extract scores from various common shapes; fallback to ByQuarter summing using team names */
function deepFindScoresWithTeams(payload, homeName, awayName) {
    if (!payload || typeof payload !== 'object') return null;

    // 1) Simple direct shapes
    const directHome = firstKeyNum(payload, ['HomeScore', 'homeScore', 'HomePoints', 'homePoints']);
    const directAway = firstKeyNum(payload, ['AwayScore', 'awayScore', 'AwayPoints', 'awayPoints']);
    if (directHome != null && directAway != null) return { home: directHome, away: directAway };

    // 2) Nested common shapes
    const box = payload.boxscore || payload;

    const homeObj = firstKey(box, ['home', 'Home']);
    const awayObj = firstKey(box, ['away', 'Away']);
    if (homeObj && awayObj && typeof homeObj === 'object' && typeof awayObj === 'object') {
        const h = firstKeyNum(homeObj, ['score', 'Score', 'Total', 'total']);
        const a = firstKeyNum(awayObj, ['score', 'Score', 'Total', 'total']);
        if (h != null && a != null) return { home: h, away: a };
    }

    const linescore = firstKey(box, ['Linescore', 'linescore']);
    if (linescore && typeof linescore === 'object') {
        const h = firstKeyNum(linescore.Home || {}, ['Total', 'total', 'Score', 'score']);
        const a = firstKeyNum(linescore.Away || {}, ['Total', 'total', 'Score', 'score']);
        if (h != null && a != null) return { home: h, away: a };
    }

    // 3) New shape seen in your payload: ByQuarter = [{ Team: "...", Quarter1: .., ... }, { Team: "...", ... }]
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

        // If exact name matching failed (due to minor naming differences), fallback:
        if ((homeTotal == null || awayTotal == null) && byQ.length === 2) {
            const t1 = sumQuarters(byQ[0]);
            const t2 = sumQuarters(byQ[1]);
            if (t1 != null && t2 != null) {
                // Heuristic: assign higher sum to the team that likely won — but we don't know who is home.
                // Prefer mapping by string similarity:
                const b1 = normalizeName(firstKey(byQ[0], ['Team', 'team', 'Name', 'name'], ''));
                const b2 = normalizeName(firstKey(byQ[1], ['Team', 'team', 'Name', 'name'], ''));
                // Choose the closer match to home/away by normalized string length overlap
                const scoreMap = [
                    { t: b1, total: t1 },
                    { t: b2, total: t2 },
                ];
                let homeIdx = 0;
                let awayIdx = 1;
                // If one of them includes most of homeName text, assign that to home
                if (b1 && b1.includes(normalizeName(homeName))) homeIdx = 0;
                else if (b2 && b2.includes(normalizeName(homeName))) homeIdx = 1;

                awayIdx = homeIdx === 0 ? 1 : 0;

                homeTotal = scoreMap[homeIdx].total;
                awayTotal = scoreMap[awayIdx].total;
            }
        }

        if (homeTotal != null && awayTotal != null) {
            return { home: homeTotal, away: awayTotal };
        }
    }

    // 4) As a last resort: recurse entire payload
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

async function fetchBoxScoreScores(cleanGamecode, seasoncode, homeName, awayName) {
    if (!EUROLEAGUE_BOXSCORE || !cleanGamecode) {
        if (DEBUG_WEEK) console.log(`[BOXSCORE] Skipping: endpoint or gamecode missing. gamecode=${cleanGamecode}`);
        return { played: false, homeScore: null, awayScore: null };
    }

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
        const payload = await tryFetch(url);
        if (!payload) continue;

        const found = deepFindScoresWithTeams(payload, homeName, awayName);
        if (DEBUG_WEEK) console.log(`[BOXSCORE] Parsed scores from payload:`, found);
        if (found && Number.isFinite(found.home) && Number.isFinite(found.away)) {
            return { played: true, homeScore: found.home, awayScore: found.away };
        }
    }

    if (DEBUG_WEEK) console.log(`[BOXSCORE] No scores found for gamecode=${gcStr} season=${sc}`);
    return { played: false, homeScore: null, awayScore: null };
}

/** Rarely present inside schedule itself */
function getScoresFromSchedule(game) {
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

/* ----------------------------- TODAY ----------------------------- */
export async function fetchTodayGames({ seasoncode = DEFAULT_SEASON, timeZone = 'Europe/Athens' } = {}) {
    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const today = new Date();
    const todayKey = localDateKey(today, timeZone);

    const gamesToday = [];
    for (const g of games) {
        const when = getGameDate(g);
        if (!when) continue;
        if (localDateKey(when, timeZone) !== todayKey) continue;

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');
        gamesToday.push({ date: when, home, away, _raw: g });
    }

    gamesToday.sort((a, b) => a.date - b.date);
    return { gamesToday };
}

export function buildTodayEmbed({ gamesToday, timeZone = 'Europe/Athens' }) {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(now);

    if (!gamesToday.length) {
        return [
            {
                title: `EuroLeague — Today (${dateStr})`,
                description: 'No EuroLeague games today.',
                timestamp: new Date().toISOString(),
            },
        ];
    }

    const lines = gamesToday.map((g) => {
        const time = formatTimeHHMM(g.date, timeZone);
        return `🕒 **${time}** — ${g.home} vs ${g.away}`;
    });

    return [
        {
            title: `🏀 EuroLeague — Today (${dateStr})`,
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
        },
    ];
}

/* ----------------------------- WEEK ----------------------------- */
function buildWeekDateSet(timeZone) {
    // Monday..Sunday for current week in timeZone
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now); // Sun..Sat
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayIndex = map[weekday] ?? 0;
    const deltaToMonday = (todayIndex + 6) % 7;

    const set = new Set();
    const ordered = [];
    for (let i = -deltaToMonday; i <= 6 - deltaToMonday; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const key = localDateKey(d, timeZone);
        if (!set.has(key)) {
            set.add(key);
            ordered.push({ key, date: d });
        }
    }
    return { set, ordered };
}

export async function fetchWeekGames({ seasoncode = DEFAULT_SEASON, timeZone = 'Europe/Athens' } = {}) {
    const data = await fetchSchedule(seasoncode);

    let games = [];
    if (Array.isArray(data?.schedule?.item)) games = data.schedule.item;
    else if (Array.isArray(data?.schedule?.game)) games = data.schedule.game;
    else if (Array.isArray(data?.Games?.Game)) games = data.Games.Game;

    const { set: weekKeys } = buildWeekDateSet(timeZone);

    const now = new Date();
    const out = [];
    let countInWeek = 0;

    for (const g of games) {
        const when = getGameDate(g);
        if (!when) continue;

        const key = localDateKey(when, timeZone);
        if (!weekKeys.has(key)) continue;

        countInWeek++;

        const home = getTeamName(g, 'home');
        const away = getTeamName(g, 'away');

        // 👇 Get season + clean numeric gamecode from the schedule item
        const { seasoncode: scFromItem, gamecode: gcClean } = getGameIdentifiers(g, seasoncode);
        const past = when.getTime() < now.getTime();

        if (DEBUG_WEEK) {
            console.log(`[WEEK] ${home} vs ${away}`);
            console.log(`      date=${when.toISOString()} tzKey=${key} past=${past} gamecode(raw→clean)=${gcClean} season=${scFromItem}`);
        }

        // 1) Try schedule scores
        let { played, homeScore, awayScore } = getScoresFromSchedule(g);
        if (DEBUG_WEEK && played) {
            console.log(`      ✓ schedule already has score: ${homeScore}-${awayScore}`);
        }

        // 2) If not found and game time is past, query Boxscore with CLEANED code + season from item
        if (!played && past) {
            const live = await fetchBoxScoreScores(gcClean, scFromItem, home, away);
            if (live.played) {
                played = true;
                homeScore = live.homeScore;
                awayScore = live.awayScore;
                if (DEBUG_WEEK) console.log(`      ✓ boxscore found score: ${homeScore}-${awayScore}`);
            } else if (DEBUG_WEEK) {
                console.log(`      ✗ boxscore did not return a score`);
            }
        }

        out.push({
            date: when,
            dateKey: key,
            home,
            away,
            played,
            homeScore,
            awayScore,
            _raw: g,
        });
    }

    if (DEBUG_WEEK) console.log(`[WEEK] total games in week: ${countInWeek}, prepared=${out.length}`);

    out.sort((a, b) => a.date - b.date);
    return out;
}

export function buildWeekEmbeds(games, { timeZone = 'Europe/Athens' } = {}) {
    if (!Array.isArray(games) || games.length === 0) {
        const now = new Date();
        const label = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        }).format(now);
        return [
            {
                title: `🏀 EuroLeague — This Week (${label})`,
                description: 'No EuroLeague games this week.',
                timestamp: new Date().toISOString(),
            },
        ];
    }

    // Group by local day
    const byDay = new Map();
    for (const g of games) {
        if (!byDay.has(g.dateKey)) byDay.set(g.dateKey, []);
        byDay.get(g.dateKey).push(g);
    }

    const embeds = [];
    for (const [, items] of byDay) {
        const dayDate = items[0]?.date || new Date();
        const dayLabel = formatDateLabel(dayDate, timeZone);

        const lines = items.map((g) => {
            const t = formatTimeHHMM(g.date, timeZone);
            if (g.played) {
                return `**${dayLabel} ${t}** — ${g.home} **${g.homeScore}–${g.awayScore}** ${g.away}`;
            }
            return `**${dayLabel} ${t}** — ${g.home} vs ${g.away}`;
        });

        embeds.push({
            title: `🏀 EuroLeague — ${dayLabel} (${timeZone})`,
            description: lines.join('\n'),
            timestamp: new Date().toISOString(),
        });
    }

    // Sort embeds by title (day label)
    embeds.sort((a, b) => a.title.localeCompare(b.title));
    return embeds;
}
