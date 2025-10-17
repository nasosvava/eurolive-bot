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
// from src/charts/* to root/assets/fonts/*
const fontPath = (p) => path.resolve(here, '../../assets/fonts', p);

// Required fonts (commit them!)
const NOTO_REG = fontPath('NotoSans-Regular.ttf');
const NOTO_BOLD = fontPath('NotoSans-Bold.ttf');

// Optional fallback (if you add them, they'll be used)
const DEJAVU_REG = fontPath('DejaVuSans.ttf');
const DEJAVU_BOLD = fontPath('DejaVuSans-Bold.ttf');

// Aliases to defeat case/space normalization differences
const NOTO_ALIASES = ['NotoSansLocal', 'notosanslocal', 'Noto Sans', 'noto sans'];
const DEJAVU_ALIASES = ['DejaVuSansLocal', 'dejavusanslocal', 'DejaVu Sans', 'dejavu sans'];

// Use a font stack everywhere in Chart.js
const FONT_STACK = '"NotoSansLocal","Noto Sans","notosanslocal","noto sans","DejaVu Sans","dejavu sans","Sans"';

// ---------- helpers ----------
function assertFile(p, name) {
    if (!fs.existsSync(p)) throw new Error(`[charts] Missing ${name} font file: ${p}`);
}

function registerFamilyFromPath(regular, bold, aliases) {
    for (const family of aliases) {
        if (regular) GlobalFonts.registerFromPath(regular, family);
        if (bold) GlobalFonts.registerFromPath(bold, family);
    }
}

// ---------- register fonts BEFORE creating ChartJSNodeCanvas ----------
assertFile(NOTO_REG, 'NotoSans Regular');
assertFile(NOTO_BOLD, 'NotoSans Bold');

registerFamilyFromPath(NOTO_REG, NOTO_BOLD, NOTO_ALIASES);

if (fs.existsSync(DEJAVU_REG) && fs.existsSync(DEJAVU_BOLD)) {
    registerFamilyFromPath(DEJAVU_REG, DEJAVU_BOLD, DEJAVU_ALIASES);
}

if (process.env.DEBUG) {
    console.log('[charts] Registered families sample:', GlobalFonts.families?.slice?.(0, 20));
    for (const fam of [...NOTO_ALIASES, ...DEJAVU_ALIASES]) {
        try { console.log(`[charts] has("${fam}") =`, GlobalFonts.has(fam)); } catch {}
    }
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

// ---------- Greek → Latin (clean mapping) ----------
const GREEK_TO_LATIN = new Map([
    // Uppercase
    ['Α','A'],['Β','B'],['Γ','G'],['Δ','D'],['Ε','E'],['Ζ','Z'],['Η','I'],['Θ','TH'],
    ['Ι','I'],['Κ','K'],['Λ','L'],['Μ','M'],['Ν','N'],['Ξ','X'],['Ο','O'],['Π','P'],
    ['Ρ','R'],['Σ','S'],['Τ','T'],['Υ','Y'],['Φ','F'],['Χ','CH'],['Ψ','PS'],['Ω','O'],
    // Lowercase
    ['α','a'],['β','b'],['γ','g'],['δ','d'],['ε','e'],['ζ','z'],['η','i'],['θ','th'],
    ['ι','i'],['κ','k'],['λ','l'],['μ','m'],['ν','n'],['ξ','x'],['ο','o'],['π','p'],
    ['ρ','r'],['σ','s'],['ς','s'],['τ','t'],['υ','y'],['φ','f'],['χ','ch'],['ψ','ps'],['ω','o'],
]);
const latinize = (value) => [...String(value ?? '')].map((c) => GREEK_TO_LATIN.get(c) ?? c).join('');

// ---------- shared chart options ----------
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
            text: latinize(title),
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
                ? { text: latinize(xLabel), display: true, font: { family: FONT_STACK, size: 14, weight: 'bold' } }
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
            labels: labels.map(latinize),
            datasets: [{
                label: latinize(xLabel || ''),
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
            labels: [latinize(metricLabel)],
            datasets: [
                { label: latinize(teamA.teamName), data: [teamA.value], backgroundColor: teamA.color || '#cc2033', borderRadius: 6 },
                { label: latinize(teamB.teamName), data: [teamB.value], backgroundColor: teamB.color || '#0c7b43', borderRadius: 6 },
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
            labels: labels.map(latinize),
            datasets: [
                { label: latinize(teamA.label), data: teamA.values, backgroundColor: teamA.color || '#cc2033', borderRadius: 4 },
                { label: latinize(teamB.label), data: teamB.values, backgroundColor: teamB.color || '#0c7b43', borderRadius: 4 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    };
    return chart.renderToBuffer(configuration, 'image/png');
}
