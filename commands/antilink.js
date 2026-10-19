// commands/antilink.js  (group admins or owner)
//   .antilink            -> show status
//   .antilink on | off   -> turn it on / off for this group
//   .antilink delete     -> delete links (default)
//   .antilink kick       -> delete the link AND remove the sender
// The bot must be a group admin to delete / remove anyone. Group admins,
// the bot owner and the bot itself are never touched.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { isAdminRole } = require('../lib/helpers');
const { getSettings, setEnabled, setAction } = require('../lib/antilink');

const TITLE = '🔗 ANTILINK';

module.exports = {
  name: 'antilink',
  aliases: [],
  description: 'Delete or remove members who post links',
  usage: 'on|off|delete|kick',
  emoji: '🔗',
  category: 'admin',
  ownerOnly: false, // owner OR group admin, checked in guardAdmin
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    const guard = await guardAdmin(sock, msg, ctx, TITLE, { needBotAdmin: false });
    if (!guard) return;
    const botIsAdmin = isAdminRole(guard.me);
    const warn = botIsAdmin ? [] : ['', "⚠️ I'm not a group admin, so I can't delete or remove anyone yet. Make me an admin."];

    const sub = (args[0] || '').toLowerCase();
    const p = ctx.config.prefix;

    if (sub === 'on' || sub === 'off') {
      setEnabled(ctx.chatId, sub === 'on');
      const s = getSettings(ctx.chatId);
      return reply(
        ui.box(TITLE, [
          sub === 'on' ? '🟢 Turned ON' : '🔴 Turned OFF',
          ...(sub === 'on' ? [`⚙️ Action: ${s.action === 'kick' ? 'DELETE + REMOVE' : 'DELETE'}`, ...warn] : []),
        ])
      );
    }

    if (sub === 'delete' || sub === 'kick') {
      setAction(ctx.chatId, sub);
      return reply(ui.box(TITLE, [`✅ Action set to ${sub === 'kick' ? 'DELETE + REMOVE' : 'DELETE'}`, ...warn]));
    }

    if (sub) return reply(ui.usage('antilink', 'on|off|delete|kick'));

    const s = getSettings(ctx.chatId);
    return reply(
      ui.box(TITLE, [
        `📡 Status : ${s.enabled ? '🟢 ON' : '🔴 OFF'}`,
        `⚙️ Action : ${s.action === 'kick' ? 'DELETE + REMOVE' : 'DELETE'}`,
        `🤖 Bot admin : ${botIsAdmin ? 'YES' : 'NO'}`,
        '',
        `${p}antilink on | off`,
        `${p}antilink delete | kick`,
      ])
    );
  },
};
