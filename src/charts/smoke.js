// src/charts/smoke.js
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

// Draw text directly with Skia (no Chart.js)
export function selfTestCanvasText() {
    const w = 800, h = 220;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#111111';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = '28px dejavusanslocal';
    ctx.fillText('ASCII: Hapoel Tel Aviv', 20, 60);

    ctx.font = '28px dejavusanslocal';
    ctx.fillText('Ελληνικά: Παναθηναϊκός • Ολυμπιακός', 20, 110);

    ctx.font = '18px dejavusanslocal';
    ctx.fillText(`GlobalFonts.has(dejavusanslocal) = ${GlobalFonts.has('dejavusanslocal')}`, 20, 160);

    return canvas.toBuffer('image/png');
}
