# CyrusBot

A structured Baileys WhatsApp bot with a dedicated pairing flow and modular handlers.

## Startup

- Run the bot normally: `npm start`
- Pair a new WhatsApp number: `node pair.js`

## Structure

- `index.js` starts the normal bot runtime.
- `pair.js` handles the initial pairing/setup flow.
- `commands/` stores individual bot commands.
- `handlers/` contains message, connection, and command routing logic.
- `utils/` contains shared helpers.
- `auth/` stores Baileys session credentials.
- `sessions/` stores session metadata.

## Notes

This layout is easier to maintain as the command list grows beyond a single file.
