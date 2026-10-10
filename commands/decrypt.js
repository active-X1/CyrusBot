// commands/decrypt.js
//
//   .decrypt <token>            -> shows the original message
//   (or reply to a token message with .decrypt)
//
// Works on tokens made by THIS bot's .encrypt (same auto-generated key).
// Wrong/damaged/foreign tokens all give the same friendly error - GCM's
// auth check failing is the normal way a bad token shows up.
const ui = require('../lib/ui');
const cipher = require('../lib/cipher');
const { extractText } = require('../lib/helpers');

module.exports = {
  name: 'decrypt',
  aliases: [],
  description: 'Decrypt a message',
  emoji: '🔓',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    let raw = args.join(' ');
    if (!raw.trim()) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) raw = extractText({ message: quoted });
    }
    // Remove ``` fences, quotes and any whitespace/line-breaks from copying.
    const token = raw.replace(/```/g, '').replace(/[\s"'`]/g, '');
    if (!token) {
      return reply(ui.usage('decrypt', '<token>', 'Or reply to a token message with .decrypt'));
    }

    try {
      const plaintext = cipher.decrypt(token);
      await reply(ui.box('🔓 DECRYPTED', [plaintext]));
    } catch (err) {
      ctx.logger.warn({ err: err.message }, 'Decryption failed');
      await reply(ui.error('Could not decrypt that.\nIt is invalid, damaged, or was not made by this bot.'));
    }
  },
};
