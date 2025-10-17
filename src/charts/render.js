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

// Prefer this family across the board (has Greek glyphs)
const PREFERRED_FAMILY = 'DejaVu Sans';

// Files we expect to ship with the repo
const BUNDLED = {
    regular: path.join(fontsDir, 'DejaVuSans.ttf'),
    bold: path.join(fontsDir, 'DejaVuSans-Bold.ttf'),
};

// Optional alternates you might add later (full Unicode Noto)
const ALTS = [
    { family: 'Noto Sans', regular: path.join(fontsDir, 'NotoSans-Regular.ttf'), bold: path.join(fontsDir, 'NotoSans-Bold.ttf') },
];

// ---------- helpers ----------
function fileExists(p) {
    try { return fs.existsSync(p); } catch { return false; }
}

function registerPair({ family, regular, bold }) {
    let ok = false;
    if (fileExists(regular)) {
        GlobalFonts.registerFromPath(regular, family);
        ok = true;
    }
    if (fileExists(bold)) {
        GlobalFonts.registerFromPath(bold, family);
        ok = true;
    }
    return ok;
}

function registerFonts() {
    // Debug: show what the container actually has
    const exists = fileExists(fontsDir);
    const list = exists ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', exists, 'files:', list);

    // 1) Try bundled DejaVu first
    let family = PREFERRED_FAMILY;
    let registered = registerPair({ family, ...BUNDLED });

    // 2) If not found, try bundled alternates (e.g., Noto Sans full)
    if (!registered) {
        for (const alt of ALTS) {
            if (registerPair(alt)) {
                family = alt.family;
                registered = true;
                break;
            }
        }
    }

    // 3) If still not registered, hope a system font is present (Nixpacks: dejavu_fonts / noto-fonts)
    //    We can't "register" system fonts directly, but we can check if the family exists.
    const hasSystem = GlobalFonts.has(family);

    console.log(`[charts] using family: "${family}", registeredBundled=${registered}, hasSystem=${hasSystem}`);

    if (!registered && !hasSystem) {
        // Be explicit so it's obvious in logs why tofu would appear
        throw new Error(
            `[charts] No usable font family found. Ship bundled TTFs at ${fontsDir} ` +
            `(DejaVuSans.ttf, DejaVuSans-Bold.ttf) or install system fonts (dejavu_fonts / noto-fonts).`
        );
    }
    return family;
}

// ---------- register BEFORE creating canvas ----------
const FAMILY = registerFonts();

// ---------- chart factory ----------
const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        // IMPORTANT: single exact family name — avoids Skia font matching issues
        ChartJS.defaults.font.family = FAMILY;
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
                font: { family: FAMILY, size: 14, weight: 'bold' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: title ?? '',
            font: { family: FAMILY, size: 20, weight: 'bold' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FAMILY, size: 14 },
            titleFont: { family: FAMILY, size: 16, weight: 'bold' },
        },
    },
    scales: {
        x: {
            beginAtZero,
            ticks: { font: { family: FAMILY, size: 12 }, color: '#1f1f1f' },
            title: xLabel
                ? { text: xLabel, display: true, font: { family: FAMILY, size: 14, weight: 'bold' } }
                : undefined,
        },
        y: {
            beginAtZero,
            ticks: { font: { family: FAMILY, size: 12 }, color: '#1f1f1f' },
        },
    },
});

// ---------- public renderers ----------
export async function renderHorizontalBar({ labels, values, title, xLabel, colors }) {
    const configuration = {
        type: 'bar',
        data: {
            labels, // keep text as-is; chosen family supports Greek
            datasets: [{
                label: xLabel || '',
                data: values,
                backgroundColor: Array.isArray(colors) && colors.length ? colors : '#cc2033',
                borderRadius: 4,
            }],
        },
        options: buildCommonOptions({ title, xLabel, indexAxis: 'y' }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}

export async function renderComparisonChart({ teamA, teamB, title, metricLabel }) {
    const configuration = {
        type: 'bar',
        data: {
            labels: [metricLabel],
            datasets: [
                { label: teamA.teamName, data: [teamA.value], backgroundColor: teamA.color || '#cc2033', borderRadius: 6 },
                { label: teamB.teamName, data: [teamB.value], backgroundColor: teamB.color || '#0c7b43', borderRadius: 6 },
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
            labels,
            datasets: [
                { label: teamA.label, data: teamA.values, backgroundColor: teamA.color || '#cc2033', borderRadius: 4 },
                { label: teamB.label, data: teamB.values, backgroundColor: teamB.color || '#0c7b43', borderRadius: 4 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}
