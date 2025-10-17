// src/handlers/debug.js
import { AttachmentBuilder } from 'discord.js';
import { renderHorizontalBar, renderComparisonChart } from '../charts/render.js';

export async function fontTest(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const buf = await renderHorizontalBar({
            labels: ['Panathinaikos', 'Ολυμπιακός', 'Žalgiris'],
            values: [95, 92, 87],
            title: 'Font Check - Horizontal Bar',
            xLabel: 'Points',
        });
        const file = new AttachmentBuilder(buf, { name: 'font-test.png' });
        await interaction.editReply({ content: 'Font smoke test chart', files: [file] });
    } catch (e) {
        await interaction.editReply({ content: `Font test failed: ${e?.message || e}` });
    }
}

export async function chartTest(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const buf = await renderComparisonChart({
            teamA: { teamName: 'Panathinaikos', value: 88, color: '#0c7b43' },
            teamB: { teamName: 'Olympiacos', value: 91, color: '#cc2033' },
            title: 'Font Check - Comparison',
            metricLabel: 'Offensive Rating',
        });
        const file = new AttachmentBuilder(buf, { name: 'chart-test.png' });
        await interaction.editReply({ content: 'Comparison chart smoke test', files: [file] });
    } catch (e) {
        await interaction.editReply({ content: `Chart test failed: ${e?.message || e}` });
    }
}
