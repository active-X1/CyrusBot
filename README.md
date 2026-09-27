# CyrusBot

A modular WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys), by **Active X** ([github.com/active-X1](https://github.com/active-X1)).

CyrusBot was rebuilt from the ground up using an existing bot template ("oxbot-md") only as a technical
starting point. All commands, configuration, branding, and most of the internal architecture are new.

---

## ⚠️ If you got this project from a ZIP that included session data — stop

This clean rebuild ships with **no session data at all**. If you are migrating from an older bot folder
that has a `session/` directory full of `.json` files (`creds.json`, `app-state-sync-*.json`, etc.), those
files are your **live WhatsApp login credentials**. Never upload, share, or commit that folder — anyone
with those files can act as your WhatsApp account. If you're unsure whether an old copy leaked, open
WhatsApp on your phone → **Settings → Linked Devices** and remove any device you don't recognize.

---

## 1. Architecture overview

```
CyrusBot/
├── index.js              # Connection lifecycle + message dispatch (the "glue")
├── config.js              # Reads .env, exposes one config object
├── package.json
├── .env.example            # Copy to .env and fill in
├── .gitignore
├── commands/               # One file per command (see "Command structure" below)
│   ├── ping.js
│   ├── help.js
│   ├── ai.js
│   ├── aimode.js
│   ├── encrypt.js
│   ├── decrypt.js
│   └── setmessage.js
├── lib/
│   ├── commandLoader.js    # Scans commands/ and builds the trigger → command map
│   ├── logger.js           # Shared pino logger (console + logs/bot.log)
│   ├── helpers.js          # JID/permission helpers, safeSend, extractText
│   ├── aiProvider.js       # The ONLY file that talks to the AI API (Groq)
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
| `.ai`/`.gpt`/`.gemini` hit random undocumented third-party scraping endpoints with no key management | `.ai` / `.aimode` use Groq's official API via `GROQ_API_KEY`, isolated in one swappable file |
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
- **`lib/aiProvider.js`** — The only file that knows about Groq's HTTP API. Exposes one function,
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

CyrusBot uses Baileys' `useMultiFileAuthState`, which stores your WhatsApp session as a set of JSON files
under `sessions/`. Two ways to log in, set via `.env`:

- **`AUTH_METHOD=qr`** (default) — a QR code is printed in the terminal. Open WhatsApp → **Linked
  Devices** → **Link a Device** → scan it.
- **`AUTH_METHOD=pairing-code`** — instead of a QR code, an 8-character pairing code is printed. Set
  `PAIRING_NUMBER` to your WhatsApp number (digits only, no `+`). Enter the code in WhatsApp → **Linked
  Devices** → **Link a Device** → **Link with phone number instead**.

Once logged in, `sessions/` lets the bot reconnect without re-scanning. **Never commit or share this
folder.** If WhatsApp logs the session out remotely (e.g. you unlinked the device from your phone),
CyrusBot will log a warning and stop trying to reconnect — delete `sessions/` and restart to re-link.

## 6. How AI mode works

- **`.ai <question>`** — a one-off question, answered immediately, subject to the daily limit.
- **`.aimode on` / `.aimode off`** — toggles *automatic* AI replies for the current chat: every message
  that isn't a command gets sent to the AI and the answer sent back, still subject to the same daily
  limit. Only the bot owner or (in a group) a group admin can toggle this, so members can't spam-enable
  it.
- The daily limit is per chat (per JID), defaults to **10 replies/day**, configurable via `AI_DAILY_LIMIT`
  in `.env`. It resets automatically at midnight local time — no cron job needed, the check just compares
  today's date to the last stored date.
- The AI provider is [Groq](https://console.groq.com) (free tier available). Get an API key there and put
  it in `GROQ_API_KEY`. If the key is missing, invalid, the request times out, or Groq is unavailable, the
  bot replies with a clear error message instead of crashing — see `lib/aiProvider.js` for the exact
  error handling.
- To switch to a different AI provider later, you only need to edit `lib/aiProvider.js` — nothing else in
  the codebase needs to change.

## 7. Encryption commands

`.encrypt` and `.decrypt` use Node's **built-in** `crypto` module — no external encryption service, no
extra dependency:

- A random salt + [scrypt](https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options)
  derives a key from your passphrase.
- **AES-256-GCM** encrypts the text and produces an authentication tag, so `.decrypt` can detect a wrong
  passphrase or tampered data instead of silently returning garbage.
- Usage: `.encrypt <passphrase> | <text>` or just `.encrypt <text>` to use `DEFAULT_CIPHER_PASSPHRASE`
  from `.env`. Same pattern for `.decrypt`.

## 8. `.setmessage` — a note on scope

The original request specified `.setmessage` as a command name without describing its exact behavior.
This build implements it as: **owner-only, sets a custom auto-reply text sent once per day per DM** to
anyone who messages the bot directly while AI mode is off for that chat (e.g. "I'm away, I'll reply
soon!"). This is an explicit assumption. If you had something else in mind (a group welcome message, a
broadcast, etc.), it's a small change — copy the persistence pattern from `commands/aimode.js`
(`lib/db.js` read/write) and change what `index.js`'s `maybeSendAutoReply()` does with it.

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
| `GROQ_API_KEY`, `GROQ_MODEL` | AI provider credentials/model |
| `AI_DAILY_LIMIT` | Replies per chat per day (default 10) |
| `DEFAULT_CIPHER_PASSPHRASE` | Fallback passphrase for `.encrypt`/`.decrypt` |
| `LOG_LEVEL` | `fatal`\|`error`\|`warn`\|`info`\|`debug`\|`trace` |

## 10. Running the bot

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.example .env
# edit .env: set OWNER_NUMBER, GROQ_API_KEY, etc.

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
- **AI commands say "not configured"** — `GROQ_API_KEY` is empty in `.env`. Get a free key from
  <https://console.groq.com>.
- **AI commands say "invalid API key" (401)** — double check the key was copied correctly and hasn't been
  revoked.
- **"rate limited" (429) from Groq** — you're hitting Groq's own request-rate limits, unrelated to
  `AI_DAILY_LIMIT`; wait a bit and try again, or check your Groq account's usage tier.
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
