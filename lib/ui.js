// Compact WhatsApp formatting with predictable line lengths.
const config = require('./../config');
const DEFAULT_WIDTH = 34;
const RULE = '─'.repeat(25);
function textWidth(value) { return Array.from(String(value)).length; }
function wrapLine(value, width = DEFAULT_WIDTH) {
  const source = String(value);
  if (!source || textWidth(source) <= width) return [source];
  const words = source.split(/\s+/); const result = []; let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (textWidth(`${current} ${word}`) <= width) current += ` ${word}`;
    else { result.push(current); current = word; }
  }
  if (current) result.push(current);
  return result;
}
function bodyLines(lines, bullet = '│ ', width = DEFAULT_WIDTH) {
  const out = [];
  for (const line of lines) for (const part of String(line).split('\n')) {
    if (!part) { out.push(bullet.trimEnd()); continue; }
    for (const segment of wrapLine(part, Math.max(12, width - textWidth(bullet)))) out.push(`${bullet}${segment}`);
  }
  return out;
}
function box(title, lines = []) { return [`┌${RULE}`, `│ ${title}`, `├${RULE}`, ...bodyLines(lines), `└${RULE}`].join('\n'); }
function section(title, lines = [], { bullet = '│  • ', width = DEFAULT_WIDTH } = {}) {
  return [`┌${RULE}`, `│ ${title}`, `└${RULE}`, ...bodyLines(lines, bullet, width)].join('\n');
}
function card(title, lines = []) {
  const body = [];
  for (const line of lines) {
    if (!String(line)) { body.push('│'); continue; }
    for (const part of String(line).split('\n')) {
      if (!part) body.push('│');
      else for (const segment of wrapLine(part, DEFAULT_WIDTH - 3)) body.push(`│  ${segment}`);
    }
  }
  return [`╭${'━'.repeat(25)}╮`, `│ ${title}`, `├${'─'.repeat(25)}┤`, ...body, `╰${'━'.repeat(25)}╯`].join('\n');
}
function notice(icon, title, message) { return box(`${icon} ${title}`, [message]); }
const error = (message) => notice('⚠️', 'OOPS', message);
const denied = (message) => notice('🚫', 'DENIED', message);
const success = (message) => notice('✅', 'DONE', message);
function usage(command, argsText, description) {
  const p = config.prefix;
  return box('📖 USAGE', [`${p}${command}${argsText ? ' ' + argsText : ''}`, description ? `ℹ️ ${description}` : ''].filter(Boolean));
}
module.exports = { box, section, card, wrapLine, notice, error, denied, success, usage };
