// src/bot/guards.js
import { ALLOWED_CHANNEL_ID } from '../env.js';

export function notAllowedHere(interaction) {
    return interaction.guildId && ALLOWED_CHANNEL_ID && interaction.channelId !== ALLOWED_CHANNEL_ID;
}

// src/bot/guards.js
export function enforceChannel(interaction, allowedChannelId) {
    // Skip guards for autocomplete – they can't be replied to with .reply()
    if (interaction.isAutocomplete()) return false;

    if (!allowedChannelId) return false;
    if (interaction.guildId && interaction.channelId !== allowedChannelId) {
        if (interaction.isRepliable?.()) {
            interaction.reply({
                content: `❌ Please use this bot only in <#${allowedChannelId}>.`,
                ephemeral: true,
            }).catch(() => {});
        }
        return true; // blocked
    }
    return false; // allowed
}

