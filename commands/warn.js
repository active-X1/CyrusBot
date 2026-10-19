// commands/warn.js  (group admins or owner)
//   .warn @user [reason]   |   reply to someone with .warn [reason]
// At the warning limit (WARN_LIMIT, default 3) the member is removed and their
// warnings are cleared. The bot must be an admin to remove anyone.
const ui = require('../lib/ui');
const config = require('../config');
const { pickTarget, guardAdmin } = require('../lib/groupAdmin');
const { digitsFromJid, findParticipant, isAdminRole, isOwner } = require('../lib/helpers');
const { invalidate } = require('../lib/groupCache');
const { addWarn, resetWarns } = require('../lib/warns');

const TITLE = '⚠️ WARN';

module.exports = {
  name: 'warn',
  aliases: [],
  description: 'Warn a member (removed at the limit)',
  usage: '@user <reason>',
  emoji: '⚠️',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });

    const guard = await guardAdmin(sock, msg, ctx, TITLE, { needBotAdmin: false });
    if (!guard) return;
    const { meta, me } = guard;

    const targetJid = pickTarget(msg, []); // the reason text may contain digits, so don't read numbers from it
    if (!targetJid) return reply(ui.usage('warn', '@user <reason>', 'Or reply to the person you want to warn'));

    const target = findParticipant(meta.participants, targetJid);
    if (!target) return reply(ui.box(TITLE, ['❓ That person is not in this group.']));

    const tag = `@${digitsFromJid(target.id)}`;
    const mentions = [target.id];
    if (me && target.id === me.id) return reply(ui.box(TITLE, ["🤖 I can't warn myself."]));
    if (isOwner(target.id, target.phoneNumber)) return reply(ui.box(TITLE, [`👑 ${tag} is my owner.`]), { mentions });
    if (isAdminRole(target)) return reply(ui.box(TITLE, [`🚫 ${tag} is an admin and can't be warned.`]), { mentions });

    // The reason is everything after the @mention (drop the "@12345" word itself).
    const reason = args.filter((a) => !/^@\d{5,}$/.test(a)).join(' ').trim();
    const entry = addWarn(ctx.chatId, target, reason);
    const limit = config.warnLimit;

    if (entry.count < limit) {
      return reply(
        ui.box(TITLE, [
          `⚠️ ${tag} has been warned.`,
          `📊 Warnings: ${entry.count}/${limit}`,
          ...(reason ? [`📝 Reason: ${reason}`] : []),
          '',
          `At ${limit} warnings they will be removed.`,
        ]),
        { mentions }
      );
    }

    // Limit reached.
    if (!isAdminRole(me)) {
      return reply(
        ui.box(TITLE, [`🚨 ${tag} reached ${limit}/${limit} warnings.`, "I'm not an admin, so I can't remove them. An admin should do it."]),
        { mentions }
      );
    }
    try {
      const result = await sock.groupParticipantsUpdate(ctx.chatId, [target.id], 'remove');
      invalidate(ctx.chatId);
      if (String(result?.[0]?.status ?? '') === '200') {
        resetWarns(ctx.chatId, target);
        return reply(ui.box(TITLE, [`🚫 ${tag} reached ${limit}/${limit} warnings and was removed.`]), { mentions });
      }
      return reply(ui.error('WhatsApp refused to remove that person.'));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'warn: removal failed');
      return reply(ui.error("Couldn't remove that person. Please try again."));
    }
  },
};
