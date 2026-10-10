// commands/imagine.js
//   .imagine <description>   -> generates a picture with Nano Banana
//                               (OpenRouter: google/gemini-2.5-flash-image)
// Counted separately from .ai, with its own daily limit per chat
// (IMAGINE_DAILY_LIMIT, default 5) because every image costs credits.
const config = require('../config');
const ui = require('../lib/ui');
const rateLimiter = require('../lib/rateLimiter');
const { generateImage, AIProviderError } = require('../lib/aiProvider');

const LIMIT_STORE = 'imagine-usage';
const MAX_PROMPT_CHARS = 800;

module.exports = {
  name: 'imagine',
  aliases: [],
  description: 'Generate an image from text',
  usage: '<description>',
  emoji: '🎨',
  category: 'ai',
  ownerOnly: false,
  async execute(sock, msg, args, ctx) {
    const reply = (content) => ctx.safeSend(sock, ctx.chatId, content, { quoted: msg });

    const prompt = args.join(' ').trim();
    if (!prompt) return reply({ text: ui.usage('imagine', '<description>', 'e.g. a cat astronaut on the moon') });
    if (prompt.length > MAX_PROMPT_CHARS) {
      return reply({ text: ui.error(`Keep the description under ${MAX_PROMPT_CHARS} characters.`) });
    }

    const opts = { store: LIMIT_STORE, limit: config.imagineDailyLimit };
    const limit = rateLimiter.checkLimit(ctx.chatId, opts);
    if (!limit.allowed) {
      return reply({ text: ui.notice('⏳', 'LIMIT REACHED', `Daily image limit hit (${limit.limit}/day for this chat).\nTry again tomorrow 🌙`) });
    }

    try {
      await reply({ text: '🎨 Creating your image...' });
      await sock.sendPresenceUpdate('composing', ctx.chatId).catch(() => {});

      const image = await generateImage(prompt);
      rateLimiter.recordUsage(ctx.chatId, opts);

      const remaining = limit.remaining - 1;
      const caption = ui.box('🎨 IMAGINE', [
        `📝 ${prompt}`,
        `📊 ${remaining} ${remaining === 1 ? 'image' : 'images'} left today`,
      ]);
      const sent = await reply({ image, caption });
      if (!sent) await reply({ text: ui.error("The image was created but couldn't be sent. Please try again.") });
    } catch (err) {
      const message = err instanceof AIProviderError ? err.userMessage : 'Something went wrong. Please try again later.';
      ctx.logger.error({ err: err.message }, 'Imagine command failed');
      await reply({ text: ui.error(message) });
    }
  },
};
