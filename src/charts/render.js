// src/charts/render.js
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const WIDTH = 1200;
const HEIGHT = 900;
const FONT_FAMILY = 'sans-serif';

const GREEK_TO_LATIN = {
    '\u0391': 'A', '\u0392': 'B', '\u0393': 'G', '\u0394': 'D', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H', '\u0398': 'TH',
    '\u0399': 'I', '\u039A': 'K', '\u039B': 'L', '\u039C': 'M', '\u039D': 'N', '\u039E': 'X', '\u039F': 'O', '\u03A0': 'P',
    '\u03A1': 'R', '\u03A3': 'S', '\u03A4': 'T', '\u03A5': 'Y', '\u03A6': 'F', '\u03A7': 'CH', '\u03A8': 'PS', '\u03A9': 'O',
    '\u03B1': 'a', '\u03B2': 'b', '\u03B3': 'g', '\u03B4': 'd', '\u03B5': 'e', '\u03B6': 'z', '\u03B7': 'i', '\u03B8': 'th',
    '\u03B9': 'i', '\u03BA': 'k', '\u03BB': 'l', '\u03BC': 'm', '\u03BD': 'n', '\u03BE': 'x', '\u03BF': 'o', '\u03C0': 'p',
    '\u03C1': 'r', '\u03C3': 's', '\u03C2': 's', '\u03C4': 't', '\u03C5': 'y', '\u03C6': 'f', '\u03C7': 'ch', '\u03C8': 'ps',
    '\u03C9': 'o'
};

const latinize = (value) =>
    String(value ?? '')
        .split('')
        .map((char) => {
            if (GREEK_TO_LATIN[char]) return GREEK_TO_LATIN[char];
            const lower = char.toLowerCase();
            if (GREEK_TO_LATIN[lower]) {
                const mapped = GREEK_TO_LATIN[lower];
                return char === lower ? mapped : mapped.toUpperCase();
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