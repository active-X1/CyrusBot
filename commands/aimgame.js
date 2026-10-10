// commands/aimgame.js
// Independent from .snakegame; both share lib/gameServer.js delivery.
// Runs client-side only - the bot never sees taps or scores.
const { sendGame } = require('../lib/gameServer');

module.exports = {
  name: 'aimgame',
  aliases: [],
  description: 'Aim Challenge',
  emoji: '🎯',
  category: 'games',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    await sendGame(sock, ctx.chatId, msg, 'aim', ctx.safeSend);
  },
};
