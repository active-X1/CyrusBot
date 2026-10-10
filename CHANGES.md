# CyrusBot — Render Pairing & Menu Upgrade

Summary of this update. See `README.md` for the full project documentation; this file covers only what
changed in this pass.

## Files created

- **`lib/authSetup.js`** — new, small module that decides QR vs phone-number pairing exactly once per run
  (before the reconnect loop starts), either from `.env` or via an interactive terminal menu. No existing
  file did this job before, so it's new rather than a modification.
- **`commands/menu.js`** — the new `.menu` command. Builds its output entirely from the commands the
  command loader actually found (`ctx.commands`), so it can never show a command that doesn't exist, and
  automatically includes any command you add later.
- **`CHANGES.md`** — this file.

## Files modified (not rewritten)

- **`config.js`** — added `authMethodExplicit` (was `AUTH_METHOD` actually set in `.env`, or are we
  falling back to a default?) and normalized a couple of extra spellings (`pairing` as well as
  `pairing-code`) for the *same* `AUTH_METHOD` variable. No environment variable was renamed.
- **`index.js`** — the auth block inside `connectOnce()` now takes its method/number from an
  `authChoice` object (resolved once in `main()` via `resolveAuthMethod()`) instead of reading
  `config.authMethod`/`config.pairingNumber` directly. This is what guarantees the QR/pairing-code
  decision — and any interactive prompt — happens exactly once per run, never once per reconnect.
- **`commands/ping.js`** — same file, restyled output; latency is still measured the same way as before
  (time to send the initial reply), just displayed as a formatted box instead of one line.
- **`commands/help.js`** — removed its `aliases: ['menu']` entry. This collided with the new dedicated
  `.menu` command name once it existed (both would have tried to register the same trigger in
  `lib/commandLoader.js`'s registry) — this was the one "tiny compatibility adjustment" needed, and
  nothing else about `.help` changed.
- **`.env.example`** — expanded the `AUTH_METHOD` comment to document the interactive-menu behavior and
  the Render caveat. No variable names changed.

## Untouched

Everything else — `lib/commandLoader.js`, `lib/db.js`, `lib/helpers.js`, `lib/logger.js`,
`lib/rateLimiter.js`, `lib/aiProvider.js`, `commands/ai.js`, `commands/aimode.js`, `commands/encrypt.js`,
`commands/decrypt.js`, `commands/setmessage.js`, `package.json`, `.gitignore`, session handling, and the
database structure/format — is exactly as it was.

## How to select QR pairing

Leave `AUTH_METHOD` unset in `.env` and run the bot in a normal local terminal — you'll see:

```
╭────────────────────────────╮
│      🔐 CYRUSBOT SETUP     │
╰────────────────────────────╯

[1] 📱 Pair with Phone Number
[2] 🖼️  Pair with QR Code

Select an option:
```

Type `2` and press Enter — the QR code is printed as before. Or set `AUTH_METHOD=qr` in `.env` to skip
the menu entirely and always use QR.

## How to select phone-number pairing

From the same menu, type `1` and press Enter. If `PAIRING_NUMBER` (or `OWNER_NUMBER`) isn't already set in
`.env`, you'll be asked to type your WhatsApp number (digits only). A pairing code is then printed — no QR
code is shown in this path. Or set `AUTH_METHOD=pairing-code` (or `AUTH_METHOD=pairing`) plus
`PAIRING_NUMBER=<your number>` in `.env` to skip the menu and always use phone pairing — this is what
you should do on Render.

## How to configure Render

Render doesn't give you an interactive terminal, so the setup menu can't be shown there — set the method
explicitly in your Render service's environment variables:

```env
AUTH_METHOD=pairing-code
PAIRING_NUMBER=234XXXXXXXXXX
```

(or `AUTH_METHOD=qr` if you'd rather scan a QR code from Render's log output). Build command stays
`npm install`, start command stays `npm start` — nothing else about deployment changed.

## How to use `.menu`

Send `.menu` (or its alias `.m`) in any chat. It shows your @mention, the prefix, bot version, and uptime,
followed by every command you're allowed to use, grouped into MAIN MENU / AI / TOOLS / OWNER sections —
the OWNER section only appears for the bot owner.

## How to use `.ping`

Send `.ping`. The bot replies once immediately, measures how long that took, then sends a formatted
"PONG!" box showing the real measured response time, online status, and bot name.

---

# Update 3 — Games, dual prefix, new menu

## Important: what "HTML game inside WhatsApp" really means

WhatsApp has no real feature (official or reverse-engineered, as far as could be verified) that executes
raw HTML/JS as a native in-chat WebView. Forks advertising `sendHtmlApp` / `sendMiniApp` were reviewed and
**not installed** (unverifiable claims, odd internal names, third-party tracking domains - and they would
run with full access to your WhatsApp session). `package.json` is therefore **unchanged**.

What CyrusBot does instead: it hosts the games itself (`lib/gameServer.js`, built-in `http`, no new
dependency) and sends a link. On WhatsApp Android, tapping it opens WhatsApp's in-app browser overlay.
If no public URL exists, the game is sent as a self-contained `.html` file instead. Games run fully
client-side: the bot never sees taps or scores and stores nothing.

## Created
- `games/snake.html` (your Snake, same gameplay + touch D-pad, swipe, responsive canvas, no external resources)
- `games/aim.html` (new Aim Challenge: 15s, tap targets, score, play again)
- `lib/gameServer.js` (HTTP server + `sendGame()` link/file fallback)
- `commands/snakegame.js`, `commands/aimgame.js` (category `games`)

## Modified
- `lib/helpers.js` - added `matchPrefix()` (central prefix matching)
- `index.js` - uses `matchPrefix` with `config.prefixes`; starts the game server once
- `config.js` - `prefixes` (PREFIX + new EXTRA_PREFIXES, default `!`), `publicUrl`, `port`, `paths.games`; default names now `activeX` / `Cyrus Akacha Cyprian` (env vars still override)
- `commands/menu.js` - rewritten: bot-info header, GAMES section, profile picture
- `commands/help.js` - shows both prefixes, accepts `!help !ping`
- `lib/logger.js` - synchronous file stream (prevents a crash on very early shutdown)
- `.env.example` - EXTRA_PREFIXES, PUBLIC_URL

## Usage
- **Prefixes:** `.menu` and `!menu` both work for every command; change via `PREFIX` / `EXTRA_PREFIXES`.
- **Menu:** owner name is the connected WhatsApp account's profile name; profile picture is fetched live
  (`sock.profilePictureUrl`); if unavailable, plain text is sent.
- **Add a game:** add HTML to `games/`, one line in `GAMES` in `lib/gameServer.js`, and a 10-line
  `commands/<name>.js` with `category: 'games'` and an `emoji`. The menu updates itself.
- **Render:** deploy as a **Web Service** (not Background Worker) so a public URL exists
  (`RENDER_EXTERNAL_URL` is detected automatically). As a Worker you get the `.html` file fallback.

---

# Update 4 — `.view` and `.profile`

- **`commands/view.js`** — `.view` / `.v` (also `!view` / `!v`). Reply to a view-once image/video/voice note;
  the bot downloads it and re-sends it as a normal message in the same chat. **Owner-only** (it bypasses
  view-once privacy, so group members can't use your bot for it).
- **`commands/profile.js`** — `.profile` / `.pic`. In a group: reply to someone (or @mention them). In a DM:
  just send it. No picture / hidden by privacy -> a clear message instead of an error.
- No other files changed; both appear in `.menu` under TOOLS automatically.

---

# Update 5 — `.groupinfo`, unified style, menu upgrade

- **`commands/groupinfo.js`** (`.groupinfo` / `.ginfo`): in a group shows name, id, creation date + creator
  (when WhatsApp provides it), total / admin / member counts, description, restrictions and the group
  picture (skipped if none). In a DM without a link it explains usage. `.groupinfo <group link>` works in
  both groups and DMs; for groups the bot is NOT in, WhatsApp doesn't reveal the admin list, so admins
  show as "unavailable" instead of a guess.
- **`lib/ui.js`** (new): shared `box / notice / error / denied / usage` helpers. Every command's replies
  (ai, aimode, encrypt, decrypt, setmessage, help, view, profile, games, group info, and bot-wide errors
  / owner-only denials in `index.js`) now use the same boxed style as `.ping` and `.menu`.
- **`.menu`**: shows the total command count (and how many are owner-only), every command has an emoji and
  a short description, and owner-only commands are listed together in a final 👑 OWNER ONLY section
  (visible to everyone, so people know they exist).
- **`.help`** rewritten in the same style.
- Commands live in `commands/` (one file each); add `emoji` and a short `description` to new ones.

---

# Update 6 — keyless encryption, `.setmessage` on/off + group rules

**Encryption** (`lib/cipher.js` new; `commands/encrypt.js`, `commands/decrypt.js` rewritten)
- `.encrypt <message>` / `.decrypt <token>` - no key or passphrase to supply. The bot generates a random
  256-bit key on first use and stores it in `database/cipher-key.json` (mode 600, gitignored). Both commands
  also work by replying to a message.
- `DEFAULT_CIPHER_PASSPHRASE` is removed. Optional `CIPHER_KEY` pins the key (useful on Render).
- **Breaking:** tokens made by the old passphrase-based `.encrypt` can no longer be decrypted.
- Anyone who can run `.decrypt` on your bot can decrypt its tokens (see README section 7).

**`.setmessage`** (rewritten) - `on` / `off` / `clear` / `<text>` / status. Auto-reply now:
- replies in DMs (once per day per chat);
- in groups ONLY when your account is @mentioned or your message is replied to (once per day per person);
- never replies to your own messages.
- Logic lives in `lib/autoReply.js` (new); `isDirectedAtMe()` added to `lib/helpers.js`.

**Bug fixed in `index.js`:** Baileys also emits the bot's OWN sent messages and offline backlog as
`messages.upsert` events of type `append`. They were being processed (so, with AI mode on, the bot could
answer its own replies, and old messages could be answered after a reconnect). Only live `notify` events are
handled now, and every message in a batch is processed (previously only the first).

---

# Update 7 — OpenRouter, ready-to-run config, owner fix

- **Groq -> OpenRouter.** `lib/aiProvider.js` rewritten for `https://openrouter.ai/api/v1/chat/completions`.
  Env vars renamed: `GROQ_API_KEY` -> `OPENROUTER_API_KEY`, `GROQ_MODEL` -> `OPENROUTER_MODEL`
  (default `openrouter/free`, OpenRouter's router that picks an available free model).
  Handles 401 / 402 (no credits) / 404 (bad model) / 429 / timeouts / empty replies / errors returned inside
  an HTTP 200, each with a friendly message. Attribution headers are sanitised to ASCII.
- **`.env` included**, pre-filled: `OWNER_NUMBER=2348066761823`, `AUTH_METHOD=pairing-code`,
  `PAIRING_NUMBER=2348066761823`. Only `OPENROUTER_API_KEY` is left for you to paste.
- **Owner bug fixed (`index.js`).** When you sent a command from your own phone inside someone else's DM, the
  sender was read as that other person, so owner-only commands (`.view`, `.setmessage`) were denied to you.
  Messages sent from the bot's own account are now always treated as the owner's.
- README / `.env.example` updated.

---

# Update 8 — promote/demote, compact menu, persistent login prompt

- **`.promote` / `.demote`** (`commands/promote.js`, `commands/demote.js`, shared `lib/groupAdmin.js`):
  owner-only, groups only, and the bot must be an admin. Target = @mention, replied-to person, or a typed
  number. Handles: already admin / not admin / group creator can't be demoted / person not in group /
  bot not admin / WhatsApp refusals. People are matched across phone numbers and `@lid`s.
- **Menu** (`commands/menu.js`, `lib/ui.js`): commands only (no descriptions), no blank lines, info box
  closed, category sections open, the OWNER ONLY section closes the menu. Sensible order (menu, ping, help ...).
  The bottom line is now sized from the title's estimated visual width, so it no longer overshoots the top
  (all boxes bot-wide, including `.ping`). If it still looks off on your phone, tune `WIDTH` in `lib/ui.js`.
- **Login prompt** (`lib/authSetup.js`, `index.js`): always asks phone vs QR whenever a login is needed -
  including the first run, and even if `AUTH_METHOD` is set - and re-asks on bad input. Validates the number,
  shows it masked. After a WhatsApp logout the dead session is cleared and you are asked again.
  `AUTH_METHOD` is now only used where no keyboard exists (Render). Shipped `.env` no longer forces it.
- **Fixes found while testing:** owner detection now also checks the message's alternate address
  (`participantAlt`), so the owner is recognised in groups that show people as `@lid`; group-admin checks
  (used by `.aimode`) match across phone/`@lid` forms too.
