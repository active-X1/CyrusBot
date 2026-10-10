// commands/encrypt.js
//
//   .encrypt <message>          -> returns an encrypted token
//   (or reply to a message with .encrypt)
//
// No key to type: lib/cipher.js generates and stores one automatically.
const ui = require('../lib/ui');
const cipher = require('../lib/cipher');
const { extractText } = require('../lib/helpers');

module.exports = {
  name: 'encrypt',
  aliases: [],
  description: 'Encrypt a message',
  emoji: '🔒',
  category: 'utility',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    // Text comes from the command itself, or from the message being replied to.
    let text = args.join(' ').trim();
    if (!text) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) text = extractText({ message: quoted });
    }
    if (!text) {
      return reply(ui.usage('encrypt', '<message>', 'Or reply to a message with .encrypt'));
    }

    try {
      const token = cipher.encrypt(text);
      await reply(`${ui.box('🔒 ENCRYPTED', ['✅ Copy the token below', '🔓 Use .decrypt <token>'])}\n\`\`\`${token}\`\`\``);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'Encryption failed');
      await reply(ui.error('Encryption failed. Please try again.'));
    }
  },
};
