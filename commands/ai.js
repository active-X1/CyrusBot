// commands/ai.js
const config = require('../config');
const { askAI, AIProviderError } = require('../lib/aiProvider');
const rateLimiter = require('../lib/rateLimiter');

const ui = require('../lib/ui');

module.exports = {
  name: 'ai',
  aliases: [],
  description: 'Ask the AI a question',
  usage: '<question>',
  emoji: '🧠',
  category: 'ai',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const question = args.join(' ').trim();
    if (!question) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: ui.usage('ai', '<your question>', 'Ask the AI anything') },
        { quoted: msg }
      );
    }

    const limit = rateLimiter.checkLimit(ctx.chatId);
    if (!limit.allowed) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: ui.notice('⏳', 'LIMIT REACHED', `Daily AI limit hit (${limit.limit}/day for this chat).\nTry again tomorrow 🌙`) },
        { quoted: msg }
      );
    }

    try {
      await sock.sendPresenceUpdate('composing', ctx.chatId).catch(() => {});
      const answer = await askAI(question);
      rateLimiter.recordUsage(ctx.chatId);
      const remaining = limit.remaining - 1;
      await ctx.safeSend(
        sock,
        ctx.chatId,
        { text: ui.box('🧠 AI', [answer, '', `📊 ${remaining} ${remaining === 1 ? 'reply' : 'replies'} left today`]) },
        { quoted: msg }
      );
    } catch (err) {
      const message = err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.';
      ctx.logger.error({ err: err.message }, 'AI command failed');
      await ctx.safeSend(sock, ctx.chatId, { text: ui.error(message) }, { quoted: msg });
    }
  },
};
