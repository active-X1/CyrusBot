// lib/ui.js
// One place for the bot's visual style, so every command looks alike.
//   box('🏓 PONG!', ['⚡ Response : 42ms'])  -> a boxed card
//   notice('⚠️', 'ERROR', 'Something broke') -> a small boxed message
//   usage('ai', '<question>', 'Ask the AI')   -> a boxed "how to use"
//   box(title, lines, { compact: true })     -> no blank spacer lines
//   box(title, lines, { open: true })        -> no right corner / bottom line
//
// BOTTOM LINE LENGTH: the title row contains letters and emoji, which are
// narrower/wider than the box character "━", so just counting characters
// makes the bottom line too long. visualWidth() estimates the real width
// of the title row (in "━" units) and the bottom line is built to match.
// If it still looks off on your phone, tune the numbers in WIDTH below.

const config = require('../config');

const PIPE = '┃';

// Estimated widths, in units where one "━" = 1.
const WIDTH = {
  upper: 0.65,
  other: 0.55, // lowercase, digits
  space: 0.3,
  punct: 0.35,
  emoji: 1.2,
  wide: 1.0, // 〔 〕 and other CJK punctuation
  box: 1.0, // ╭ ╮ ╰ ╯ ━ ┃
};

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0xfe0f || cp === 0x200d) return 0; // emoji variation selector / joiner
  if (cp >= 0x2500 && cp <= 0x257f) return WIDTH.box;
  if (cp >= 0x3000 && cp <= 0x303f) return WIDTH.wide;
  if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2300 && cp <= 0x23ff)) return WIDTH.emoji;
  if (ch === ' ') return WIDTH.space;
  if (/[A-Z]/.test(ch)) return WIDTH.upper;
  if (/[a-z0-9]/.test(ch)) return WIDTH.other;
  return WIDTH.punct;
}

function visualWidth(text) {
  let total = 0;
  for (const ch of String(text)) total += charWidth(ch);
  return total;
}

function topLine(title, { open = false } = {}) {
  return `╭━━━〔 ${title} 〕━━━${open ? '' : '╮'}`;
}

function bottomLine(title) {
  // Match the closed top line: corners count as 1 each.
  const count = Math.max(4, Math.round(visualWidth(topLine(title)) - 2));
  return '╰' + '━'.repeat(count) + '╯';
}

function box(title, lines = [], { compact = false, open = false } = {}) {
  const body = [];
  for (const line of lines) {
    // A multi-line string becomes several boxed lines.
    for (const part of String(line).split('\n')) {
      if (part) body.push(`${PIPE} ${part}`);
      else if (!compact) body.push(PIPE);
    }
  }
  const out = [topLine(title, { open })];
  if (!compact) out.push(PIPE);
  out.push(...body);
  if (!compact) out.push(PIPE);
  if (!open) out.push(bottomLine(title));
  return out.join('\n');
}

function notice(icon, title, message) {
  return box(`${icon} ${title}`, [message]);
}

const error = (message) => notice('⚠️', 'OOPS', message);
const denied = (message) => notice('🚫', 'DENIED', message);
const success = (message) => notice('✅', 'DONE', message);

function usage(command, argsText, description) {
  const p = config.prefix;
  return box('📖 USAGE', [
    `${p}${command}${argsText ? ' ' + argsText : ''}`,
    description ? `ℹ️ ${description}` : '',
  ].filter(Boolean));
}

module.exports = { box, notice, error, denied, success, usage, visualWidth };
