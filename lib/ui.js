// lib/ui.js
// One place for the bot's visual style, so every reply looks alike.
//
//   box('🧠 AI MODE', ['🟢 Enabled for this chat'])   <- every normal reply
//
//   ┏━━━━━━━━━━━━━━━━━━━
//   ┃ 🧠 AI MODE
//   │
//   │ 🟢 Enabled for this chat
//   ┗━━━━━━━━━━━━━━━━━━━
//
//   section(title, lines, { bullet })  <- menu blocks: title block, then
//                                         "│ ➜" lines, no closing line
//   card(title, lines)                 <- the closed ╭━━〔 〕━━╮ menu header

const config = require('./../config');

const RULE = '━'.repeat(19);
const BULLET = '│ ';

function bodyLines(lines, bullet) {
  const out = [];
  for (const line of lines) {
    // A multi-line string becomes several prefixed lines.
    for (const part of String(line).split('\n')) {
      out.push(part ? `${bullet}${part}` : bullet.trimEnd());
    }
  }
  return out;
}

function box(title, lines = []) {
  return [`┏${RULE}`, `┃ ${title}`, '│', ...bodyLines(lines, BULLET), `┗${RULE}`].join('\n');
}

function section(title, lines = [], { bullet = BULLET } = {}) {
  return [`┏${RULE}`, `┃ ${title}`, `┗${RULE}`, ...bodyLines(lines, bullet)].join('\n');
}

// ---- card(): the closed "╭━━━〔 TITLE 〕━━━╮ ... ╰━━━╯" style ----------
// Used only for the menu header. The bottom line is sized from an estimate
// of the title row's real width (letters/emoji are not as wide as "━");
// tune WIDTH if it looks off on your phone.
const WIDTH = { upper: 0.65, other: 0.55, space: 0.3, punct: 0.35, emoji: 1.2, wide: 1.0, box: 1.0 };

function charWidth(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0xfe0f || cp === 0x200d) return 0;
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

function card(title, lines = []) {
  const top = `╭━━━〔 ${title} 〕━━━╮`;
  const bottom = '╰' + '━'.repeat(Math.max(4, Math.round(visualWidth(top) - 2))) + '╯';
  const body = [];
  for (const line of lines) {
    for (const part of String(line).split('\n')) body.push(part ? `┃ ${part}` : '┃');
  }
  return [top, ...body, bottom].join('\n');
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

module.exports = { box, section, card, visualWidth, notice, error, denied, success, usage };
