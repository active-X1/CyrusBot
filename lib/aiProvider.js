// lib/aiProvider.js
//
// The ONLY file that knows how to talk to an AI provider. Everything
// else calls askAI(prompt) and gets back a string, or a thrown
// AIProviderError that carries a friendly `.userMessage`.
//
// Currently wired to OpenRouter (https://openrouter.ai): one API key,
// many models, OpenAI-compatible chat completions. No SDK needed - just
// Node's built-in fetch(). To switch providers later, rewrite askAI()
// and keep its signature; nothing else changes.
//
// Model: OPENROUTER_MODEL in .env. Default "openrouter/free" is
// OpenRouter's own router that picks an available free model, so you
// don't have to track free model names (they change often).

const config = require('../config');
const logger = require('./logger');

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000; // free models can be slow at peak times
const IMAGE_TIMEOUT_MS = 90_000; // image generation takes longer than text

class AIProviderError extends Error {
  constructor(message, { userMessage, cause } = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.userMessage = userMessage || 'The AI service is unavailable right now. Please try again later.';
    this.cause = cause;
  }
}

// HTTP header values must be plain ASCII or fetch() throws.
const ascii = (text) => String(text).replace(/[^\x20-\x7E]/g, '').trim();

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.openrouterApiKey}`,
    // Optional attribution headers OpenRouter documents.
    'HTTP-Referer': `https://github.com/${ascii(config.githubUsername) || 'cyrusbot'}`,
  };
  const title = ascii(config.botName);
  if (title) {
    headers['X-Title'] = title;
    headers['X-OpenRouter-Title'] = title;
  }
  return headers;
}

function failFromStatus(status, detail, modelVar = 'OPENROUTER_MODEL') {
  const map = {
    401: 'AI mode is misconfigured (invalid API key). Ask the bot owner to check OPENROUTER_API_KEY.',
    402: 'The AI account is out of credits. Ask the bot owner to top up OpenRouter or use a free model.',
    403: 'The AI request was blocked by the provider. Please try a different message.',
    404: `The configured AI model is not available. Ask the bot owner to check ${modelVar}.`,
    408: 'The AI service took too long to respond. Please try again.',
    429: 'The AI service is busy or rate limited right now. Please try again in a moment.',
  };
  return new AIProviderError(`OpenRouter returned ${status}${detail ? `: ${detail}` : ''}`, {
    userMessage: map[status] || 'The AI service returned an error. Please try again later.',
  });
}

/**
 * Ask the configured AI model a question.
 * @param {string} prompt
 * @returns {Promise<string>}
 * @throws {AIProviderError}
 */
async function askAI(prompt) {
  if (!config.openrouterApiKey) {
    throw new AIProviderError('OPENROUTER_API_KEY is not configured', {
      userMessage: 'AI mode is not configured yet. Ask the bot owner to set OPENROUTER_API_KEY in the .env file.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(),
      body: JSON.stringify({
        model: config.openrouterModel,
        messages: [
          {
            role: 'system',
            content:
              `You are ${config.botName}, a concise and helpful WhatsApp assistant. ` +
              'Keep answers short and mobile-friendly unless asked for detail. Use plain text, no markdown tables.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      logger.error({ status: response.status, body: bodyText.slice(0, 500) }, 'OpenRouter error response');
      throw failFromStatus(response.status);
    }

    const data = await response.json();

    // OpenRouter can return HTTP 200 with an error object inside.
    if (data?.error) {
      const code = Number(data.error.code) || 0;
      logger.error({ error: data.error }, 'OpenRouter returned an error in the body');
      throw failFromStatus(code, data.error.message);
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new AIProviderError('OpenRouter returned no content', {
        userMessage: 'The AI service returned an empty response. Please try again.',
      });
    }
    return answer;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if (err.name === 'AbortError') {
      throw new AIProviderError('OpenRouter request timed out', {
        userMessage: 'The AI service took too long to respond. Please try again.',
        cause: err,
      });
    }
    logger.error({ err: err.message }, 'Unexpected error calling OpenRouter');
    throw new AIProviderError('Unexpected error calling AI provider', {
      userMessage: 'Something went wrong reaching the AI service. Please try again later.',
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate an image from a text prompt with OpenRouter's image model
 * (default: Nano Banana, google/gemini-2.5-flash-image).
 * Image models are called through the same chat-completions endpoint with
 * modalities: ['image', 'text']; the picture comes back as a base64 data URL.
 * @param {string} prompt
 * @returns {Promise<Buffer>} the image bytes
 * @throws {AIProviderError}
 */
async function generateImage(prompt) {
  if (!config.openrouterApiKey) {
    throw new AIProviderError('OPENROUTER_API_KEY is not configured', {
      userMessage: 'Image generation is not configured yet. Ask the bot owner to set OPENROUTER_API_KEY in the .env file.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(),
      body: JSON.stringify({
        model: config.openrouterImageModel,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      logger.error({ status: response.status, body: bodyText.slice(0, 500) }, 'OpenRouter image error response');
      throw failFromStatus(response.status, '', 'OPENROUTER_IMAGE_MODEL');
    }

    const data = await response.json();
    if (data?.error) {
      const code = Number(data.error.code) || 0;
      logger.error({ error: data.error }, 'OpenRouter returned an error in the body (image)');
      throw failFromStatus(code, data.error.message, 'OPENROUTER_IMAGE_MODEL');
    }

    const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const match = typeof url === 'string' && url.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
    if (!match) {
      logger.warn({ finish: data?.choices?.[0]?.finish_reason }, 'OpenRouter returned no image');
      throw new AIProviderError('OpenRouter returned no image', {
        userMessage: "The AI didn't return a picture (the prompt may have been refused). Try rewording it.",
      });
    }
    return Buffer.from(match[1], 'base64');
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if (err.name === 'AbortError') {
      throw new AIProviderError('OpenRouter image request timed out', {
        userMessage: 'Image generation took too long. Please try again.',
        cause: err,
      });
    }
    logger.error({ err: err.message }, 'Unexpected error generating image');
    throw new AIProviderError('Unexpected error generating image', {
      userMessage: 'Something went wrong reaching the AI service. Please try again later.',
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { askAI, generateImage, AIProviderError };
