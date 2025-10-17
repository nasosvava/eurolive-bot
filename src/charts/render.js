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

// canonical names (as embedded in the TTFs)
const DJV_FAMILY = 'DejaVu Sans';
const NOTO_FAMILY = 'Noto Sans';
// local alias (no spaces)
const LOCAL_ALIAS = 'dejavusanslocal';

// font files
const DJV_REG = path.join(fontsDir, 'DejaVuSans.ttf');
const DJV_BOLD = path.join(fontsDir, 'DejaVuSans-Bold.ttf');
const NOTO_REG = path.join(fontsDir, 'NotoSans-Regular.ttf');
const NOTO_BOLD = path.join(fontsDir, 'NotoSans-Bold.ttf');

// ---------- mojibake guard ----------
const GREEK_RANGES = [[0x0370,0x03ff],[0x1f00,0x1fff]];
const countGreek = s => { let n=0; for (const ch of String(s)) { const cp=ch.codePointAt(0); if (cp==null) continue; for (const [lo,hi] of GREEK_RANGES) if (cp>=lo&&cp<=hi){n++;break;} } return n; };
const latin1RoundTrip = s => { const t=String(s); const b=Buffer.allocUnsafe(t.length); for (let i=0;i<t.length;i++) b[i]=t.charCodeAt(0+i)&0xff; return b.toString('latin1'); };
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

// ---------- Chart.js defaults as OBJECT (never a raw string) ----------
Chart.defaults.font = {
    family: LOCAL_ALIAS,
    size: 14,
    style: 'normal',
    weight: '400',
    lineHeight: 1.2,
};
Chart.defaults.color = '#1f1f1f';

const fontObj = (size=12, weight='normal') =>
    ({ family: LOCAL_ALIAS, size, style: 'normal', weight });

// ---------- guard any invalid ctx.font assignment ----------
function guardContextFont(ctx, fallbackPx = 14, fallbackFamily = LOCAL_ALIAS) {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'font');
    if (!desc || typeof desc.set !== 'function' || typeof desc.get !== 'function') return;

    const rawGet = desc.get.bind(ctx);
    const rawSet = desc.set.bind(ctx);

    Object.defineProperty(ctx, 'font', {
        configurable: true,
        enumerable: true,
        get: rawGet,
        set(value) {
            try {
                // If someone passes just a family (e.g. "dejavusanslocal") or anything without "px",
                // coerce to a valid CSS shorthand: "normal 14px dejavusanslocal"
                if (typeof value === 'string') {
                    const v = value.trim();
                    if (!/(\d+)px/.test(v)) {
                        const safe = `normal ${fallbackPx}px ${fallbackFamily}`;
                        // console.log('[charts] font guard coerced:', JSON.stringify(v), '->', JSON.stringify(safe));
                        return rawSet(safe);
                    }
                }
            } catch {}
            return rawSet(value);
        }
    });

    // seed a valid font right now too
    ctx.font = `normal ${fallbackPx}px ${fallbackFamily}`;
}

// ---------- shared options ----------
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

    // Guard any future invalid ctx.font assignments (from Chart.js internals or plugins)
    guardContextFont(ctx, 14, LOCAL_ALIAS);

    // white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,WIDTH,HEIGHT);

    // Debug: show the font string we will start with
    // console.log('[charts] ctx.font at start:', ctx.font);

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
