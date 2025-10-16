// src/index.js
import { client, startClient } from './bot/client.js';
import { wireInteractions } from './bot/router.js';
import { startLiveBoxscoreLoop } from './bot/liveBoxscore.js';

async function main() {
    wireInteractions(client);
    startLiveBoxscoreLoop(client);
    await startClient(); // <- await the login Promise
}

main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
