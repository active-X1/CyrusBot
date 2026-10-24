// commands/owner.js
// Sends the owner's WhatsApp contact card (tap to message or call), then a
// short message. The number is OWNER_NUMBER from .env; if that isn't set,
// the WhatsApp account the bot is linked to is used.
const config = require('../config');
const ui = require('../lib/ui');
const { digitsFromJid } = require('../lib/helpers');

function buildVCard(name, digits) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:;${name};;;`,
    `FN:${name}`,
    `ORG:${config.botName};`,
    `TEL;type=CELL;type=VOICE;waid=${digits}:+${digits}`,
    'END:VCARD',
  ].join('\n');
}

module.exports = {
  name: 'owner',
  aliases: ['creator'],
  description: 'Contact the bot owner',
  emoji: '👑',
  category: 'general',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const digits = config.ownerNumber || digitsFromJid(sock.user?.id);
    if (!digits) {
      return ctx.safeSend(sock, ctx.chatId, { text: ui.error('Owner contact is not available right now.') }, { quoted: msg });
    }

    const name = config.ownerName || sock.user?.name || sock.user?.verifiedName || config.botAuthor || 'Owner';

    const card = await ctx.safeSend(
      sock,
      ctx.chatId,
      { contacts: { displayName: name, contacts: [{ vcard: buildVCard(name, digits) }] } },
      { quoted: msg }
    );

    const text = ui.box('👑 MEET THE OWNER', [
      `✨ ${name} built and runs *${config.botName}*.`,
      '',
      '📲 Tap the card above to message or call.',
      '💬 Questions, ideas or want your own bot, website, software, etc.. Say hi!',
      '',
      '🚀 Powered by passion and good code.',
    ]);
    await ctx.safeSend(sock, ctx.chatId, { text }, { quoted: card || msg });
  },
};
