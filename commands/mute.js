// commands/mute.js  (group admins or owner; bot must be admin)
// Only admins can send messages in the group (until .unmute).
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { invalidate } = require('../lib/groupCache');

const TITLE = '🔇 MUTE';

module.exports = {
  name: 'mute',
  aliases: [],
  description: 'Only admins can send messages',
  emoji: '🔇',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, TITLE);
    if (!guard) return;

    const muted = Boolean(guard.meta.announce);
    if (muted === true) {
      return reply(ui.box(TITLE, ['ℹ️ The group is already muted.']));
    }
    try {
      await sock.groupSettingUpdate(ctx.chatId, 'announcement');
      invalidate(ctx.chatId);
      return reply(ui.box(TITLE, ['🔇 Only admins can send messages now.']));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'mute failed');
      return reply(ui.error("Couldn't change the group setting. Please try again."));
    }
  },
};
