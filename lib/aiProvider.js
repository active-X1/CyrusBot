// lib/aiProvider.js
//
// The ONLY file that knows how to talk to an AI provider. Everything
// else in the bot calls askAI(prompt) and gets back either a string
// answer or a thrown AIProviderError - it never needs to know which
// provider or HTTP details are involved.
//
// To switch providers later (OpenAI, Anthropic, local model, etc.):
// rewrite the body of askAI() to call the new API and keep the same
// function signature. Nothing in commands/ needs to change.
//
// Currently wired to Groq (https://console.groq.com) because it has a
// generous free tier and an OpenAI-compatible chat completions API, so
// no extra SDK/dependency is required - just the built-in fetch().

const config = require('../config');
const logger = require('./logger');

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

class AIProviderError extends Error {
  constructor(message, { userMessage, cause } = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.userMessage = userMessage || 'The AI service is unavailable right now. Please try again later.';
    this.cause = cause;
  }
}

/**
 * Ask the configured AI model a question.
 * @param {string} prompt
 * @returns {Promise<string>} the model's reply text
 * @throws {AIProviderError} on any failure (missing key, network, bad response, timeout)
 */
async function askAI(prompt) {
  if (!config.groqApiKey) {
    throw new AIProviderError('GROQ_API_KEY is not configured', {
      userMessage:
        'AI mode is not configured yet. Ask the bot owner to set GROQ_API_KEY in the .env file.',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: config.groqModel,
        messages: [
          {
            role: 'system',
            content:
              'You are CyrusBot, a concise and helpful WhatsApp assistant. Keep answers short and mobile-friendly unless asked for detail.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      logger.error({ status: response.status, body: bodyText.slice(0, 500) }, 'Groq API error response');

      if (response.status === 401) {
        throw new AIProviderError('Invalid Groq API key', {
          userMessage: 'AI mode is misconfigured (invalid API key). Ask the bot owner to check GROQ_API_KEY.',
        });
      }
      if (response.status === 429) {
        throw new AIProviderError('Groq rate limit hit', {
          userMessage: 'The AI service is busy right now (rate limited). Please try again in a moment.',
        });
      }
      throw new AIProviderError(`Groq API returned ${response.status}`, {
        userMessage: 'The AI service returned an error. Please try again later.',
      });
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new AIProviderError('Groq API returned no content', {
        userMessage: 'The AI service returned an empty response. Please try again.',
      });
    }
    return answer;
  } catch (err) {
    if (err instanceof AIProviderError) throw err;
    if (err.name === 'AbortError') {
      throw new AIProviderError('Groq request timed out', {
        userMessage: 'The AI service took too long to respond. Please try again.',
        cause: err,
      });
    }
    logger.error({ err: err.message }, 'Unexpected error calling Groq API');
    throw new AIProviderError('Unexpected error calling AI provider', {
      userMessage: 'Something went wrong reaching the AI service. Please try again later.',
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { askAI, AIProviderError };
