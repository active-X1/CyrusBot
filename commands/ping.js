// commands/ping.js
const config = require('../config');
const ui = require('../lib/ui');

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check bot speed',
  emoji: '🏓',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    // Real, measured latency: the clock stops once Baileys confirms the
    // "Pinging..." message went out - a true round trip to WhatsApp.
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

    const text = ui.box('🏓 PONG!', [
      `⚡ Response : ${latency}ms`,
      '🟢 Status   : Online',
      `🤖 Bot      : ${config.botName}`,
    ]);
    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
  },
};
