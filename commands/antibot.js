// commands/antibot.js  (group admins or owner)
//   .antibot             -> status
//   .antibot on | off
//   .antibot delete      -> delete the other bot's messages (default)
//   .antibot kick        -> delete AND remove the bot account
// The bot must be a group admin. Detection relies on message IDs - see lib/antibot.js
// for what it can and can't catch.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { isAdminRole } = require('../lib/helpers');
const { getSettings, setEnabled, setAction } = require('../lib/antibot');

const TITLE = '🤖 ANTIBOT';

module.exports = {
  name: 'antibot',
  aliases: [],
  description: 'Block other bots in the group',
  usage: 'on|off|delete|kick',
  emoji: '🤖',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, TITLE, { needBotAdmin: false });
    if (!guard) return;

    const botIsAdmin = isAdminRole(guard.me);
    const warn = botIsAdmin ? [] : ['', "⚠️ I'm not a group admin, so I can't delete or remove anything yet."];
    const label = (a) => (a === 'kick' ? 'DELETE + REMOVE' : 'DELETE');
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on' || sub === 'off') {
      setEnabled(ctx.chatId, sub === 'on');
      return reply(ui.box(TITLE, [sub === 'on' ? '🟢 Turned ON' : '🔴 Turned OFF', ...(sub === 'on' ? [`⚙️ Action: ${label(getSettings(ctx.chatId).action)}`, ...warn] : [])]));
    }
    if (sub === 'delete' || sub === 'kick') {
      setAction(ctx.chatId, sub);
      return reply(ui.box(TITLE, [`✅ Action set to ${label(sub)}`, ...warn]));
    }
    if (sub) return reply(ui.usage('antibot', 'on|off|delete|kick'));

    const s = getSettings(ctx.chatId);
    const p = ctx.config.prefix;
    return reply(
      ui.box(TITLE, [
        `📡 Status : ${s.enabled ? '🟢 ON' : '🔴 OFF'}`,
        `⚙️ Action : ${label(s.action)}`,
        `🤖 Bot admin : ${botIsAdmin ? 'YES' : 'NO'}`,
        '',
        `${p}antibot on | off`,
        `${p}antibot delete | kick`,
      ])
    );
  },
};
