// src/charts/render.js
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import Chart from 'chart.js/auto';

const WIDTH = 1200;
const HEIGHT = 900;

if (typeof globalThis.devicePixelRatio === 'undefined') globalThis.devicePixelRatio = 1;

// ---------- paths ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.resolve(here, '../../assets/fonts');
const FAMILY_ALIAS = 'dejavusanslocal';

// fonts
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

// ---------- fonts ----------
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const registerIf = p => exists(p) && (GlobalFonts.registerFromPath(p, FAMILY_ALIAS), true);

(function bootFonts(){
    const list = exists(fontsDir) ? fs.readdirSync(fontsDir) : [];
    console.log('[charts] fontsDir:', fontsDir, 'exists:', !!list.length, 'files:', list);
    const used = {
        dejavu: { reg: registerIf(DJV_REG),  bold: registerIf(DJV_BOLD) },
        noto:   { reg: registerIf(NOTO_REG), bold: registerIf(NOTO_BOLD) },
    };
    const hasAlias = GlobalFonts.has(FAMILY_ALIAS);
    console.log('[charts] registered alias "%s" ->', FAMILY_ALIAS, { ...used, hasAlias });
    if(!used.dejavu.reg && !used.dejavu.bold && !used.noto.reg && !used.noto.bold && !hasAlias){
        throw new Error(`[charts] Could not register fonts under "${FAMILY_ALIAS}". Ensure TTFs exist in ${fontsDir}.`);
    }
})();

// ---------- defaults (no plugin hacking) ----------
Chart.defaults.font.family = FAMILY_ALIAS;
Chart.defaults.font.size = 14;
Chart.defaults.color = '#1f1f1f';

function buildCommonOptions({ title, xLabel, indexAxis='x', beginAtZero=true } = {}) {
    return {
        indexAxis,
        responsive: false,
        layout: { padding: 16 },
        plugins: {
            legend: {
                display: Boolean(xLabel),
                labels: { font: { family: FAMILY_ALIAS, size: 14, weight: 'bold' }, color: '#1f1f1f' },
            },
            title: {
                display: Boolean(title),
                text: fixLabel(title ?? ''),
                font: { family: FAMILY_ALIAS, size: 20, weight: 'bold' },
                color: '#1f1f1f',
            },
            tooltip: {
                bodyFont: { family: FAMILY_ALIAS, size: 14 },
                titleFont: { family: FAMILY_ALIAS, size: 16, weight: 'bold' },
            },
        },
        scales: {
            x: {
                beginAtZero,
                ticks: { font: { family: FAMILY_ALIAS, size: 12 }, color: '#1f1f1f' },
                title: xLabel ? { text: fixLabel(xLabel), display: true, font: { family: FAMILY_ALIAS, size: 14, weight: 'bold' } } : undefined,
            },
            y: { beginAtZero, ticks: { font: { family: FAMILY_ALIAS, size: 12 }, color: '#1f1f1f' } },
        },
    };
}

async function renderChartToBuffer(cfg){
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

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
