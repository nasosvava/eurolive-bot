// src/charts/chartSmoke.js
import { createCanvas } from '@napi-rs/canvas';
import Chart from 'chart.js/auto';

const FAMILY_ALIAS = 'dejavusanslocal';

Chart.defaults.font.family = FAMILY_ALIAS;
Chart.defaults.font.size = 16;
Chart.defaults.color = '#111';

const ForceFontPlugin = {
    id: 'force-font',
    beforeDraw(chart) {
        const ctx = chart.ctx;
        const f = ctx.font || '';
        if (!f) return;
        const patched = f.replace(/(['"])?[^,'"]+(['"])?\s*$/, FAMILY_ALIAS);
        if (patched !== f) ctx.font = patched;
    }
};
Chart.register(ForceFontPlugin);

export async function selfTestChartText() {
    const width = 900, height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,width,height);

    const cfg = {
        type: 'bar',
        data: {
            labels: ['Hapoel Tel Aviv', 'Παναθηναϊκός', 'Ολυμπιακός'],
            datasets: [{ label: 'Δοκιμή / Test', data: [10, 12, 8], backgroundColor: '#0c7b43', borderRadius: 6 }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { labels: { font: { family: FAMILY_ALIAS, size: 14 } } },
                title: { display: true, text: 'Font Smoke Test', font: { family: FAMILY_ALIAS, size: 20, weight: 'bold' } },
            },
            scales: {
                x: { ticks: { font: { family: FAMILY_ALIAS, size: 12 } } },
                y: { beginAtZero: true, ticks: { font: { family: FAMILY_ALIAS, size: 12 } } }
            }
        },
        plugins: [ForceFontPlugin],
    };

    const chart = new Chart(ctx, cfg);
    chart.update();
    await Promise.resolve();
    const png = canvas.toBuffer('image/png');
    chart.destroy();
    return png;
}
