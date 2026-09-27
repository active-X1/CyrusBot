🤖 CyrusBot

«A modular, powerful, and developer-friendly WhatsApp bot built with Node.js and Baileys.»

CyrusBot is a modular WhatsApp automation bot created by Active X. It is designed with a clean architecture that makes commands easy to add, modify, maintain, and understand.

The project focuses on simplicity, security, extensibility, and keeping each feature separated into its own module.

---

✨ Features

- 📱 WhatsApp QR-code authentication
- 🔢 WhatsApp pairing-code authentication
- 🧩 Modular command system
- ⚡ Dynamic command loading
- 🏓 Ping command
- 🤖 AI-powered chat
- 🧠 Automatic AI mode
- 🔐 AES-256-GCM encryption/decryption
- 📨 Custom auto-reply message
- 👑 Owner permissions
- 🛡️ Group-admin permissions
- 🚦 AI usage rate limiting
- 💾 Lightweight JSON database
- 📝 Structured logging
- 🔄 Automatic reconnection
- ⚙️ Environment-based configuration
- 🔒 Session and secret protection
- 🧱 Easy-to-extend architecture

---

📁 Project Structure

CyrusBot/
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

---

🧠 Architecture

CyrusBot follows a modular architecture.

The main connection file does not contain all of the bot's features. Instead, it handles the WhatsApp connection and passes incoming commands to the appropriate command module.

Each command lives independently inside the "commands/" directory.

For example:

commands/
├── ping.js
├── ai.js
├── encrypt.js
└── decrypt.js

This means you can add or remove functionality without turning "index.js" into a huge file.

Core responsibilities

File| Responsibility
"index.js"| WhatsApp connection and message dispatch
"config.js"| Application configuration
"commandLoader.js"| Automatically discovers commands
"helpers.js"| Shared utility functions
"aiProvider.js"| AI API communication
"rateLimiter.js"| AI usage limits
"db.js"| Lightweight persistent storage
"logger.js"| Application logging
"commands/"| Individual bot features

---

🛠️ Commands

CyrusBot uses a configurable command prefix.

The default prefix is:

.

Available commands

Command| Description
".ping"| Check whether the bot is online
".help"| Display available commands
".ai <question>"| Ask the AI a question
".aimode on"| Enable automatic AI responses
".aimode off"| Disable automatic AI responses
".encrypt <text>"| Encrypt text
".decrypt <text>"| Decrypt encrypted text
".setmessage <text>"| Configure the bot's custom auto-reply

---

🤖 AI System

CyrusBot includes an AI system powered through the Groq API.

The AI system has two modes.

One-time AI

.ai What is Python?

The bot processes the question and returns an AI-generated response.

AI Mode

.aimode on

When enabled, messages that aren't commands can automatically receive AI responses.

Disable it with:

.aimode off

AI mode can be controlled by the bot owner or an authorized group administrator.

---

🚦 AI Rate Limiting

To prevent excessive AI usage, CyrusBot includes a per-chat daily limit.

The default is:

10 AI responses per chat per day

This can be changed through:

AI_DAILY_LIMIT=10

The counter automatically resets when the date changes.

---

🔐 Encryption

CyrusBot includes built-in text encryption using Node.js's native "crypto" module.

It uses:

- "scrypt" for password-based key derivation
- AES-256-GCM for authenticated encryption
- Random salts
- Authentication tags

No external encryption service is required.

Encrypt

.encrypt my secret message

Decrypt

.decrypt <encrypted-data>

You can also provide a passphrase explicitly using the supported command format.

---

🔑 Authentication

CyrusBot supports two WhatsApp authentication methods.

QR Code

Set:

AUTH_METHOD=qr

Start the bot and scan the displayed QR code using:

WhatsApp → Linked Devices → Link a Device

---

Pairing Code

Set:

AUTH_METHOD=pairing-code

Then configure:

PAIRING_NUMBER=234XXXXXXXXXX

The number should contain digits only.

The bot will display an 8-character pairing code.

Enter it through:

WhatsApp → Linked Devices → Link with phone number instead

Once authentication succeeds, the session is stored locally so the bot can reconnect automatically.

---

⚙️ Configuration

CyrusBot uses environment variables so sensitive information doesn't need to be placed directly inside the source code.

Create your environment file:

cp .env.example .env

Then configure it.

Example:

BOT_NAME=CyrusBot
BOT_AUTHOR=Active X
GITHUB_USERNAME=active-X1

PREFIX=.

OWNER_NUMBER=234XXXXXXXXXX
SUDO_NUMBERS=

AUTH_METHOD=qr
PAIRING_NUMBER=

GROQ_API_KEY=
GROQ_MODEL=

AI_DAILY_LIMIT=10

DEFAULT_CIPHER_PASSPHRASE=

LOG_LEVEL=info

---

🚀 Installation

1. Clone the repository

git clone https://github.com/active-X1/CyrusBot.git

Enter the project:

cd CyrusBot

2. Install dependencies

npm install

3. Configure the environment

cp .env.example .env

Edit ".env" and add your configuration.

4. Start CyrusBot

npm start

On the first launch, authenticate your WhatsApp account using either QR code or pairing code.

---

📋 Requirements

CyrusBot requires:

- Node.js 18+
- npm
- A WhatsApp account
- Internet connection

Node.js 20 LTS or newer is recommended.

---

🧩 Adding a New Command

One of the main goals of CyrusBot is making development simple.

Create a new file inside:

commands/

For example:

commands/hello.js

A basic command looks like:

module.exports = {
  name: 'hello',
  aliases: ['hi'],
  description: 'Say hello',
  category: 'general',
  ownerOnly: false,

  async execute(sock, msg, args, ctx) {
    await ctx.safeSend(
      sock,
      ctx.chatId,
      { text: 'Hello from CyrusBot!' },
      msg
    );
  },
};

Restart the bot and the command will automatically be discovered.

No changes to "index.js" are required.

---

🛡️ Permissions

CyrusBot includes permission helpers for controlling sensitive functionality.

Supported permission levels include:

Owner

The configured "OWNER_NUMBER" has full bot-owner privileges.

Sudo Users

Additional trusted users can be configured through:

SUDO_NUMBERS=234XXXXXXXXXX,234XXXXXXXXXX

Group Administrators

Certain group-management features can be restricted to WhatsApp group administrators.

---

💾 Data Storage

CyrusBot currently uses lightweight JSON storage for small pieces of persistent data.

Runtime data is stored under:

database/

This is suitable for:

- Counters
- Settings
- Flags
- AI usage information
- Small amounts of bot state

For a much larger deployment, the storage layer can later be replaced with a proper database without redesigning the entire command system.

---

📝 Logging

CyrusBot uses a centralized logger.

Logs are available through:

logs/bot.log

The logging level can be configured with:

LOG_LEVEL=info

Supported levels include:

fatal
error
warn
info
debug
trace

Errors are logged internally while users receive safe, generic error messages instead of internal stack traces.

---

🔄 Automatic Reconnection

CyrusBot handles temporary connection failures automatically.

The connection system uses controlled reconnect attempts with backoff rather than continuously creating recursive connection calls.

This helps prevent:

- Infinite reconnect loops
- Growing call stacks
- Duplicate event listeners
- Unnecessary resource usage

---

🔒 Security

Security is an important part of CyrusBot.

Never commit:

.env
sessions/
database/*.json
logs/

The repository's ".gitignore" is configured to protect runtime data and sensitive configuration.

⚠️ Protect your WhatsApp session

The "sessions/" directory contains authentication credentials for the linked WhatsApp account.

Never upload or share it.

If someone obtains your session credentials, they may be able to access the linked WhatsApp account.

If you believe your session has been compromised:

1. Open WhatsApp.
2. Go to Linked Devices.
3. Remove any unknown device.
4. Delete the local "sessions/" directory.
5. Authenticate CyrusBot again.

---

🐛 Troubleshooting

Bot doesn't respond

Check that:

PREFIX

matches the prefix you're using.

For example:

PREFIX=.

means commands should look like:

.ping

---

Commands aren't loading

Check the terminal for the command-loader output.

Make sure command files export:

module.exports = {
  name: 'command',
  execute() {}
};

---

AI isn't responding

Check:

GROQ_API_KEY=

Make sure the API key is valid and correctly configured.

Also check the terminal logs for API or rate-limit errors.

---

Authentication keeps appearing again

Make sure the:

sessions/

directory exists and is writable.

If the WhatsApp session was intentionally logged out, remove the old session and authenticate again.

---

📌 Roadmap

CyrusBot is designed to grow over time.

Possible future features include:

- [ ] More utility commands
- [ ] Media commands
- [ ] Group-management tools
- [ ] Advanced admin controls
- [ ] Better database support
- [ ] More AI features
- [ ] Plugin-style extensions
- [ ] Custom bot settings
- [ ] Improved command categories
- [ ] More automation features
- [ ] Web dashboard

---

👨‍💻 Developer

Active X

GitHub:

https://github.com/active-X1

CyrusBot is part of my journey of building real-world software, learning backend development, and improving my understanding of JavaScript and WhatsApp automation.

---

📜 License

This project is provided for educational and development purposes.

Use CyrusBot responsibly and follow WhatsApp's applicable terms and policies.

---

⭐ Support the Project

If you find CyrusBot useful:

⭐ Star the repository
🍴 Fork the project
🐛 Report bugs
💡 Suggest features
🤝 Contribute improvements

Every contribution helps the project grow.

---

💙 CyrusBot

Built by Active X.

«Build. Learn. Break. Fix. Improve.»