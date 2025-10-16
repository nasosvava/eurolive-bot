// --- Health server must start FIRST ---
import express from 'express';

const app = express();
let botStatus = { loggedIn: false, lastError: null, attempts: 0 };

app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) =>
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        bot: botStatus,
        ts: Date.now(),
    }),
);

const PORT = process.env.PORT || 3000;
app
    .listen(PORT, () => {
        console.log(`[web] Listening on :${PORT}`);
    })
    .on('error', (err) => {
        console.error('[web] Failed to bind HTTP server:', err);
    });

// --- Discord bot bootstrap (don’t crash if token is wrong) ---
import { client, startClientWithRetry } from './bot/client.js';
import { wireInteractions } from './bot/router.js';
import { startLiveBoxscoreLoop } from './bot/liveBoxscore.js';

async function main() {
    // set up handlers
    wireInteractions(client);
    startLiveBoxscoreLoop(client);

    // login with retry (non-fatal)
    await startClientWithRetry({
        maxRetries: 0,           // 0 = infinite retry
        baseDelayMs: 5000,       // 5s between attempts (exponential backoff inside)
        onAttempt: (attempt) => {
            botStatus.attempts = attempt;
            botStatus.lastError = null;
        },
        onLogin: () => {
            botStatus.loggedIn = true;
            botStatus.lastError = null;
            console.log('✅ Bot login successful.');
        },
        onError: (err) => {
            botStatus.loggedIn = false;
            botStatus.lastError = err?.message || String(err);
        },
    });
}

main().catch((err) => {
    // Never exit; keep healthcheck alive.
    botStatus.lastError = `Fatal in main(): ${err?.message || err}`;
    console.error('Startup error:', err);
});
