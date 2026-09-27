// commands/ai.js
const config = require('../config');
const { askAI, AIProviderError } = require('../lib/aiProvider');
const rateLimiter = require('../lib/rateLimiter');

module.exports = {
  name: 'ai',
  aliases: [],
  description: 'Ask the AI a one-off question: ".ai <question>". Subject to the daily limit.',
  category: 'ai',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const question = args.join(' ').trim();
    if (!question) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `Usage: ${config.prefix}ai <your question>` },
        { quoted: msg }
      );
    }

    const limit = rateLimiter.checkLimit(ctx.chatId);
    if (!limit.allowed) {
      return ctx.safeSend(
        sock,
        ctx.chatId,
        { text: `⏳ Daily AI limit reached (${limit.limit}/day for this chat). Try again tomorrow.` },
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
        { text: `${answer}\n\n_${remaining} AI ${remaining === 1 ? 'reply' : 'replies'} left today._` },
        { quoted: msg }
      );
    } catch (err) {
      const message = err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.';
      ctx.logger.error({ err: err.message }, 'AI command failed');
      await ctx.safeSend(sock, ctx.chatId, { text: `❌ ${message}` }, { quoted: msg });
    }
  },
};
