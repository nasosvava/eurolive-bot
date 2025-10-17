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
const DJV_REG = path.join(fontsDir, 'DejaVuSans.ttf');
const DJV_BOLD = path.join(fontsDir, 'DejaVuSans-Bold.ttf');

// ---------- guards ----------
for (const p of [fontsDir, DJV_REG, DJV_BOLD]) {
    if (!fs.existsSync(p)) {
        throw new Error(`[charts] Missing required font path: ${p}`);
    }
}

// ---------- register ONE family with weights ----------
/**
 * IMPORTANT:
 * The intrinsic family name inside these TTFs is EXACTLY "DejaVu Sans".
 * We must set the same string in Chart.js defaults. Do NOT pass a stack.
 */
const FAMILY = 'DejaVu Sans';

// Weighted registration ensures Bold lookups match
GlobalFonts.register({ family: FAMILY, src: DJV_REG, weight: '400', style: 'normal' });
GlobalFonts.register({ family: FAMILY, src: DJV_BOLD, weight: '700', style: 'normal' });

// Debug: make sure the family is actually present
if (process.env.DEBUG) {
    console.log('[charts] fonts dir:', fontsDir);
    console.log('[charts] files:', fs.readdirSync(fontsDir));
    console.log('[charts] has("DejaVu Sans") =', GlobalFonts.has(FAMILY));
    console.log('[charts] families sample:', GlobalFonts.families?.slice?.(0, 20));
}

const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        // Use ONE exact family; no stacks, no aliases
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
