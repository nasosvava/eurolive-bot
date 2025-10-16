// src/register-commands.js
import { REST, Routes } from 'discord.js';
import { DISCORD_CLIENT_ID, DISCORD_TOKEN, DEV_GUILD_ID } from './env.js';
import { commands } from './commands/index.js';

async function main() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    if (DEV_GUILD_ID) {
        console.log(`Registering GUILD commands to ${DEV_GUILD_ID}…`);
        await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DEV_GUILD_ID), { body: commands });
        console.log('✓ Guild commands registered.');
    } else {
        console.log('Registering GLOBAL commands…');
        await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
        console.log('✓ Global commands registered.');
    }
}

main().catch((err) => {
    console.error('Command registration failed:', err);
    process.exit(1);
});
