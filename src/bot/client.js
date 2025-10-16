// src/bot/client.js
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { DISCORD_TOKEN } from '../env.js';

export const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

export async function startClient() {
    await client.login(DISCORD_TOKEN);
}
