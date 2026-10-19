// commands/link.js  (group admins or owner; bot must be admin)
// Shows this group's invite link.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');

module.exports = {
  name: 'link',
  aliases: ['invite'],
  description: 'Get the group invite link',
  emoji: '🔗',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, '🔗 GROUP LINK');
    if (!guard) return;
    try {
      const code = await sock.groupInviteCode(ctx.chatId);
      return reply(ui.box('🔗 GROUP LINK', [`https://chat.whatsapp.com/${code}`]));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'link failed');
      return reply(ui.error("Couldn't get the invite link. Please try again."));
    }
  },
};
