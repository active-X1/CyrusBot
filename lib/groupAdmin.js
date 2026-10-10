// lib/groupAdmin.js
// Shared logic for .promote and .demote (they differ only in `action`).
//
// Rules:
//   - Group only.
//   - The BOT must be an admin of the group (WhatsApp refuses otherwise).
//   - The command itself is owner-only (enforced in index.js via ownerOnly).
//   - Target = the @mentioned person, else the person you replied to,
//     else a phone number typed after the command.
//   - People are matched across phone / @lid addresses, and we always
//     pass WhatsApp the exact id it lists in the group.

const ui = require('./ui');
const { digitsFromJid, findParticipant, botJids, isAdminRole } = require('./helpers');

function pickTarget(msg, args) {
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = contextInfo?.mentionedJid?.[0];
  if (mentioned) return mentioned;
  if (contextInfo?.participant) return contextInfo.participant; // the person replied to
  const digits = args.join('').replace(/[^0-9]/g, '');
  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`;
  return null;
}

const STATUS_HELP = {
  '403': 'WhatsApp refused (not allowed for this person).',
  '404': 'That person is not in this group.',
  '406': 'WhatsApp refused this change.',
};

async function changeRole(sock, msg, args, ctx, action) {
  const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });
  const verb = action === 'promote' ? 'PROMOTE' : 'DEMOTE';
  const title = `${action === 'promote' ? '⬆️' : '⬇️'} ${verb}`;

  if (!ctx.isGroup) return reply(ui.error('This only works inside a group.'));

  const targetJid = pickTarget(msg, args);
  if (!targetJid) {
    return reply(ui.usage(action, '@user', 'Or reply to the person, or give their number'));
  }

  let meta;
  try {
    meta = await sock.groupMetadata(ctx.chatId);
  } catch (err) {
    ctx.logger.warn({ err: err.message }, `${action}: could not read group metadata`);
    return reply(ui.error("Couldn't read this group's info. Try again shortly."));
  }

  const me = findParticipant(meta.participants, ...botJids(sock));
  if (!isAdminRole(me)) {
    return reply(ui.box(title, ['🚫 I am not an admin in this group.', 'Make me an admin first, then try again.']));
  }

  const target = findParticipant(meta.participants, targetJid);
  if (!target) return reply(ui.box(title, ['❓ That person is not in this group.']));
  if (target.id === me.id) return reply(ui.box(title, ["🤖 I can't change my own role."]));

  const tag = `@${digitsFromJid(target.phoneNumber || target.id)}`;
  if (action === 'promote' && isAdminRole(target)) {
    return reply(ui.box(title, [`ℹ️ ${tag} is already an admin.`]), { mentions: [target.id] });
  }
  if (action === 'demote' && !isAdminRole(target)) {
    return reply(ui.box(title, [`ℹ️ ${tag} is not an admin.`]), { mentions: [target.id] });
  }
  if (action === 'demote' && target.admin === 'superadmin') {
    return reply(ui.box(title, [`🚫 ${tag} created this group and can't be demoted.`]), { mentions: [target.id] });
  }

  try {
    const result = await sock.groupParticipantsUpdate(ctx.chatId, [target.id], action);
    const status = String(result?.[0]?.status ?? '');
    if (status === '200') {
      return reply(
        ui.box(title, [action === 'promote' ? `✅ ${tag} is now an admin.` : `✅ ${tag} is no longer an admin.`]),
        { mentions: [target.id] }
      );
    }
    ctx.logger.warn({ status, action }, 'Group role change was refused');
    return reply(ui.error(STATUS_HELP[status] || `WhatsApp refused this change (code ${status || 'unknown'}).`));
  } catch (err) {
    ctx.logger.error({ err: err.message, action }, 'Group role change failed');
    return reply(ui.error(`Couldn't ${action} that person. Please try again.`));
  }
}

/**
 * Shared guard for group-admin commands (.kick, .tagall, .groupimg).
 * Group only; the sender must be the bot owner or a group admin; the bot
 * must be an admin if `needBotAdmin`. Replies with the reason and returns
 * null when something is missing, else { meta, me }.
 */
async function guardAdmin(sock, msg, ctx, title, { needBotAdmin = true } = {}) {
  const reply = (text, extra = {}) => ctx.safeSend(sock, ctx.chatId, { text, ...extra }, { quoted: msg });
  if (!ctx.isGroup) {
    await reply(ui.error('This only works inside a group.'));
    return null;
  }
  let meta;
  try {
    meta = await sock.groupMetadata(ctx.chatId);
  } catch (err) {
    ctx.logger.warn({ err: err.message }, 'Could not read group metadata');
    await reply(ui.error("Couldn't read this group's info. Try again shortly."));
    return null;
  }
  const sender = findParticipant(meta.participants, ctx.senderJid, ctx.senderAltJid);
  if (!ctx.isOwner && !isAdminRole(sender)) {
    await reply(ui.denied('Only group admins can use this command.'));
    return null;
  }
  const me = findParticipant(meta.participants, ...botJids(sock));
  if (needBotAdmin && !isAdminRole(me)) {
    await reply(ui.box(title, ['🚫 I am not an admin in this group.', 'Make me an admin first, then try again.']));
    return null;
  }
  return { meta, me };
}

module.exports = { changeRole, pickTarget, guardAdmin };
