// src/charts/render.js
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// Large enough for Discord embeds; tune as needed
const WIDTH = 1200;
const HEIGHT = 900;

const chart = new ChartJSNodeCanvas({
    width: WIDTH,
    height: HEIGHT,
    backgroundColour: 'white', // solid bg looks best in Discord dark mode too
});

export async function renderHorizontalBar({ labels, values, title, xLabel, colors }) {
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: xLabel || '',
                data: values,
                backgroundColor: Array.isArray(colors) && colors.length ? colors : undefined,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: false,
            plugins: {
                legend: { display: Boolean(xLabel) },
                title: { display: Boolean(title), text: title },
                tooltip: { enabled: true },
            },
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { autoSkip: false, maxTicksLimit: 50 } },
            },
        },
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
                    backgroundColor: teamA.color || '#007bff',
                },
                {
                    label: teamB.teamName,
                    data: [teamB.value],
                    backgroundColor: teamB.color || '#ff0000',
                },
            ],
        },
        options: {
            responsive: false,
            plugins: {
                title: { display: true, text: title },
                legend: { position: 'top' },
            },
            scales: {
                y: { beginAtZero: true },
            },
        },
    };

    return chart.renderToBuffer(configuration, 'image/png');
}

export async function renderMultiComparisonChart({ labels, teamA, teamB, title }) {
    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: teamA.label, data: teamA.values, backgroundColor: teamA.color || '#007bff' },
                { label: teamB.label, data: teamB.values, backgroundColor: teamB.color || '#ff3b30' },
            ],
        },
        options: {
            responsive: false,
            plugins: {
                title: { display: Boolean(title), text: title },
                legend: { position: 'top' },
                tooltip: { enabled: true },
            },
            scales: { y: { beginAtZero: true } },
        },
    };

    return chart.renderToBuffer(configuration, 'image/png');
}
