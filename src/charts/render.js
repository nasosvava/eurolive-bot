// src/charts/render.js
import QuickChart from 'quickchart-js';

const WIDTH = 1200;
const HEIGHT = 900;
const BACKGROUND = 'white';
const FONT_FAMILY = 'Noto Sans';

const latinize = (value) =>
    String(value ?? '').normalize('NFC');

const buildCommonOptions = ({ title, xLabel, indexAxis = 'x', beginAtZero = true } = {}) => ({
    indexAxis,
    responsive: false,
    animation: false,
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

const renderWithQuickChart = async (configuration) => {
    const chart = new QuickChart();
    chart.setWidth(WIDTH);
    chart.setHeight(HEIGHT);
    chart.setBackgroundColor(BACKGROUND);
    if (process.env.QUICKCHART_HOST) chart.setHost(process.env.QUICKCHART_HOST);
    if (process.env.QUICKCHART_SCHEME) chart.setScheme(process.env.QUICKCHART_SCHEME);
    chart.setConfig({
        type: configuration.type,
        data: configuration.data,
        options: configuration.options,
    });
    return chart.toBinary();
};

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

    return renderWithQuickChart(configuration);
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

    return renderWithQuickChart(configuration);
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

    return renderWithQuickChart(configuration);
}
