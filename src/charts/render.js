// src/charts/render.js
import { ChartJSNodeCanvas, registerFont } from 'chartjs-node-canvas';
import path from 'node:path';
import url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const regularFontPath = path.join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf');
const boldFontPath = path.join(__dirname, '../../assets/fonts/NotoSans-Bold.ttf');

registerFont(regularFontPath, { family: 'Noto Sans', weight: 'normal' });
registerFont(boldFontPath, { family: 'Noto Sans', weight: 'bold' });

const FONT_FAMILY = 'Noto Sans';

// Chart setup for Discord embeds
const WIDTH = 1200;
const HEIGHT = 900;

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
                font: { family: FONT_FAMILY, size: 14, weight: '600' },
                color: '#1f1f1f',
            },
        },
        title: {
            display: Boolean(title),
            text: title,
            font: { family: FONT_FAMILY, size: 20, weight: '700' },
            color: '#1f1f1f',
        },
        tooltip: {
            bodyFont: { family: FONT_FAMILY, size: 14 },
            titleFont: { family: FONT_FAMILY, size: 16, weight: '700' },
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
                ? { text: xLabel, display: true, font: { family: FONT_FAMILY, size: 14, weight: '600' } }
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
                {
                    label: teamA.teamName,
                    data: [teamA.value],
                    backgroundColor: teamA.color || '#cc2033',
                    borderRadius: 6,
                },
                {
                    label: teamB.teamName,
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