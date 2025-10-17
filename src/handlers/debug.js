// src/handlers/debug.js
import { AttachmentBuilder } from 'discord.js';
import { selfTestCanvasText } from '../charts/smoke.js';
import { selfTestChartText } from '../charts/chartSmoke.js';

export async function fontTest(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const buf = selfTestCanvasText();
        const file = new AttachmentBuilder(buf, { name: 'font-test.png' });
        await interaction.editReply({ content: '🧪 Skia direct text test', files: [file] });
    } catch (e) {
        await interaction.editReply({ content: `❌ font-test failed: ${e?.message || e}` });
    }
}

export async function chartTest(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const buf = await selfTestChartText();
        const file = new AttachmentBuilder(buf, { name: 'chart-test.png' });
        await interaction.editReply({ content: '🧪 Chart.js text test', files: [file] });
    } catch (e) {
        await interaction.editReply({ content: `❌ chart-test failed: ${e?.message || e}` });
    }
}
