// src/utils/httpDecode.js
import axios from 'axios';
import iconv from 'iconv-lite';

function pickEncoding(contentType, fallback = 'utf8') {
    // try to read charset=... from header
    const m = /charset\s*=\s*([^;]+)/i.exec(contentType || '');
    if (m) return m[1].toLowerCase().trim();
    return fallback;
}

export async function fetchTextDecoded(url, { tryEncodings = ['utf8','windows-1253','iso-8859-7'] } = {}) {
    const resp = await axios.get(url, { responseType: 'arraybuffer', validateStatus: s => s >= 200 && s < 400 });
    const buf = Buffer.from(resp.data);

    // 1) trust header if it has a charset
    const encFromHeader = pickEncoding(resp.headers['content-type']);
    try {
        return iconv.decode(buf, encFromHeader);
    } catch {}

    // 2) try common Greek encodings
    for (const enc of tryEncodings) {
        try { return iconv.decode(buf, enc); } catch {}
    }

    // 3) last resort
    return buf.toString('utf8');
}

export async function fetchJSONDecoded(url, opts) {
    const txt = await fetchTextDecoded(url, opts);
    try { return JSON.parse(txt); } catch {
        // some APIs return "json" with BOM or weird encoding → try to clean
        const clean = txt.replace(/^\uFEFF/, '');
        return JSON.parse(clean);
    }
}
