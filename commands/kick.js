// commands/kick.js  (group admins or owner; bot must be admin)
//   .kick @user   |   reply to someone with .kick   |   .kick <number>
const ui = require('../lib/ui');
const { pickTarget, guardAdmin } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant, isAdminRole, isOwner } = require('../lib/helpers');

const TITLE = '🦵 KICK';

module.exports = {
  name: 'kick',
  aliases: [],
  description: 'Remove someone from the group',
  usage: '@user',
  emoji: '🦵',
  category: 'admin',
  ownerOnly: false, // owner OR group admin, checked in guardAdmin
  async execute(sock, msg, args, ctx) {
    const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });

    const guard = await guardAdmin(sock, msg, ctx, TITLE);
    if (!guard) return;
    const { meta, me } = guard;

    const targetJid = pickTarget(msg, args);
    if (!targetJid) return reply(ui.usage('kick', '@user', 'Or reply to the person, or give their number'));

    const target = findParticipant(meta.participants, targetJid);
    if (!target) return reply(ui.box(TITLE, ['❓ That person is not in this group.']));

    const tag = `@${digitsFromJid(target.phoneNumber || target.id)}`;
    const mentions = [target.id];
    if (target.id === me.id) return reply(ui.box(TITLE, ["🤖 I can't kick myself."]));
    if (isOwner(target.id, target.phoneNumber)) return reply(ui.box(TITLE, [`👑 ${tag} is my owner.`]), { mentions });
    if (isAdminRole(target)) {
      return reply(ui.box(TITLE, [`🚫 ${tag} is an admin.`, 'Demote them first, then kick.']), { mentions });
    }

    try {
      const result = await sock.groupParticipantsUpdate(ctx.chatId, [target.id], 'remove');
      const status = String(result?.[0]?.status ?? '');
      if (status === '200') return reply(ui.box(TITLE, [`✅ ${tag} was removed.`]), { mentions });
      ctx.logger.warn({ status }, 'Kick was refused');
      return reply(ui.error(`WhatsApp refused this (code ${status || 'unknown'}).`));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'Kick failed');
      return reply(ui.error("Couldn't remove that person. Please try again."));
    }
  },
};
