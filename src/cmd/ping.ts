import { Command } from '../lib/types.js';

const command: Command = {
    command: "ping",
    tags: ["Main"],
    func: async ({ m }) => {
        const startTime = Date.now();
        await m.reply("Pong!");
        const endTime = Date.now();
        const speed = endTime - startTime;
        await m.reply(`Speed: ${speed}ms`);
    },
};

export default command;
