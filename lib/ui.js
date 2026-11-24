// Cypher-style WhatsApp blocks used by every command:
//   ┏▣ ◈ *TITLE* ◈
//   ┃ ⚡ *ꜱᴘᴇᴇᴅ* : 120ms
//   ┃ plain line
//   ┗▣
// Short corner marks and one bar per row, no long rules and no manual
// wrapping, so nothing breaks on a small phone screen.
const config = require('./../config');

function wrapLine(value) { return [String(value)]; } // kept for old callers; WhatsApp wraps

const SMALL = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
const small = (t) => String(t).toLowerCase().replace(/[a-z]/g, (c) => SMALL[c]);

const clean = (v) => String(v ?? '').replace(/\r/g, '');
const EMOJI = '(\\p{Extended_Pictographic}[\\uFE0F\\u200D\\p{Extended_Pictographic}]*\\s+)?';
const KV = new RegExp(`^${EMOJI}([A-Za-z][A-Za-z ]{1,13}?)\\s*:\\s+(.+)$`, 'u');

// "⚡ Speed : 120ms" -> "⚡ *ꜱᴘᴇᴇᴅ* : 120ms"; other lines stay as they are.
function row(line) {
  const m = KV.exec(line);
  return m ? `${m[1] || ''}*${small(m[2].trim())}* : ${m[3]}` : line;
}

function rows(lines) {
  const out = [];
  for (const line of lines) {
    for (const part of clean(line).split('\n')) out.push(part.trim() ? `┃ ${row(part)}` : '┃');
  }
  while (out.length && out[out.length - 1] === '┃') out.pop();
  return out;
}

function box(heading, lines = []) {
  return [`┏▣ ◈ *${clean(heading)}* ◈`, ...rows(lines), '┗▣'].join('\n');
}

// Titled command-style list: │➽ item
function section(heading, lines = []) {
  const items = [];
  for (const line of lines) for (const part of clean(line).split('\n')) if (part.trim()) items.push(`│➽ ${part}`);
  return [`┏▣ ◈ *${clean(heading)}* ◈`, ...items, '┗▣'].join('\n');
}

function card(heading, lines = []) { return box(heading, lines); }

function notice(icon, heading, message) { return box(`${icon} ${heading}`, [message]); }
const error = (message) => notice('⚠️', 'OOPS', message);
const denied = (message) => notice('🚫', 'DENIED', message);
const success = (message) => notice('✅', 'DONE', message);

function usage(command, argsText, description) {
  const p = config.prefix;
  return box('📖 USAGE', [`➽ ${p}${command}${argsText ? ' ' + argsText : ''}`, description ? `ℹ️ ${description}` : ''].filter(Boolean));
}

module.exports = { box, section, card, wrapLine, notice, error, denied, success, usage, small };
