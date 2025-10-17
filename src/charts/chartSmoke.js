// src/charts/chartSmoke.js
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export async function selfTestChartText() {
    const width = 900, height = 600;

    const chart = new ChartJSNodeCanvas({
        width, height, backgroundColour: 'white',
        // FORCE Skia backend:
        canvas: { createCanvas, loadImage },
        chartCallback: (ChartJS) => {
            ChartJS.defaults.font.family = 'dejavusanslocal';
            ChartJS.defaults.font.size = 16;
            ChartJS.defaults.color = '#111';
        }
    });

    const cfg = {
        type: 'bar',
        data: {
            labels: ['Hapoel Tel Aviv', 'Παναθηναϊκός', 'Ολυμπιακός'],
            datasets: [{
                label: 'Δοκιμή / Test',
                data: [10, 12, 8],
                backgroundColor: '#0c7b43',
                borderRadius: 6
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { labels: { font: { family: 'dejavusanslocal', size: 14 } } },
                title: { display: true, text: 'Font Smoke Test', font: { family: 'dejavusanslocal', size: 20, weight: 'bold' } },
            },
            scales: {
                x: { ticks: { font: { family: 'dejavusanslocal', size: 12 } } },
                y: { beginAtZero: true, ticks: { font: { family: 'dejavusanslocal', size: 12 } } }
            }
        }
    };

    return chart.renderToBuffer(cfg, 'image/png');
}
