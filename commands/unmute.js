// commands/unmute.js  (group admins or owner; bot must be admin)
// Lets everyone send messages in the group again.
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');
const { invalidate } = require('../lib/groupCache');

const TITLE = '🔊 UNMUTE';

module.exports = {
  name: 'unmute',
  aliases: [],
  description: 'Let everyone send messages again',
  emoji: '🔊',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, TITLE);
    if (!guard) return;

    const muted = Boolean(guard.meta.announce);
    if (muted === false) {
      return reply(ui.box(TITLE, ['ℹ️ The group is not muted.']));
    }
    try {
      await sock.groupSettingUpdate(ctx.chatId, 'not_announcement');
      invalidate(ctx.chatId);
      return reply(ui.box(TITLE, ['🔊 Everyone can send messages again.']));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'unmute failed');
      return reply(ui.error("Couldn't change the group setting. Please try again."));
    }
  },
};
