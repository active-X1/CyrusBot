// commands/hidetag.js  (group admins or owner)
//   .hidetag <message>  -> sends your message and notifies EVERYONE,
//                          without listing their names
//   Reply to a message with .hidetag to resend that message to everyone.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { messageText } = require('../lib/antilink');

module.exports = {
  name: 'hidetag',
  aliases: [],
  description: 'Notify everyone without showing the tags',
  usage: '<message>',
  emoji: '📣',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const guard = await guardAdmin(sock, msg, ctx, '📣 HIDETAG', { needBotAdmin: false });
    if (!guard) return;

    const info = Object.values(msg.message || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
    const quoted = info?.quotedMessage ? messageText(info.quotedMessage).trim() : '';
    const text = args.join(' ').trim() || quoted;
    if (!text) return ctx.safeSend(sock, ctx.chatId, { text: ui.usage('hidetag', '<message>', 'Or reply to a message') }, { quoted: msg });

    await ctx.safeSend(sock, ctx.chatId, { text, mentions: guard.meta.participants.map((p) => p.id) });
  },
};
