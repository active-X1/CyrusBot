// commands/tagall.js  (group admins or owner)
//   .tagall            -> mentions everyone
//   .tagall <message>  -> mentions everyone with your message on top
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { digitsFromJid } = require('../lib/helpers');

module.exports = {
  name: 'tagall',
  aliases: ['everyone'],
  description: 'Mention every group member',
  usage: '<message>',
  emoji: '📢',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const guard = await guardAdmin(sock, msg, ctx, '📢 TAG ALL', { needBotAdmin: false });
    if (!guard) return;
    const { meta } = guard;

    const members = meta.participants || [];
    const note = args.join(' ').trim();
    const lines = members.map((p) => `@${digitsFromJid(p.phoneNumber || p.id)}`);
    const title = `📢 TAG ALL${note ? ` - ${note}` : ''}`;
    const text = ui.box(title, [`👥 ${members.length} members`, ...lines], { bullet: '│ ➜ ' });

    await ctx.safeSend(sock, ctx.chatId, { text, mentions: members.map((p) => p.id) }, { quoted: msg });
  },
};
