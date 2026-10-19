// commands/translate.js
//   .translate french Good morning      -> translates the text
//   .translate french   (reply to a message) -> translates the replied message
// Uses the AI and counts toward the chat's daily AI limit (same as .ai).
const ui = require('../lib/ui');
const { askAI, AIProviderError } = require('../lib/aiProvider');
const rateLimiter = require('../lib/rateLimiter');
const { messageText } = require('../lib/antilink');

module.exports = {
  name: 'translate',
  aliases: ['tr'],
  description: 'Translate text into another language',
  usage: '<language> <text>',
  emoji: '🌐',
  category: 'ai',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (text) => ctx.safeSend(sock, ctx.chatId, { text }, { quoted: msg });

    const language = (args[0] || '').trim();
    const info = Object.values(msg.message || {}).find((v) => v && typeof v === 'object' && v.contextInfo)?.contextInfo;
    const quoted = info?.quotedMessage ? messageText(info.quotedMessage).trim() : '';
    const text = args.slice(1).join(' ').trim() || quoted;

    if (!language || !text) {
      return reply(ui.usage('translate', '<language> <text>', 'Or reply to a message: .translate <language>'));
    }

    const limit = rateLimiter.checkLimit(ctx.chatId);
    if (!limit.allowed) {
      return reply(ui.notice('⏳', 'LIMIT REACHED', `Daily AI limit hit (${limit.limit}/day for this chat).\nTry again tomorrow 🌙`));
    }

    try {
      sock.sendPresenceUpdate('composing', ctx.chatId).catch(() => {});
      const result = await askAI(`Translate this text into ${language}:\n\n${text.slice(0, 2000)}`, {
        system:
          'You are a translator. Translate the user text into the requested language. ' +
          'Reply with ONLY the translation: no quotes, no notes, no explanations. ' +
          'If the requested language is not a real language, reply exactly: UNKNOWN_LANGUAGE',
        maxTokens: 700,
      });
      if (result.trim() === 'UNKNOWN_LANGUAGE') {
        return reply(ui.error(`I don't know a language called "${language}".`));
      }
      rateLimiter.recordUsage(ctx.chatId);
      const label = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
      return reply(`🌐 *${label}*\n\n${result}`);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'translate failed');
      return reply(ui.error(err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.'));
    }
  },
};
