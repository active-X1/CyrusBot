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
