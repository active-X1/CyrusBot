// commands/ping.js
//
// Measures the real round trip to WhatsApp: the clock stops when Baileys
// confirms the "Pinging..." message was sent. The result then REPLACES
// that message (edit), so the chat gets one clean reply instead of two.
// If the edit isn't possible, the result is sent as a new message.

const config = require('../config');
const ui = require('../lib/ui');
const { formatUptime } = require('../lib/helpers');

function speedIcon(ms) {
  if (ms < 500) return '🟢';
  if (ms < 1500) return '🟡';
  return '🔴';
}

module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check bot speed',
  emoji: '🏓',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const start = Date.now();
    const sent = await ctx.safeSend(sock, ctx.chatId, { text: '🏓 Pinging...' }, { quoted: msg });
    const latency = Date.now() - start;

    const text = ui.box('🏓 PONG!', [
      `⚡ Speed  : ${latency}ms ${speedIcon(latency)}`,
      `⏱️ Uptime : ${formatUptime(process.uptime())}`,
      `🤖 Bot    : ${config.botName}`,
    ]);

    if (sent?.key) {
      const edited = await ctx.safeSend(sock, ctx.chatId, { text, edit: sent.key });
      if (edited) return;
    }
    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
  },
};
