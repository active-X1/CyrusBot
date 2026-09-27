// commands/ping.js
const config = require('../config');

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check whether the bot is online and measure response latency.',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    // Real, measured latency: the clock starts now and stops once
    // Baileys confirms the "Pinging..." message actually went out, so
    // this reflects the real round trip to WhatsApp's servers rather
    // than a hardcoded number.
    const start = Date.now();
    await ctx.safeSend(sock, ctx.chatId, { text: '🏓 Pinging...' }, { quoted: msg });
    const latency = Date.now() - start;

    const text = [
      `╭━━━〔 🏓 PONG! 〕━━━╮`,
      `┃`,
      `┃ ⚡ Response : ${latency}ms`,
      `┃ 🟢 Status   : Online`,
      `┃ 🤖 Bot      : ${config.botName}`,
      `┃`,
      `╰━━━━━━━━━━━━━━━━━╯`,
    ].join('\n');

    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
  },
};
