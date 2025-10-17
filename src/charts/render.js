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
const FONTS_DIR = path.resolve(here, '../../assets/fonts');

// ---------- load all fonts on disk (intrinsic family names) ----------
function loadAllFonts(dir) {
    if (!fs.existsSync(dir)) {
        throw new Error(`[charts] Fonts directory missing: ${dir}`);
    }
    const files = fs.readdirSync(dir).filter(f => /\.(ttf|otf)$/i.test(f));
    if (!files.length) {
        throw new Error(`[charts] No .ttf/.otf files found in: ${dir}`);
    }
    for (const f of files) {
        const p = path.join(dir, f);
        try {
            // Use the font's own internal family name (best for weight/style matching)
            GlobalFonts.registerFromPath(p);
        } catch (e) {
            console.warn(`[charts] Failed to register "${f}":`, e?.message || e);
        }
    }
}

loadAllFonts(FONTS_DIR);

// ---------- choose family & stack ----------
// These must match the *intrinsic* names of the TTFs you added.
// For Google Noto & DejaVu they are exactly "Noto Sans" and "DejaVu Sans".
const PRIMARY_FAMILY = 'Noto Sans';
const FALLBACK_FAMILY = 'DejaVu Sans';

// font stack used by Chart.js (first available wins)
const FONT_STACK = `"${PRIMARY_FAMILY}","${FALLBACK_FAMILY}","Sans"`;

// sanity check: do we have at least one usable family?
const hasPrimary = GlobalFonts.has(PRIMARY_FAMILY);
const hasFallback = GlobalFonts.has(FALLBACK_FAMILY);
if (!hasPrimary && !hasFallback) {
    // Helpful dump for debugging
    console.error('[charts] Known families sample:', GlobalFonts.families?.slice?.(0, 25));
    throw new Error(
        `[charts] Neither "${PRIMARY_FAMILY}" nor "${FALLBACK_FAMILY}" registered. ` +
        `Ensure you placed full-Unicode TTFs (with Greek) in ${FONTS_DIR}.`
    );
}

// ---------- chart factory ----------
const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = FONT_STACK;
        ChartJS.defaults.font.size = 14;
        ChartJS.defaults.color = '#1f1f1f';
    },
});

// ---------- OPTIONAL: if you WANT Greek text as-is, do NOT latinize ----------
// Keep labels untouched so they render in Greek.
// If you want forced ASCII, you can re-enable your previous latinize().

const buildCommonOptions = ({ title, xLabel, indexAxis = 'x', beginAtZero = true } = {}) => ({
    indexAxis,
    responsive: false,
    layout: { padding: 16 },
    plugins: {
        legend: {
            display: Boolean(xLabel),
            labels: {
                font: { family: FONT_STACK, size: 14, weight: 'bold' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: title ?? '',
            font: { family: FONT_STACK, size: 20, weight: 'bold' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FONT_STACK, size: 14 },
            titleFont: { family: FONT_STACK, size: 16, weight: 'bold' },
        },
    },
    scales: {
        x: {
            beginAtZero,
            ticks: { font: { family: FONT_STACK, size: 12 }, color: '#1f1f1f' },
            title: xLabel
                ? { text: xLabel, display: true, font: { family: FONT_STACK, size: 14, weight: 'bold' } }
                : undefined,
        },
        y: {
            beginAtZero,
            ticks: { font: { family: FONT_STACK, size: 12 }, color: '#1f1f1f' },
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
