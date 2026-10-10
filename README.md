# 🤖 CyrusBot

> **A modular, powerful, and developer-friendly WhatsApp bot built with Node.js and Baileys.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/github/license/active-X1/CyrusBot?style=for-the-badge)

---

## 📖 About

**CyrusBot** is a modular WhatsApp bot built with **Node.js** and **Baileys**.

The project is designed with a clean and flexible architecture where every feature can live inside its own command module.

Instead of putting everything into one large file, CyrusBot separates:

- ⚙️ Connection handling
- 🧩 Commands
- 🤖 AI functionality
- 🔐 Encryption
- 🛡️ Permissions
- 💾 Data storage
- 📝 Logging
- 🚦 Rate limiting

This makes CyrusBot easier to **understand, maintain, debug, and extend**.

---

## ✨ Features

- 📱 **QR Code Authentication**
- 🔢 **Pairing Code Authentication**
- 🧩 **Modular Command System**
- ⚡ **Dynamic Command Loading**
- 🏓 **Ping Command**
- 🤖 **AI Chat**
- 🧠 **Automatic AI Mode**
- 🔐 **AES-256-GCM Encryption**
- 🔓 **Secure Decryption**
- 📨 **Custom Auto-Reply**
- 👑 **Owner Permissions**
- 🛡️ **Group Admin Permissions**
- 🚦 **AI Rate Limiting**
- 💾 **Lightweight JSON Database**
- 📝 **Centralized Logging**
- 🔄 **Automatic Reconnection**
- ⚙️ **Environment-Based Configuration**
- 🔒 **Protected Session Storage**

---

## 🧰 Built With

CyrusBot is built using:

| Technology | Purpose |
|---|---|
| **Node.js** | JavaScript runtime |
| **Baileys** | WhatsApp Web API library |
| **JavaScript** | Main programming language |
| **Groq** | AI provider |
| **Pino** | Application logging |
| **dotenv** | Environment configuration |
| **Node.js Crypto** | Encryption and decryption |

---

# 📁 Project Structure

```text
CyrusBot/
│
├── index.js
├── config.js
├── package.json
├── .env.example
├── .gitignore
│
├── commands/
│   ├── ping.js
│   ├── help.js
│   ├── ai.js
│   ├── aimode.js
│   ├── encrypt.js
│   ├── decrypt.js
│   └── setmessage.js
│
├── lib/
│   ├── commandLoader.js
│   ├── logger.js
│   ├── helpers.js
│   ├── aiProvider.js
│   ├── rateLimiter.js
│   └── db.js
│
├── database/
├── sessions/
├── downloads/
├── media/
├── temp/
└── logs/
│   ├── commandLoader.js    # Scans commands/ and builds the trigger → command map
│   ├── logger.js           # Shared pino logger (console + logs/bot.log)
│   ├── helpers.js          # JID/permission helpers, safeSend, extractText
│   ├── aiProvider.js       # The ONLY file that talks to the AI API (OpenRouter)
│   ├── rateLimiter.js      # Per-chat daily AI usage limit
│   └── db.js               # Tiny atomic JSON file storage
├── database/               # Runtime JSON "database" files (gitignored)
├── sessions/                # Baileys auth state (gitignored, NEVER commit)
├── downloads/  media/  temp/  # Scratch folders for future file-handling commands
└── logs/                    # bot.log (gitignored)
```

**Design principle:** `index.js` only knows how to connect to WhatsApp and hand a message to the right
command. It has zero built-in behavior beyond that. Every actual feature — ping, help, AI, encryption —
lives in its own file under `commands/`, so you can read, change, or delete one feature without touching
anything else.

## 2. What changed from the original template ("oxbot-md")

The starting ZIP was inspected in full before anything was written. Key problems found and fixed:

| Problem in the original | What CyrusBot does instead |
|---|---|
| Shipped with hundreds of **real, live session credential files** in `session/` | Ships with an empty `sessions/` folder; `.gitignore` blocks it from ever being committed |
| Hardcoded API keys and a real phone number directly in `config.js`/`settings.js` | All secrets come from `.env` (never committed); `.env.example` has no real values |
| No real command loader — ~100 commands manually `require()`'d into one 1000+ line `main.js` with a giant if/else chain | `lib/commandLoader.js` dynamically scans `commands/*.js`; adding a command needs zero edits elsewhere |
| Auto-followed the original author's WhatsApp newsletter channels and auto-joined his group invite links on every connect | Removed entirely — CyrusBot only does what you tell it to |
| `.ai`/`.gpt`/`.gemini` hit random undocumented third-party scraping endpoints with no key management | `.ai` / `.aimode` use OpenRouter's official API via `OPENROUTER_API_KEY`, isolated in one swappable file |
| Self-modifying hot-reload via `fs.watchFile` re-requiring its own entry file; unbounded **recursive** reconnect | Removed the hot-reload hack; reconnect is an **iterative** loop with exponential backoff, so the call stack never grows and old event listeners aren't leaked |
| ~100 unrelated commands (downloaders, stickers, moderation, games) using deprecated/abandoned packages (`request`, `ytdl-core`) | Only the 7 commands you asked for; zero deprecated packages |
| Extremely convoluted, repeatedly-patched JID/LID string matching duplicated in multiple files | One shared `digitsFromJid()` helper in `lib/helpers.js`, used everywhere |

## 3. What each major file does

- **`index.js`** — Opens the Baileys socket, shows the QR code (or requests a pairing code), listens for
  `messages.upsert`, and for each message: checks the prefix, looks up the command, checks `ownerOnly`,
  calls `command.execute(...)`, and catches any error so one broken command can't crash the bot. Also
  owns the reconnect loop and graceful shutdown (`SIGINT`/`SIGTERM`).
- **`config.js`** — Loads `.env` once and exposes a single `config` object. No other file reads
  `process.env` directly.
- **`lib/commandLoader.js`** — Reads every `.js` file in `commands/`, validates it has `{ name, execute }`,
  and builds a `Map` from both the command name and any aliases to the same module.
- **`lib/helpers.js`** — `isOwner()`, `canManageChat()` (owner OR group admin), `safeSend()` (a
  `sock.sendMessage` wrapper that logs instead of throwing), `extractText()` (pulls plain text out of any
  WhatsApp message type).
- **`lib/aiProvider.js`** — The only file that knows about OpenRouter's HTTP API. Exposes one function,
  `askAI(prompt)`, that returns a string or throws a typed `AIProviderError` with a friendly
  `.userMessage`. To switch to a different AI provider later, rewrite the inside of this file only.
- **`lib/rateLimiter.js`** — Tracks how many AI replies each chat has used today in
  `database/ai-usage.json` and resets automatically when the date rolls over.
- **`lib/db.js`** — A few lines of `fs.readFileSync`/`writeFileSync` with atomic (write-then-rename)
  writes. This is intentionally simple — fine for flags/counters, not meant to replace a real database if
  your bot grows a lot of state.
- **`lib/logger.js`** — One shared [pino](https://getpino.io) logger, writing to both the console and
  `logs/bot.log`.

## 4. Command structure

Every file in `commands/` exports an object shaped like this:

```js
module.exports = {
  name: 'ping',              // required: lowercase, no prefix
  aliases: [],               // optional: extra trigger words
  description: '...',        // shown in .help
  category: 'general',       // grouping used by .help
  ownerOnly: false,          // if true, index.js blocks non-owners automatically
  async execute(sock, msg, args, ctx) {
    // sock: the live Baileys socket
    // msg: the raw Baileys message object
    // args: the command text split on whitespace, prefix and command name removed
    // ctx: { chatId, senderJid, isGroup, isOwner, config, logger, commands,
    //        safeSend, canManageChat }
  },
};
```

### Adding a new command

1. Create `commands/mycommand.js` following the shape above.
2. That's it — `lib/commandLoader.js` picks it up automatically the next time the bot starts. No edits
   to `index.js` or anywhere else are needed.

## 5. Authentication

CyrusBot stores your WhatsApp login as files in `sessions/` (never commit or share this folder).

**Whenever a login is needed** (first run, or no saved login), and you run the bot in a terminal, it always asks:

```
[1] 📱 Pair with Phone Number
[2] 🖼️  Pair with QR Code
```

- **1** - type your WhatsApp number with country code (digits only, no `+` or leading `0`). An 8-character
  pairing code is printed: WhatsApp -> Linked Devices -> Link a Device -> *Link with phone number instead*.
  No QR code is shown.
- **2** - a QR code is printed: WhatsApp -> Linked Devices -> Link a Device -> scan it.
- Invalid answers are re-asked. A saved, completed login skips the question.
- If WhatsApp logs the device out, the dead session is cleared and you are asked again (the bot doesn't just stop).

**Where there is no keyboard (Render, most hosts)** the bot can't ask, so it uses `AUTH_METHOD` from the
environment (`pairing-code` or `qr`); if that isn't set but `PAIRING_NUMBER` is, it uses phone pairing.
Read the pairing code from the service logs.

## 6. How AI mode works

- **`.ai <question>`** — a one-off question, answered immediately, subject to the daily limit.
- **`.aimode on` / `.aimode off`** — toggles *automatic* AI replies for the current chat: every message
  that isn't a command gets sent to the AI and the answer sent back, still subject to the same daily
  limit. Only the bot owner or (in a group) a group admin can toggle this, so members can't spam-enable
  it.
- The daily limit is per chat (per JID), defaults to **10 replies/day**, configurable via `AI_DAILY_LIMIT`
  in `.env`. It resets automatically at midnight local time — no cron job needed, the check just compares
  today's date to the last stored date.
- The AI provider is [OpenRouter](https://openrouter.ai). Create an API key at <https://openrouter.ai/keys> and put
  it in `OPENROUTER_API_KEY`. The default model `openrouter/free` lets OpenRouter pick an available free model
  (set `OPENROUTER_MODEL` to pin a specific one). If the key is missing, invalid, out of credits, the request times out, or OpenRouter is unavailable, the
  bot replies with a clear error message instead of crashing — see `lib/aiProvider.js` for the exact
  error handling.
- To switch to a different AI provider later, you only need to edit `lib/aiProvider.js` — nothing else in
  the codebase needs to change.

## 7. Encryption commands

`.encrypt <message>` returns an encrypted token and `.decrypt <token>` turns it back into the message.
You can also reply to a message with either command. You never type or manage a key: the bot generates its
own random 256-bit key the first time it's needed and stores it in `database/cipher-key.json` (gitignored).

- Built on Node's **built-in** `crypto`: AES-256-GCM, a fresh random IV per message, and an authentication
  tag so a damaged or foreign token is rejected instead of returning garbage. See `lib/cipher.js`.
- The key belongs to the bot, so anyone who can run `.decrypt` on your bot can decrypt its tokens. If you
  want only yourself to decrypt, set `ownerOnly: true` in `commands/decrypt.js`.
- If your host wipes the disk on redeploy, set `CIPHER_KEY` in `.env` to pin the key, or old tokens become
  undecryptable.

## 8. `.setmessage` - your auto-reply

Owner only. Sets a message the bot sends automatically on your behalf.

- `.setmessage <text>` sets it, `.setmessage on` / `.setmessage off` switches it, `.setmessage clear`
  deletes it, `.setmessage` alone shows the status.
- **DMs:** replies once per day per chat (unless AI mode is on for that chat).
- **Groups:** does nothing, *except* when your account is @mentioned or someone replies to one of your
  messages (once per day per person per group).
- It never replies to your own messages.

## 9. Configuration

Everything is controlled by `.env` (copy `.env.example` to `.env` and fill it in):

| Variable | Meaning |
|---|---|
| `BOT_NAME`, `BOT_AUTHOR`, `GITHUB_USERNAME` | Branding, shown in `.help` |
| `PREFIX` | Command prefix, default `.` |
| `OWNER_NUMBER` | Your WhatsApp number, digits only |
| `SUDO_NUMBERS` | Comma-separated extra numbers with owner privileges |
| `AUTH_METHOD` | `qr` or `pairing-code` |
| `PAIRING_NUMBER` | Number to request a pairing code for (if using pairing-code) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | AI provider key / model (default `openrouter/free`) |
| `AI_DAILY_LIMIT` | Replies per chat per day (default 10) |
| `CIPHER_KEY` | Optional: pin the `.encrypt`/`.decrypt` key (otherwise auto-generated) |
| `LOG_LEVEL` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |

## 10. Running the bot

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
# edit .env: set OWNER_NUMBER, OPENROUTER_API_KEY, etc.

# 3. Start
npm start
```

Requires **Node.js 18+** (uses the built-in global `fetch`); Node 20 LTS or newer is recommended.

On first run you'll be shown a QR code (or pairing code) — link it from WhatsApp, and CyrusBot will
reconnect automatically on future restarts using the saved session.

## 11. Troubleshooting

- **Nothing happens when I send a command** — check the console/`logs/bot.log` for `Commands loaded`
  with the expected count. If a command file has a syntax error it's skipped with a warning, not a crash.
- **"Command execution failed" reply** — check `logs/bot.log` for the actual stack trace; the chat only
  ever gets a generic message so internal details never leak into WhatsApp.
- **Bot keeps showing a new QR code every restart** — `sessions/` isn't being written/read. Confirm the
  process has write permission to the project folder and that you didn't add `sessions/` to a read-only
  mount.
- **"Session logged out" and it stops reconnecting** — this is expected after you unlink the device from
  WhatsApp's Linked Devices screen. Delete `sessions/` and restart to re-authenticate.
- **AI commands say "not configured"** — `OPENROUTER_API_KEY` is empty in `.env`. Create a key at
  <https://openrouter.ai/keys>.
- **AI commands say "invalid API key" (401)** — double check the key was copied correctly and hasn't been
  revoked.
- **"busy / rate limited" (429)** — free OpenRouter models have their own, lower request limits (unrelated to
  `AI_DAILY_LIMIT`); wait a bit, or check your OpenRouter account's limits.
- **"out of credits" (402) or "model not available" (404)** — check your OpenRouter balance, or set
  `OPENROUTER_MODEL` to a model that exists (free model names change; `openrouter/free` avoids this).
- **Group admin checks not working / owner not recognized in a group** — this is usually WhatsApp's
  ongoing "LID" identifier migration. `lib/helpers.js` compares plain digits from either JID format;
  if you still see mismatches, log `msg.key.participant` for a message from the affected account and
  compare it against `OWNER_NUMBER`.

## 12. Security notes

- No API keys, passwords, or session data are hardcoded anywhere in this repository.
- `.gitignore` excludes `.env`, `sessions/`, `database/*.json`, `logs/`, and generated files in
  `downloads/`/`media/`/`temp/`.
- Every command execution and the AI-mode auto-reply path are wrapped in `try/catch`; a failing command,
  a network error, or a malformed message logs the error and replies with a generic message instead of
  crashing the process.
- `uncaughtException`/`unhandledRejection` handlers log instead of exiting, so one stray unexpected error
  doesn't take the whole bot down — though if you see either logged repeatedly, treat it as a bug to fix,
  not something to permanently ignore.
