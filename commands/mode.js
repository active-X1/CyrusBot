// commands/mode.js  (owner only)
//   .mode          -> show the current mode
//   .mode public   -> everyone can use the bot
//   .mode private  -> only the owner gets replies (commands, AI mode and
//                     auto-replies are ignored for everyone else)
const ui = require('../lib/ui');
const { getMode, setMode } = require('../lib/mode');

const TITLE = '🔐 BOT MODE';

const describe = (mode) =>
  mode === 'private'
    ? ['🔒 PRIVATE', 'Only the owner can use the bot.']
    : ['🌍 PUBLIC', 'Everyone can use the bot.'];

module.exports = {
  name: 'mode',
  aliases: [],
  description: 'Set bot to public or private',
  usage: 'public|private',
  emoji: '🔐',
  category: 'general',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const p = ctx.config.prefix;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'public' || sub === 'private') {
      setMode(sub);
      return reply(ui.box(TITLE, ['✅ Mode changed', ...describe(sub)]));
    }
    if (sub) return reply(ui.usage('mode', 'public|private', 'Or just .mode to see the current mode'));

    const mode = getMode();
    return reply(
      ui.box(TITLE, [`📡 Status: ${describe(mode)[0]}`, describe(mode)[1], '', `${p}mode public`, `${p}mode private`])
    );
  },
};
