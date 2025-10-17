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

// We register everything under this alias (no spaces, no punctuation),
// then tell Chart.js to use this exact alias.
const FAMILY_ALIAS = 'dejavusanslocal';

// Bundled DejaVu (has Greek)
const DJV_REG = path.join(fontsDir, 'DejaVuSans.ttf');
const DJV_BOLD = path.join(fontsDir, 'DejaVuSans-Bold.ttf');

// Optional Noto backup (full Unicode)
const NOTO_REG = path.join(fontsDir, 'NotoSans-Regular.ttf');
const NOTO_BOLD = path.join(fontsDir, 'NotoSans-Bold.ttf');

// ---------- helpers ----------
function exists(p) {
    try { return fs.existsSync(p); } catch { return false; }
}

function registerIfPresent(p, alias) {
    if (exists(p)) {
        GlobalFonts.registerFromPath(p, alias);
        return true;
    }
    return false;
}

function bootFonts() {
    const dirExists = exists(fontsDir);
    const list = dirExists ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', dirExists, 'files:', list);

    let registered = false;

    // 1) Prefer DejaVu
    const r1 = registerIfPresent(DJV_REG, FAMILY_ALIAS);
    const r2 = registerIfPresent(DJV_BOLD, FAMILY_ALIAS);
    registered = r1 || r2;

    // 2) Top up with Noto (same alias) if present
    const r3 = registerIfPresent(NOTO_REG, FAMILY_ALIAS);
    const r4 = registerIfPresent(NOTO_BOLD, FAMILY_ALIAS);
    registered = registered || r3 || r4;

    // Skia may still have a system font with our alias? (unlikely)
    const hasAlias = GlobalFonts.has(FAMILY_ALIAS);

    console.log(`[charts] registered alias "${FAMILY_ALIAS}" ->`, {
        dejavu: { reg: r1, bold: r2 },
        noto: { reg: r3, bold: r4 },
        hasAlias,
    });

    if (!registered && !hasAlias) {
        throw new Error(
            `[charts] Could not register fonts under "${FAMILY_ALIAS}". ` +
            `Ensure DejaVu/Noto TTFs exist in ${fontsDir}.`
        );
    }
}

bootFonts();

// ---------- chart factory (AFTER fonts) ----------
const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        // IMPORTANT: use the alias with no spaces
        ChartJS.defaults.font.family = FAMILY_ALIAS;
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
            text: title ?? '',
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
                ? { text: xLabel, display: true, font: { family: FAMILY_ALIAS, size: 14, weight: 'bold' } }
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
    const configuration = {
        type: 'bar',
        data: {
            labels,
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
