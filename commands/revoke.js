// commands/revoke.js  (group admins or owner; bot must be admin)
// Resets the invite link: the old link stops working and a new one is made.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');

module.exports = {
  name: 'revoke',
  aliases: ['resetlink'],
  description: 'Reset the group invite link',
  emoji: '♻️',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, '♻️ REVOKE LINK');
    if (!guard) return;
    try {
      const code = await sock.groupRevokeInvite(ctx.chatId);
      return reply(ui.box('♻️ LINK RESET', ['✅ The old link no longer works.', '', `New link: https://chat.whatsapp.com/${code}`]));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'revoke failed');
      return reply(ui.error("Couldn't reset the invite link. Please try again."));
    }
  },
};
