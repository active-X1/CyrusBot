// commands/ping.js
module.exports = {
  name: 'ping',
  aliases: [],
  description: 'Check whether the bot is online and measure response latency.',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const start = Date.now();
    const sent = await ctx.safeSend(sock, ctx.chatId, { text: '🏓 Pinging...' }, { quoted: msg });
    const latency = Date.now() - start;
    await ctx.safeSend(
      sock,
      ctx.chatId,
      { text: `🏓 Pong! ${latency}ms` },
      { quoted: msg }
    );
  },
};
