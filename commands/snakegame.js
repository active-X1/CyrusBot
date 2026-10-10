// commands/snakegame.js
// Works with ".snakegame" and "!snakegame" automatically: prefix
// handling is central (lib/helpers.js matchPrefix + index.js), so no
// command ever deals with prefixes itself.
// NOTE: the game runs entirely client-side. This command only delivers
// it (link, or file fallback) - the bot never receives taps or scores.
const { sendGame } = require('../lib/gameServer');

module.exports = {
  name: 'snakegame',
  aliases: [],
  description: 'Play Snake',
  emoji: '🐍',
  category: 'games',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    await sendGame(sock, ctx.chatId, msg, 'snake', ctx.safeSend);
  },
};
