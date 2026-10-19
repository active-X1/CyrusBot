// commands/resetwarn.js  (group admins or owner)
//   .resetwarn @user   |   reply to someone with .resetwarn
const ui = require('../lib/ui');
const { pickTarget, guardAdmin } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant } = require('../lib/helpers');
const { resetWarns } = require('../lib/warns');

const TITLE = '🧹 RESET WARNINGS';

module.exports = {
  name: 'resetwarn',
  aliases: [],
  description: "Clear someone's warnings",
  usage: '@user',
  emoji: '🧹',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });
    const guard = await guardAdmin(sock, msg, ctx, TITLE, { needBotAdmin: false });
    if (!guard) return;

    const targetJid = pickTarget(msg, args);
    if (!targetJid) return reply(ui.usage('resetwarn', '@user', 'Or reply to the person'));
    const target = findParticipant(guard.meta.participants, targetJid);
    if (!target) return reply(ui.box(TITLE, ['❓ That person is not in this group.']));

    resetWarns(ctx.chatId, target);
    return reply(ui.box(TITLE, [`✅ Cleared all warnings for @${digitsFromJid(target.id)}.`]), { mentions: [target.id] });
  },
};
