// src/index.js
import { client, startClient } from './bot/client.js';
import { wireInteractions } from './bot/router.js';
import { startLiveBoxscoreLoop } from './bot/liveBoxscore.js';
import express from 'express';
const app = express();

app.get('/', (_, res) => res.send('OK'));
app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[web] Listening on :${PORT}`));

async function main() {
    wireInteractions(client);
    startLiveBoxscoreLoop(client);
    await startClient(); // <- await the login Promise
}

main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
