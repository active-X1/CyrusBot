// commands/view.js
//
// Reply to a view-once message with ".view" (or ".v" / "!view" / "!v")
// and the bot downloads the media and re-sends it as a normal message
// in the same chat.
//
// Owner-only on purpose: view-once exists to protect the sender's
// privacy, and this command defeats it. Restricting it to the bot's
// owner stops group members from using your bot to save other people's
// view-once media.
//
// How it works:
//   1. A reply carries the original message in
//      msg.message.extendedTextMessage.contextInfo.quotedMessage.
//   2. normalizeMessageContent() strips the viewOnce wrappers
//      (viewOnceMessage / V2 / V2Extension) so we see the plain
//      image/video/audio message inside.
//   3. downloadMediaMessage() downloads + decrypts it into a Buffer.
//   4. We send the Buffer back as an ordinary (not view-once) message.

const {
  downloadMediaMessage,
  normalizeMessageContent,
  getContentType,
} = require('@whiskeysockets/baileys');

const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage'];

const ui = require('../lib/ui');

module.exports = {
  name: 'view',
  aliases: ['v'],
  description: 'Save a view-once media (reply)',
  emoji: '👁️',
  category: 'utility',
  ownerOnly: true,
  async execute(sock, msg, args, ctx) {
    const send = (content) => ctx.safeSend(sock, ctx.chatId, content, { quoted: msg });

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    if (!quoted) {
      return send({ text: ui.usage('view', '', 'Reply to a view-once message') });
    }

    // Unwrap view-once / ephemeral wrappers to get the real media message.
    const content = normalizeMessageContent(quoted);
    const type = content && getContentType(content);
    if (!type || !MEDIA_TYPES.includes(type)) {
      return send({ text: ui.error('That message has no image, video or voice note to save.') });
    }
    const media = content[type];

    try {
      // downloadMediaMessage wants a message-shaped object. We rebuild
      // one from the quoted data (key.id = the quoted message's id).
      const fakeMsg = {
        key: {
          remoteJid: ctx.chatId,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant,
        },
        message: content,
      };
      const buffer = await downloadMediaMessage(
        fakeMsg,
        'buffer',
        {},
        { logger: ctx.logger, reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer?.length) throw new Error('Downloaded media was empty');

      const caption = media.caption || undefined;
      if (type === 'imageMessage') {
        await send({ image: buffer, caption: ui.box('👁️ VIEW ONCE', ['🖼️ Image saved']) + (caption ? `\n${caption}` : '') });
      } else if (type === 'videoMessage') {
        await send({ video: buffer, caption, mimetype: media.mimetype || 'video/mp4' });
      } else {
        await send({
          audio: buffer,
          mimetype: media.mimetype || 'audio/ogg; codecs=opus',
          ptt: Boolean(media.ptt),
        });
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'view command failed to download media');
      await send({
        text: ui.error('Couldn\'t download that media.\nIt may have expired or already been opened on the original device.'),
      });
    }
  },
};
