// commands/groupinfo.js
//
//   .groupinfo               -> info about the group you're in
//   .groupinfo <group link>  -> info about ANY group via its invite link
//                               (works in groups and in DMs)
//   In a DM without a link   -> explains how to use it
//
// Shows: name, id, created date + creator (when WhatsApp provides it),
// admin / member counts, description, and the group picture (skipped
// when the group has none).
//
// Note: for a group you are NOT in (link lookup), WhatsApp only returns
// the member total and sometimes a partial member list, so the admin
// count may be unavailable - we say so instead of guessing.

const config = require('../config');
const ui = require('../lib/ui');
const { digitsFromJid } = require('../lib/helpers');

const INVITE_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,32})/i;

function formatDate(seconds) {
  if (!seconds) return null;
  const d = new Date(seconds * 1000);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  }) + ' UTC';
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

module.exports = {
  name: 'groupinfo',
  aliases: ['ginfo'],
  description: 'Group info (here or via link)',
  emoji: '👥',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (content) => ctx.safeSend(sock, ctx.chatId, content, { quoted: msg });
    const linkMatch = args.join(' ').match(INVITE_RE);

    // 1. Decide where the info comes from.
    if (!linkMatch && !ctx.isGroup) {
      return reply({
        text: ui.box('👥 GROUP INFO', [
          '🚫 This works inside a group.',
          '',
          '💡 In a DM, give a group link:',
          `${config.prefix}groupinfo <group link>`,
          '',
          '🔗 Example:',
          'https://chat.whatsapp.com/XXXXXXXXXXXX',
        ]),
      });
    }

    let meta;
    let fromLink = false;
    try {
      if (linkMatch) {
        fromLink = true;
        meta = await sock.groupGetInviteInfo(linkMatch[1]);
      } else {
        meta = await sock.groupMetadata(ctx.chatId);
      }
    } catch (err) {
      ctx.logger.warn({ err: err.message, fromLink }, 'groupinfo lookup failed');
      return reply({
        text: ui.error(
          fromLink
            ? 'Could not read that group link.\nIt may be invalid, expired or revoked.'
            : 'Could not fetch this group\'s info. Try again shortly.'
        ),
      });
    }

    // 2. Work out the numbers.
    const participants = meta.participants || [];
    const total = meta.size || participants.length;
    const haveFullList = participants.length > 0 && participants.length >= total;
    const admins = participants.filter((p) => p.admin === 'admin' || p.admin === 'superadmin').length;
    const members = total - admins;

    const lines = [`🏷️ Name    : ${meta.subject || 'Unknown'}`];
    if (meta.id) lines.push(`🆔 ID      : ${meta.id.split('@')[0]}`);

    const created = formatDate(meta.creation);
    if (created) lines.push(`📅 Created : ${created}`);

    const creatorJid = meta.ownerPn || meta.owner;
    const mentions = [];
    if (creatorJid) {
      lines.push(`👑 By      : @${digitsFromJid(creatorJid)}`);
      mentions.push(creatorJid);
    }

    lines.push('');
    lines.push(`👥 Total   : ${total}`);
    if (haveFullList) {
      lines.push(`🛡️ Admins  : ${admins}`);
      lines.push(`🙋 Members : ${members}`);
    } else {
      lines.push('🛡️ Admins  : unavailable (not in this group)');
    }

    const flags = [];
    if (meta.announce) flags.push('🔒 Only admins can send');
    if (meta.restrict) flags.push('⚙️ Only admins can edit info');
    if (meta.isCommunity) flags.push('🏘️ Community');
    if (flags.length) lines.push('', ...flags);

    if (meta.desc) lines.push('', '📝 Description:', truncate(meta.desc.trim(), 600));

    const text = ui.box('👥 GROUP INFO', lines);

    // 3. Try with the group picture; skip it silently if there is none.
    let pictureUrl = null;
    try {
      pictureUrl = await sock.profilePictureUrl(meta.id, 'image');
    } catch {
      pictureUrl = null; // no picture / hidden - just skip it
    }

    if (pictureUrl) {
      const sent = await reply({ image: { url: pictureUrl }, caption: text, mentions });
      if (sent) return;
      ctx.logger.warn('groupinfo image send failed, falling back to text');
    }
    await reply({ text, mentions });
  },
};
