// src/charts/render.js
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';

const WIDTH = 1200;
const HEIGHT = 900;
const FONT_FAMILY = 'Noto Sans';

// Ensure Noto Sans is available when running headless (production containers might lack system fonts).
const regularFontPath = fileURLToPath(new URL('../../assets/fonts/NotoSans-Regular.ttf', import.meta.url));
const boldFontPath = fileURLToPath(new URL('../../assets/fonts/NotoSans-Bold.ttf', import.meta.url));

if (!GlobalFonts.has(FONT_FAMILY)) {
    GlobalFonts.registerFromPath(regularFontPath);
    GlobalFonts.registerFromPath(boldFontPath);
}

const GREEK_PAIRS = [
    ['?', 'A'], ['?', 'A'], ['?', 'B'], ['G', 'G'], ['?', 'D'], ['?', 'E'], ['?', 'E'], ['?', 'Z'], ['?', 'I'],
    ['?', 'I'], ['T', 'TH'], ['?', 'I'], ['?', 'I'], ['?', 'K'], ['?', 'L'], ['?', 'M'], ['?', 'N'], ['?', 'X'],
    ['?', 'O'], ['?', 'O'], ['?', 'P'], ['?', 'R'], ['S', 'S'], ['?', 'T'], ['?', 'Y'], ['?', 'Y'], ['F', 'F'],
    ['?', 'CH'], ['?', 'PS'], ['O', 'O'], ['?', 'O'],
    ['a', 'a'], ['?', 'a'], ['�', 'b'], ['?', 'g'], ['d', 'd'], ['e', 'e'], ['?', 'e'], ['?', 'z'], ['?', 'i'],
    ['?', 'i'], ['?', 'th'], ['?', 'i'], ['?', 'i'], ['?', 'i'], ['?', 'i'], ['?', 'k'], ['?', 'l'], ['�', 'm'],
    ['?', 'n'], ['?', 'x'], ['?', 'o'], ['?', 'o'], ['p', 'p'], ['?', 'r'], ['?', 's'], ['s', 's'], ['t', 't'],
    ['?', 'y'], ['?', 'y'], ['?', 'y'], ['?', 'y'], ['f', 'f'], ['?', 'ch'], ['?', 'ps'], ['?', 'o'], ['?', 'o']
];

const GREEK_TO_LATIN = new Map(GREEK_PAIRS);

const latinize = (value) =>
    [...String(value ?? '')]
        .map((char) => {
            if (GREEK_TO_LATIN.has(char)) return GREEK_TO_LATIN.get(char);
            const upper = char.toUpperCase();
            if (GREEK_TO_LATIN.has(upper)) {
                const replacement = GREEK_TO_LATIN.get(upper);
                return char === upper ? replacement : replacement.toLowerCase();
            }
            return char;
        })
        .join('');

const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = FONT_FAMILY;
        ChartJS.defaults.font.size = 14;
        ChartJS.defaults.color = '#1f1f1f';
    },
});

const buildCommonOptions = ({ title, xLabel, indexAxis = 'x', beginAtZero = true } = {}) => ({
    indexAxis,
    responsive: false,
    layout: { padding: 16 },
    plugins: {
        legend: {
            display: Boolean(xLabel),
            labels: {
                font: { family: FONT_FAMILY, size: 14, weight: 'bold' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: latinize(title),
            font: { family: FONT_FAMILY, size: 20, weight: 'bold' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FONT_FAMILY, size: 14 },
            titleFont: { family: FONT_FAMILY, size: 16, weight: 'bold' },
        },
    },
    scales: {
        x: {
            beginAtZero,
            ticks: {
                font: { family: FONT_FAMILY, size: 12 },
                color: '#1f1f1f',
            },
            title: xLabel
                ? { text: latinize(xLabel), display: true, font: { family: FONT_FAMILY, size: 14, weight: 'bold' } }
                : undefined,
        },
        y: {
            beginAtZero,
            ticks: {
                font: { family: FONT_FAMILY, size: 12 },
                color: '#1f1f1f',
            },
        },
    },
});

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
                {
                    label: latinize(teamA.teamName),
                    data: [teamA.value],
                    backgroundColor: teamA.color || '#cc2033',
                    borderRadius: 6,
                },
                {
                    label: latinize(teamB.teamName),
                    data: [teamB.value],
                    backgroundColor: teamB.color || '#0c7b43',
                    borderRadius: 6,
                },
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