import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import Chart from 'chart.js/auto';

const WIDTH = 1200;
const HEIGHT = 900;

// Chart.js may read this
if (typeof globalThis.devicePixelRatio === 'undefined') globalThis.devicePixelRatio = 1;

// ---------- paths ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(here, '../../assets/fonts');

// canonical names (as embedded in TTFs)
const DJV_FAMILY = 'DejaVu Sans';
const NOTO_FAMILY = 'Noto Sans';
// local alias without spaces
const LOCAL_ALIAS = 'dejavusanslocal';

// font files
const DJV_REG = path.join(fontsDir, 'DejaVuSans.ttf');
const DJV_BOLD = path.join(fontsDir, 'DejaVuSans-Bold.ttf');
const NOTO_REG = path.join(fontsDir, 'NotoSans-Regular.ttf');
const NOTO_BOLD = path.join(fontsDir, 'NotoSans-Bold.ttf');

// ---------- mojibake guard ----------
const GREEK_RANGES = [[0x0370,0x03ff],[0x1f00,0x1fff]];
const countGreek = s => { let n=0; for (const ch of String(s)) { const cp=ch.codePointAt(0); if (cp==null) continue; for (const [lo,hi] of GREEK_RANGES) if (cp>=lo&&cp<=hi){n++;break;} } return n; };
const latin1RoundTrip = s => { const t=String(s); const b=Buffer.allocUnsafe(t.length); for (let i=0;i<t.length;i++) b[i]=t.charCodeAt(i)&0xff; return b.toString('latin1'); };
function repairGreek(text){
    const s=String(text??'').replace(/\s+/g,' ').trim(); if(!s) return s;
    const g0=countGreek(s), hasFFFD=s.includes('\uFFFD'), nonAscii=[...s].some(c=>c.charCodeAt(0)>0x7f);
    if(!hasFFFD && (g0>0 || !nonAscii)) return s.normalize('NFC');
    const r=latin1RoundTrip(s), g1=countGreek(r);
    return (g1>g0 || hasFFFD) ? r.normalize('NFC') : s.normalize('NFC');
}
const fixLabel = x => repairGreek(x).replace(/[\u0000-\u001F\u007F]/g,'');
const fixLabels = a => (a??[]).map(fixLabel);

// ---------- register fonts under multiple family names ----------
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const reg = (file, family) => { if (exists(file)) GlobalFonts.registerFromPath(file, family); };

(function bootFonts(){
    const list = exists(fontsDir) ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', !!list.length, 'files:', list);

    // DejaVu
    reg(DJV_REG, DJV_FAMILY);
    reg(DJV_BOLD, DJV_FAMILY);
    reg(DJV_REG, LOCAL_ALIAS);
    reg(DJV_BOLD, LOCAL_ALIAS);

    // Noto fallback
    reg(NOTO_REG, NOTO_FAMILY);
    reg(NOTO_BOLD, NOTO_FAMILY);
    reg(NOTO_REG, LOCAL_ALIAS);
    reg(NOTO_BOLD, LOCAL_ALIAS);

    console.log('[charts] GlobalFonts.has alias?', LOCAL_ALIAS, GlobalFonts.has(LOCAL_ALIAS));
    console.log('[charts] GlobalFonts.has DejaVu?', DJV_FAMILY, GlobalFonts.has(DJV_FAMILY));
    console.log('[charts] GlobalFonts.has Noto?', NOTO_FAMILY, GlobalFonts.has(NOTO_FAMILY));
})();

// ---------- Chart.js defaults as OBJECT (never a string) ----------
Chart.defaults.font = {
    family: LOCAL_ALIAS, // can resolve to DejaVu or Noto we registered
    size: 14,
    style: 'normal',
    weight: '400',
    lineHeight: 1.2
};
Chart.defaults.color = '#1f1f1f';

function fontObj(size=12, weight='normal'){
    return { family: LOCAL_ALIAS, size, style: 'normal', weight };
}

function buildCommonOptions({ title, xLabel, indexAxis='x', beginAtZero=true } = {}) {
    return {
        indexAxis,
        responsive: false,
        layout: { padding: 16 },
        plugins: {
            legend: {
                display: Boolean(xLabel),
                labels: { font: fontObj(14, '700'), color: '#1f1f1f' },
            },
            title: {
                display: Boolean(title),
                text: fixLabel(title ?? ''),
                font: fontObj(20, '700'),
                color: '#1f1f1f',
            },
            tooltip: {
                bodyFont: fontObj(14, '400'),
                titleFont: fontObj(16, '700'),
            },
        },
        scales: {
            x: {
                beginAtZero,
                ticks: { font: fontObj(12, '400'), color: '#1f1f1f' },
                title: xLabel ? { text: fixLabel(xLabel), display: true, font: fontObj(14, '700') } : undefined,
            },
            y: { beginAtZero, ticks: { font: fontObj(12, '400'), color: '#1f1f1f' } },
        },
    };
}

async function renderChartToBuffer(cfg){
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // seed a valid CSS font on the context (protects against any plugin assigning a bare family)
    ctx.font = `14px ${LOCAL_ALIAS}`;

    // white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    const chart = new Chart(ctx, cfg);
    chart.update();
    await Promise.resolve(); // flush async measure
    const png = canvas.toBuffer('image/png');
    chart.destroy();
    return png;
}

// ---------- public renderers ----------
export async function renderHorizontalBar({ labels, values, title, xLabel, colors }) {
    const safe = fixLabels(labels);
    const sample = safe?.[0] ?? '';
    console.log('[charts] sample label:', JSON.stringify(sample), [...sample].slice(0,16).map(c => c.codePointAt(0).toString(16)));

    return renderChartToBuffer({
        type: 'bar',
        data: {
            labels: safe,
            datasets: [{
                label: fixLabel(xLabel || ''),
                data: values,
                backgroundColor: Array.isArray(colors) && colors.length ? colors : '#0c7b43',
                borderRadius: 4,
            }],
        },
        options: buildCommonOptions({ title, xLabel, indexAxis: 'y' }),
    });
}

export async function renderComparisonChart({ teamA, teamB, title, metricLabel }) {
    return renderChartToBuffer({
        type: 'bar',
        data: {
            labels: fixLabels([metricLabel]),
            datasets: [
                { label: fixLabel(teamA.teamName), data: [teamA.value], backgroundColor: teamA.color || '#cc2033', borderRadius: 6 },
                { label: fixLabel(teamB.teamName), data: [teamB.value], backgroundColor: teamB.color || '#0c7b43', borderRadius: 6 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    });
}

export async function renderMultiComparisonChart({ labels, teamA, teamB, title }) {
    return renderChartToBuffer({
        type: 'bar',
        data: {
            labels: fixLabels(labels),
            datasets: [
                { label: fixLabel(teamA.label), data: teamA.values, backgroundColor: teamA.color || '#0c7b43', borderRadius: 4 },
                { label: fixLabel(teamB.label), data: teamB.values, backgroundColor: teamB.color || '#cc2033', borderRadius: 4 },
            ],
        },
        options: buildCommonOptions({ title, beginAtZero: true }),
    });
}
