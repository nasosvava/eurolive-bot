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

// The *intrinsic* family name in the TTFs (used for registration)
const FAMILY_NAME = 'DejaVu Sans';
// The *CSS* font-family string we pass to Chart.js/Canvas (MUST be quoted if it has spaces)
const FAMILY_CSS = `"${FAMILY_NAME}"`;

// Bundled files we expect
const BUNDLED = {
    regular: path.join(fontsDir, 'DejaVuSans.ttf'),
    bold: path.join(fontsDir, 'DejaVuSans-Bold.ttf'),
};

// Optional alternates you may have dropped in
const ALTS = [
    { name: 'Noto Sans', regular: path.join(fontsDir, 'NotoSans-Regular.ttf'), bold: path.join(fontsDir, 'NotoSans-Bold.ttf') },
];

function fileExists(p) {
    try { return fs.existsSync(p); } catch { return false; }
}

function registerPair(name, regularPath, boldPath) {
    let registered = false;
    if (fileExists(regularPath)) {
        GlobalFonts.registerFromPath(regularPath, name);
        registered = true;
    }
    if (fileExists(boldPath)) {
        GlobalFonts.registerFromPath(boldPath, name);
        registered = true;
    }
    return registered;
}

function registerFonts() {
    const exists = fileExists(fontsDir);
    const list = exists ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', exists, 'files:', list);

    // 1) Try bundled DejaVu first (register with intrinsic name)
    let chosenName = FAMILY_NAME;
    let registered = registerPair(FAMILY_NAME, BUNDLED.regular, BUNDLED.bold);

    // 2) If missing, try alternates (e.g., Noto Sans full)
    if (!registered) {
        for (const alt of ALTS) {
            if (registerPair(alt.name, alt.regular, alt.bold)) {
                chosenName = alt.name;
                registered = true;
                break;
            }
        }
    }

    // 3) Check if a system font by that name exists (when Nixpacks installs dejavu_fonts / noto-fonts)
    const hasSystem = GlobalFonts.has(chosenName);
    console.log(`[charts] chosen family: "${chosenName}", registeredBundled=${registered}, hasSystem=${hasSystem}`);

    if (!registered && !hasSystem) {
        throw new Error(
            `[charts] No usable font found. Place TTFs in ${fontsDir} (DejaVuSans.ttf, DejaVuSans-Bold.ttf) ` +
            `or install system fonts (dejavu_fonts / noto-fonts).`
        );
    }
    return chosenName;
}

// Register BEFORE creating the canvas
const ACTIVE_FAMILY = registerFonts();

// ---------- chart factory ----------
const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        // Use the *quoted* CSS family string so Canvas parses it as a single family
        ChartJS.defaults.font.family = FAMILY_CSS;
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
                font: { family: FAMILY_CSS, size: 14, weight: 'bold' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: title ?? '',
            font: { family: FAMILY_CSS, size: 20, weight: 'bold' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FAMILY_CSS, size: 14 },
            titleFont: { family: FAMILY_CSS, size: 16, weight: 'bold' },
        },
    },
    scales: {
        x: {
            beginAtZero,
            ticks: { font: { family: FAMILY_CSS, size: 12 }, color: '#1f1f1f' },
            title: xLabel
                ? { text: xLabel, display: true, font: { family: FAMILY_CSS, size: 14, weight: 'bold' } }
                : undefined,
        },
        y: {
            beginAtZero,
            ticks: { font: { family: FAMILY_CSS, size: 12 }, color: '#1f1f1f' },
        },
    },
});

// ---------- public renderers ----------
export async function renderHorizontalBar({ labels, values, title, xLabel, colors }) {
    const configuration = {
        type: 'bar',
        data: {
            labels, // Greek or Latin; the chosen family covers both
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
