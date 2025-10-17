// src/charts/render.js
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const WIDTH = 1200;
const HEIGHT = 900;

// ---------- paths ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(here, '../../assets/fonts');

// We register under a space-free alias to avoid any CSS parsing quirks.
const FAMILY_ALIAS = 'dejavusanslocal';

// Bundled fonts (Greek-capable)
const DJV_REG = path.join(fontsDir, 'DejaVuSans.ttf');
const DJV_BOLD = path.join(fontsDir, 'DejaVuSans-Bold.ttf');

// Optional Noto backup (full Unicode)
const NOTO_REG = path.join(fontsDir, 'NotoSans-Regular.ttf');
const NOTO_BOLD = path.join(fontsDir, 'NotoSans-Bold.ttf');

// ---------- encoding repair (mojibake guard) ----------
const GREEK_RANGES = [
    [0x0370, 0x03FF], // Greek & Coptic
    [0x1F00, 0x1FFF], // Greek Extended
];

function countGreek(str) {
    let n = 0;
    for (const ch of String(str)) {
        const cp = ch.codePointAt(0);
        if (cp == null) continue;
        for (const [lo, hi] of GREEK_RANGES) {
            if (cp >= lo && cp <= hi) { n++; break; }
        }
    }
    return n;
}

// reinterpret each char’s low byte as Latin-1 (works for many single-byte mojibake cases)
function latin1RoundTrip(str) {
    const s = String(str);
    const buf = Buffer.allocUnsafe(s.length);
    for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff;
    return buf.toString('latin1');
}

function repairGreek(text) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (!s) return s;
    const greek0 = countGreek(s);
    const hasFFFD = s.includes('\uFFFD');
    const nonAscii = [...s].some(c => c.charCodeAt(0) > 0x7f);

    if (!hasFFFD && greek0 > 0) return s.normalize('NFC');
    if (!hasFFFD && !nonAscii) return s; // plain ASCII—leave it

    const repaired = latin1RoundTrip(s);
    const greek1 = countGreek(repaired);
    if (greek1 > greek0 || hasFFFD) return repaired.normalize('NFC');
    return s.normalize('NFC');
}

function fixLabel(x) {
    return repairGreek(x).replace(/[\u0000-\u001F\u007F]/g, '');
}
function fixLabels(arr = []) {
    return (arr ?? []).map(fixLabel);
}

// ---------- font registration ----------
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function registerIf(pathToTtf) {
    if (!exists(pathToTtf)) return false;
    GlobalFonts.registerFromPath(pathToTtf, FAMILY_ALIAS);
    return true;
}

(function bootFonts() {
    const dirExists = exists(fontsDir);
    const list = dirExists ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', dirExists, 'files:', list);

    const used = {
        dejavu: { reg: registerIf(DJV_REG), bold: registerIf(DJV_BOLD) },
        noto:   { reg: registerIf(NOTO_REG), bold: registerIf(NOTO_BOLD) },
    };
    const hasAlias = GlobalFonts.has(FAMILY_ALIAS);
    console.log('[charts] registered alias "%s" ->', FAMILY_ALIAS, { ...used, hasAlias });

    if (!used.dejavu.reg && !used.dejavu.bold && !used.noto.reg && !used.noto.bold && !hasAlias) {
        throw new Error(`[charts] Could not register fonts under "${FAMILY_ALIAS}". Ensure TTFs exist in ${fontsDir}.`);
    }
})();

// ---------- chart factory (create AFTER fonts) ----------
const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = FAMILY_ALIAS; // our alias, no spaces
        ChartJS.defaults.font.size = 14;
        ChartJS.defaults.color = '#1f1f1f';
    },
});

// ---------- shared options ----------
const buildCommonOptions = ({ title, xLabel, indexAxis = 'x', beginAtZero = true } = {}) => ({
    indexAxis,
    responsive: false,
    layout: { padding: 16 },
    plugins: {
        legend: {
            display: Boolean(xLabel),
            labels: {
                font: { family: FAMILY_ALIAS, size: 14, weight: 'bold' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: fixLabel(title ?? ''),
            font: { family: FAMILY_ALIAS, size: 20, weight: 'bold' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FAMILY_ALIAS, size: 14 },
            titleFont: { family: FAMILY_ALIAS, size: 16, weight: 'bold' },
        },
    },
    scales: {
        x: {
            beginAtZero,
            ticks: { font: { family: FAMILY_ALIAS, size: 12 }, color: '#1f1f1f' },
            title: xLabel
                ? { text: fixLabel(xLabel), display: true, font: { family: FAMILY_ALIAS, size: 14, weight: 'bold' } }
                : undefined,
        },
        y: {
            beginAtZero,
            ticks: { font: { family: FAMILY_ALIAS, size: 12 }, color: '#1f1f1f' },
        },
    },
});

// ---------- public renderers ----------
export async function renderHorizontalBar({ labels, values, title, xLabel, colors }) {
    const safeLabels = fixLabels(labels);
    const sample = safeLabels?.[0] ?? '';
    const cps = [...sample].map(c => c.codePointAt(0).toString(16));
    console.log('[charts] sample label:', JSON.stringify(sample), cps.slice(0, 16));

    const configuration = {
        type: 'bar',
        data: {
            labels: safeLabels,
            datasets: [{
                label: fixLabel(xLabel || ''),
                data: values,
                backgroundColor: Array.isArray(colors) && colors.length ? colors : '#cc2033',
                borderRadius: 4,
            }],
        },
        options: buildCommonOptions({ title, xLabel }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}

export async function renderComparisonChart({ teamA, teamB, title, metricLabel }) {
    const configuration = {
        type: 'bar',
        data: {
            labels: fixLabels([metricLabel]),
            datasets: [
                { label: fixLabel(teamA.teamName), data: [teamA.value], backgroundColor: teamA.color || '#cc2033', borderRadius: 6 },
                { label: fixLabel(teamB.teamName), data: [teamB.value], backgroundColor: teamB.color || '#0c7b43', borderRadius: 6 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}

export async function renderMultiComparisonChart({ labels, teamA, teamB, title }) {
    const configuration = {
        type: 'bar',
        data: {
            labels: fixLabels(labels),
            datasets: [
                { label: fixLabel(teamA.label), data: teamA.values, backgroundColor: teamA.color || '#cc2033', borderRadius: 4 },
                { label: fixLabel(teamB.label), data: teamB.values, backgroundColor: teamB.color || '#0c7b43', borderRadius: 4 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}
