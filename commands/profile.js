// commands/profile.js
//
// ".profile" / ".pic" (also "!profile" / "!pic"): download someone's
// current WhatsApp profile picture and send it back.
//
//   In a group: reply to the person's message (or @mention them).
//   In a DM:    just send the command - uses the person you're chatting with.
//
// If the person has no picture, or hides it from you via privacy
// settings, WhatsApp refuses the request and we say so instead of failing.

const { digitsFromJid } = require('../lib/helpers');

const ui = require('../lib/ui');

module.exports = {
  name: 'profile',
  aliases: ['pic'],
  description: 'Get a profile picture (reply)',
  emoji: '🖼️',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const send = (content) => ctx.safeSend(sock, ctx.chatId, content, { quoted: msg });

    // 1. Decide whose picture we want.
    let targetJid;
    if (!ctx.isGroup) {
      targetJid = ctx.chatId; // DM: the other person
    } else {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0];
      if (!targetJid) {
        return send({
          text: ui.usage('profile', '', 'Reply to someone (or @mention them) in a group'),
        });
      }
    }

    // 2. Ask WhatsApp for the picture URL ('image' = full size).
    let url;
    try {
      url = await sock.profilePictureUrl(targetJid, 'image');
    } catch (err) {
      // Usually "item-not-found" (no picture) or "not-authorized" (hidden).
      ctx.logger.info({ reason: err.message }, 'No profile picture available');
      url = null;
    }

    if (!url) {
      return send({
        text: ui.box('🖼️ PROFILE', ['🚫 No profile picture', 'It is missing or hidden by privacy settings']),
      });
    }

    // 3. Download it ourselves, then send the bytes (not the URL).
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await send({
        image: buffer,
        caption: ui.box('🖼️ PROFILE', [`👤 @${digitsFromJid(targetJid)}`]),
        mentions: [targetJid],
      });
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'profile picture download failed');
      await send({ text: ui.error('Found the picture but couldn\'t download it. Please try again.') });
    }
  },
};
