import { EUROLEAGUE_STANDINGS, EUROLEAGUE_STANDINGS_FORCE } from '../../env.js';
import { XMLParser } from 'fast-xml-parser';

/** Build a list of candidate URLs (no round support). */
function candidateUrls(base, seasoncode, phasecode) {
    const b = base.replace(/\/+$/, '');
    const sc = (seasoncode || 'E2025').trim();
    const pc = phasecode?.trim() || null;

    const qs = (obj) =>
        Object.entries(obj)
            .filter(([, v]) => v !== null && v !== undefined && `${v}`.length > 0)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

    const list = [];
    list.push(`${b}?${qs({ seasoncode: sc })}`);
    list.push(`${b}?${qs({ seasoncode: sc, phasecode: pc || 'RS' })}`);
    list.push(`${b}/traditional?${qs({ seasoncode: sc })}`);
    list.push(`${b}/traditional?${qs({ seasoncode: sc, phasecode: pc || 'RS' })}`);
    return Array.from(new Set(list));
}

function firstKey(obj, keys, fallback = undefined) {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const k of keys) {
        if (obj[k] != null) return obj[k];
        const hit = Object.keys(obj).find((kk) => kk.toLowerCase() === String(k).toLowerCase());
        if (hit && obj[hit] != null) return obj[hit];
    }
    return fallback;
}

function extractItemsFromJson(payload) {
    if (Array.isArray(payload)) return payload;
    const candidates = [
        'standings', 'Standings', 'result', 'results', 'data',
        'items', 'Items', 'Rows', 'rows', 'table', 'Table', 'list', 'List',
    ];
    for (const k of candidates) {
        const v = payload?.[k];
        if (Array.isArray(v)) return v;
    }

    if (payload && typeof payload === 'object') {
        const arrays = [];
        const stack = [payload];
        while (stack.length) {
            const cur = stack.pop();
            if (Array.isArray(cur)) arrays.push(cur);
            else if (cur && typeof cur === 'object') for (const v of Object.values(cur)) stack.push(v);
        }
        const plausible = arrays.find(
            (arr) =>
                Array.isArray(arr) &&
                arr.length &&
                typeof arr[0] === 'object' &&
                ('team' in arr[0] ||
                    'Team' in arr[0] ||
                    'teamName' in arr[0] ||
                    'TeamName' in arr[0] ||
                    'club' in arr[0] ||
                    'Club' in arr[0] ||
                    'name' in arr[0] ||
                    'Name' in arr[0])
        );
        if (plausible) return plausible;
    }
    return [];
}

function parseXmlAndExtractItems(xmlText) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
        trimValues: true,
    });

    let obj;
    try {
        obj = parser.parse(xmlText);
    } catch {
        return [];
    }

    const arrays = [];
    const stack = [obj];
    while (stack.length) {
        const cur = stack.pop();
        if (Array.isArray(cur)) arrays.push(cur);
        else if (cur && typeof cur === 'object') for (const v of Object.values(cur)) stack.push(v);
    }

    const teamKeys = ['team', 'teamname', 'club', 'name'];
    const winKeys = ['wins', 'w', 'victories'];
    const lossKeys = ['losses', 'l', 'defeats'];

    const looksLikeRow = (row) => {
        if (!row || typeof row !== 'object') return false;
        const keys = Object.keys(row).map((k) => k.toLowerCase());
        const hasTeam = keys.some((k) => teamKeys.includes(k));
        const hasWL = keys.some((k) => winKeys.includes(k)) && keys.some((k) => lossKeys.includes(k));
        return hasTeam || hasWL;
    };

    const candidate = arrays.find((arr) => Array.isArray(arr) && arr.length && looksLikeRow(arr[0]));
    return candidate || [];
}

function normRow(row, idx) {
    const n = (x, d = 0) => (x == null ? d : Number(x)) || d;
    const s = (x, d = '—') => (x == null ? d : String(x));

    const rank = firstKey(row, ['rank', 'Rank', 'position', 'pos', 'Standing'], idx + 1);
    const team = firstKey(row, ['team', 'Team', 'teamName', 'TeamName', 'club', 'Club', 'name', 'Name'], '—');
    const wins = firstKey(row, ['wins', 'Wins', 'win', 'W', 'victories', 'Victories'], 0);
    const losses = firstKey(row, ['losses', 'Losses', 'loss', 'L', 'defeats', 'Defeats'], 0);
    const ties = firstKey(row, ['ties', 'Ties', 'draws', 'Draws', 'T'], 0);

    return { rank: n(rank, idx + 1), team: s(team), wins: n(wins, 0), losses: n(losses, 0), ties: n(ties, 0) };
}

async function fetchFromCandidates(candidates) {
    const attempts = [];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { headers: { accept: '*/*' } });
            const contentType = (res.headers.get('content-type') || '').toLowerCase();
            const bodyText = await res.text();

            if (!res.ok) {
                attempts.push({ url, status: res.status, type: contentType, body: bodyText.slice(0, 240) });
                continue;
            }

            let items = [];
            const couldBeJson = contentType.includes('application/json') || contentType.includes('text/json') || /^[\s]*[{\[]/.test(bodyText);
            if (couldBeJson) {
                try {
                    const json = JSON.parse(bodyText);
                    items = extractItemsFromJson(json);
                } catch {}
            }

            if (!items.length) {
                const couldBeXml = contentType.includes('xml') || /^[\s]*</.test(bodyText);
                if (couldBeXml) items = parseXmlAndExtractItems(bodyText);
            }

            if (Array.isArray(items) && items.length) return { items };
        } catch (e) {
            attempts.push({ url, status: 'ERR', type: '—', body: e?.message || 'Network error' });
        }
    }
    throw new Error('No standings data found');
}

export async function fetchStandings(seasoncode, phasecode) {
    const primary = candidateUrls(EUROLEAGUE_STANDINGS, seasoncode, phasecode);
    const fallback = EUROLEAGUE_STANDINGS_FORCE ? candidateUrls(EUROLEAGUE_STANDINGS_FORCE, seasoncode, phasecode) : [];
    const { items } = await fetchFromCandidates([...primary, ...fallback]);

    const rows = items.map(normRow);
    rows.sort((a, b) => a.rank - b.rank);
    return { rows };
}

/* ---------- ANSI helpers ---------- */
const ESC = '\u001b[';
const RESET = `${ESC}0m`;
const GREEN = `${ESC}32m`;
const RED = `${ESC}31m`;

function padRight(str, len) {
    const s = String(str ?? '');
    if (s.length >= len) return s.slice(0, len - 1) + '…';
    return s + ' '.repeat(len - s.length);
}
function padLeft(num, len) {
    const s = String(num ?? '');
    if (s.length >= len) return s.slice(-len);
    return ' '.repeat(len - s.length) + s;
}

/**
 * Build Discord embeds:
 * - One line per team inside an ANSI code block (colored W/L).
 * - Shows only Win%.
 * - Fixed width tuned to avoid line wrapping in Discord.
 */
export function buildStandingsEmbeds(rows, { seasoncode, phasecode }) {
    const titleBits = [`EuroLeague Standings — ${seasoncode || 'E2025'}`];
    if (phasecode) titleBits.push(`[${phasecode}]`);
    const title = titleBits.join(' ');

    // Tuned for Discord wrap: keep total line length ~≤ 75 visible chars.
    const TEAM_COL = 24;

    const lines = rows.map((r) => {
        const total = (r.wins || 0) + (r.losses || 0) + (r.ties || 0);
        const winPct = total > 0 ? ((r.wins / total) * 100) : 0;
        const pctStr = total > 0 ? `${winPct.toFixed(1)}%` : '—';

        const rankStr = padLeft(r.rank, 2);
        const teamStr = padRight(r.team, TEAM_COL);

        return (
            `${rankStr} ${teamStr} | ` +
            `${GREEN}W:${r.wins}${RESET} ${RED}L:${r.losses}${RESET} | Win%:${pctStr}`
        );
    });

    const description = ['```ansi', ...lines, '```'].join('\n');

    return [
        {
            title,
            description,
            timestamp: new Date().toISOString(),
        },
    ];
}
