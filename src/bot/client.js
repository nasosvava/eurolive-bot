import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { DISCORD_TOKEN } from '../env.js';

export const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
});

// Log once ready
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

/**
 * Log in once (single attempt). Throws on error.
 */
async function startClientOnce() {
    if (!DISCORD_TOKEN || !DISCORD_TOKEN.trim()) {
        throw new Error('DISCORD_TOKEN is missing (env var not set).');
    }
    await client.login(DISCORD_TOKEN.trim());
}

/**
 * Retry login without crashing the process.
 * @param {{maxRetries:number, baseDelayMs:number, onAttempt?:(n)=>void, onLogin?:()=>void, onError?:(err)=>void}} opts
 */
export async function startClientWithRetry(opts = {}) {
    const {
        maxRetries = 0,           // 0 = infinite
        baseDelayMs = 5000,
        onAttempt,
        onLogin,
        onError,
    } = opts;

    let attempt = 0;
    while (true) {
        attempt += 1;
        try {
            onAttempt?.(attempt);
            await startClientOnce();
            onLogin?.();
            return; // success
        } catch (err) {
            onError?.(err);
            const msg = err?.message || String(err);
            console.error(`[bot] Login attempt #${attempt} failed: ${msg}`);

            // Common: TokenInvalid or Privileged intent issues
            if (msg.includes('TokenInvalid')) {
                console.error(
                    '[bot] Invalid token. Set a valid DISCORD_TOKEN in Railway → Variables.',
                );
            }

            // Decide whether to stop retrying
            if (maxRetries > 0 && attempt >= maxRetries) {
                console.error('[bot] Reached max retries, keeping process alive for healthcheck.');
                return;
            }

            // Exponential-ish backoff (cap at 60s)
            const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt - 1), 60000);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}
