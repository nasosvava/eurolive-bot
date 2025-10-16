// --- Health server for Railway ---
import express from 'express';
const app = express();

app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) =>
    res.json({ status: 'ok', uptime: process.uptime(), ts: Date.now() })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[web] Listening on :${PORT}`));
// --- end health server ---

// --- Discord bot bootstrap (your existing logic) ---
import { client, startClient } from './bot/client.js';
import { wireInteractions } from './bot/router.js';
import { startLiveBoxscoreLoop } from './bot/liveBoxscore.js';

async function main() {
    wireInteractions(client);
    startLiveBoxscoreLoop(client);
    await startClient(); // await the login Promise
}

main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
