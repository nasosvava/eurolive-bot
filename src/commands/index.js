// src/commands/index.js
import { coreCommands } from './core.js';
import { teamCommands } from './teams.js';
import { playerCommands } from './players.js';
import { utilCommands } from './util.js';

export const commands = [
    ...coreCommands,
    ...teamCommands,
    ...playerCommands,
    ...utilCommands,
];
