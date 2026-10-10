// commands/groupimg.js  (group admins or owner; bot must be admin)
// Sets or changes the group's picture. Either:
//   - send an image with the caption .groupimg, or
//   - reply to an image with .groupimg
const { downloadMediaMessage, normalizeMessageContent } = require('@whiskeysockets/baileys');
const ui = require('../lib/ui');
const { guardAdmin } = require('../lib/groupAdmin');

const TITLE = '🖼️ GROUP IMAGE';

function findImage(msg) {
  // Image sent with the command as its caption.
  const own = normalizeMessageContent(msg.message);
  if (own?.imageMessage) return { message: msg.message };

  // Image the command is replying to.
  const contextInfo = Object.values(msg.message || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
  const quoted = contextInfo?.quotedMessage && normalizeMessageContent(contextInfo.quotedMessage);
  if (quoted?.imageMessage) {
    return {
      message: quoted,
      key: { remoteJid: contextInfo.remoteJid, id: contextInfo.stanzaId, participant: contextInfo.participant },
    };
  }
  return null;
}

module.exports = {
  name: 'groupimg',
  aliases: [],
  description: 'Set or change the group picture',
  usage: '(send/reply to an image)',
  emoji: '🖼️',
  category: 'admin',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    const guard = await guardAdmin(sock, msg, ctx, TITLE);
    if (!guard) return;

    const found = findImage(msg);
    if (!found) return reply(ui.usage('groupimg', '', 'Send an image with this caption, or reply to an image'));

    try {
      const target = found.key ? { key: { ...found.key, remoteJid: ctx.chatId }, message: found.message } : msg;
      const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: ctx.logger, reuploadRequest: sock.updateMediaMessage });
      await sock.updateProfilePicture(ctx.chatId, buffer);
      return reply(ui.box(TITLE, ['✅ Group picture updated.']));
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'Group image update failed');
      return reply(ui.error("Couldn't update the group picture. Try a different image."));
    }
  },
};
