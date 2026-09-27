🤖 CyrusBot

A Modular WhatsApp Bot Built with Node.js & Baileys

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Baileys-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Baileys">
  <img src="https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/github/license/active-X1/CyrusBot?style=for-the-badge" alt="License">
</p><p align="center">
  <b>CyrusBot</b> is a modular WhatsApp bot designed with a clean, extensible architecture that makes it easy to build, manage, and add new features.
</p><p align="center">
  Built with ❤️ by <a href="https://github.com/active-X1">Active X</a>
</p>---

✨ Features

- 📱 QR Code Authentication
- 🔢 Pairing Code Authentication
- 🧩 Modular Command System
- ⚡ Dynamic Command Loading
- 🏓 Ping / Bot Status
- 🤖 AI Chat
- 🧠 Automatic AI Mode
- 🔐 AES-256-GCM Encryption
- 🔓 Secure Decryption
- 📨 Custom Auto-Reply
- 👑 Owner Permissions
- 🛡️ Group Admin Permissions
- 🚦 AI Rate Limiting
- 💾 Lightweight JSON Database
- 📝 Centralized Logging
- 🔄 Automatic Reconnection
- ⚙️ Environment-Based Configuration
- 🔒 Protected Session Storage

---

📸 Preview

«Screenshots and demonstrations can be added here as the project grows.»

╭──────────────────────────────╮
│         🤖 CyrusBot          │
│                              │
│  .help                       │
│  .ping                       │
│  .ai <question>              │
│  .aimode on                  │
│  .encrypt <text>             │
│  .decrypt <text>             │
│                              │
│       Active X              │
╰──────────────────────────────╯

---

🧠 Architecture

CyrusBot is built around a modular architecture.

The main application handles the WhatsApp connection and message dispatch, while individual features are separated into command modules.

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

Why this structure?

Instead of putting every feature into one large file, CyrusBot separates responsibilities.

For example:

commands/ping.js

handles the ping command.

commands/ai.js

handles AI requests.

lib/aiProvider.js

handles communication with the AI provider.

This makes the project easier to:

- 🧠 Understand
- 🛠️ Maintain
- 🐛 Debug
- ➕ Extend
- ♻️ Reuse

---

📋 Commands

The default command prefix is:

.

Command| Description
".ping"| Check if CyrusBot is online
".help"| Display available commands
".ai <question>"| Ask the AI a question
".aimode on"| Enable automatic AI responses
".aimode off"| Disable automatic AI responses
".encrypt <text>"| Encrypt text
".decrypt <text>"| Decrypt encrypted text
".setmessage <text>"| Configure the custom auto-reply

---

🤖 AI

CyrusBot includes an AI system powered by Groq.

Ask a question

.ai Explain what Python is

Enable AI Mode

.aimode on

When AI Mode is enabled, normal messages in that chat can be processed by the AI.

Disable AI Mode

.aimode off

AI Mode can only be enabled or disabled by authorized users.

---

🚦 AI Rate Limiting

CyrusBot includes a per-chat AI usage limit.

The default limit is:

10 AI responses per chat per day

Change it through:

AI_DAILY_LIMIT=10

The counter automatically resets when the date changes.

---

🔐 Encryption

CyrusBot uses Node.js's built-in "crypto" module for encryption.

It uses:

- 🔑 "scrypt" for key derivation
- 🔐 AES-256-GCM encryption
- 🧂 Random salts
- 🛡️ Authentication tags

No external encryption service is required.

Example

.encrypt Hello CyrusBot

The resulting encrypted data can then be decrypted using:

.decrypt <encrypted-data>

A passphrase can also be supplied when using the supported command format.

---

🔑 Authentication

CyrusBot supports two authentication methods.

📱 QR Code

Set:

AUTH_METHOD=qr

Start the bot:

npm start

Then scan the QR code from:

«WhatsApp → Linked Devices → Link a Device»

---

🔢 Pairing Code

Set:

AUTH_METHOD=pairing-code

Then configure:

PAIRING_NUMBER=234XXXXXXXXXX

The phone number should contain digits only.

CyrusBot will generate an 8-character pairing code.

Enter it through:

«WhatsApp → Linked Devices → Link with phone number instead»

After successful authentication, the session is stored locally for future reconnects.

---

⚙️ Configuration

Create your environment file:

cp .env.example .env

Example configuration:

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

Configuration Reference

Variable| Description
"BOT_NAME"| Bot name
"BOT_AUTHOR"| Bot developer/author
"GITHUB_USERNAME"| GitHub username
"PREFIX"| Command prefix
"OWNER_NUMBER"| Bot owner's WhatsApp number
"SUDO_NUMBERS"| Additional authorized users
"AUTH_METHOD"| "qr" or "pairing-code"
"PAIRING_NUMBER"| Number used for pairing
"GROQ_API_KEY"| Groq API key
"GROQ_MODEL"| AI model
"AI_DAILY_LIMIT"| Daily AI response limit
"DEFAULT_CIPHER_PASSPHRASE"| Default encryption passphrase
"LOG_LEVEL"| Logging level

---

🚀 Installation

1. Clone the repository

git clone https://github.com/active-X1/CyrusBot.git

2. Enter the project

cd CyrusBot

3. Install dependencies

npm install

4. Create your environment file

cp .env.example .env

5. Configure ".env"

Add your:

- WhatsApp number
- Authentication method
- Groq API key
- Bot settings

6. Start CyrusBot

npm start

---

📦 Requirements

Before running CyrusBot, make sure you have:

- "Node.js" (https://nodejs.org/) 18+
- npm
- A WhatsApp account
- Internet connection

«💡 Node.js 20 LTS or newer is recommended.»

---

🧩 Creating Commands

Adding a command is intentionally simple.

Create a file inside:

commands/

For example:

commands/hello.js

Then:

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
      {
        text: 'Hello from CyrusBot! 🤖'
      },
      msg
    );
  }
};

Restart CyrusBot and the command will automatically be detected.

You don't need to manually register the command inside "index.js".

---

🛡️ Permissions

CyrusBot provides permission handling for protected features.

👑 Owner

The number specified in:

OWNER_NUMBER=

is treated as the bot owner.

👥 Sudo Users

Additional trusted users can be configured with:

SUDO_NUMBERS=234XXXXXXXXXX,234XXXXXXXXXX

🛡️ Group Administrators

Group-specific functionality can also check whether the sender is a group administrator.

---

💾 Database

CyrusBot currently uses lightweight JSON storage for small amounts of persistent data.

Runtime database files are stored inside:

database/

This is suitable for:

- Counters
- Settings
- Flags
- AI usage data
- Small bot state

The storage layer can be replaced with a proper database later if the project grows.

---

📝 Logging

CyrusBot uses a centralized logger.

Logs are stored in:

logs/bot.log

Logging levels:

fatal
error
warn
info
debug
trace

Configure the level with:

LOG_LEVEL=info

---

🔄 Connection Handling

CyrusBot includes automatic reconnection handling.

Temporary connection failures are handled through controlled reconnect attempts with backoff.

This helps avoid:

- Infinite recursive reconnects
- Duplicate listeners
- Growing call stacks
- Unnecessary resource usage

---

🔒 Security

Security is an important part of CyrusBot.

🚨 Never commit these files:

.env
sessions/
database/*.json
logs/

The ".gitignore" file is configured to protect sensitive runtime data.

⚠️ Protect Your Session

The "sessions/" directory contains WhatsApp authentication credentials.

Never upload or share your session files.

If your session may have been exposed:

1. Open WhatsApp.
2. Go to Linked Devices.
3. Remove any unknown device.
4. Delete the local "sessions/" directory.
5. Authenticate CyrusBot again.

---

🐛 Troubleshooting

❌ Commands aren't responding

Check that your prefix is correct.

For example:

PREFIX=.

means you should use:

.ping

---

❌ Commands aren't loading

Check the terminal output for command-loader messages.

Make sure your command exports an object containing at least:

module.exports = {
  name: 'command',
  execute() {}
};

---

❌ AI isn't working

Check:

GROQ_API_KEY=

Make sure the API key is valid and properly configured.

---

❌ Bot keeps requesting authentication

Make sure the:

sessions/

directory is writable and isn't being deleted between restarts.

If the session was logged out, remove the old session and authenticate again.

---

🗺️ Roadmap

CyrusBot is actively designed to be expandable.

Planned / Possible Features

- [ ] 📥 Media handling
- [ ] 👥 Advanced group management
- [ ] 🎮 Games
- [ ] 🛠️ More utility commands
- [ ] 🤖 Expanded AI features
- [ ] 🗄️ Database integration
- [ ] 🌐 Web dashboard
- [ ] 🔌 Plugin system
- [ ] ⚙️ Advanced bot settings
- [ ] 📊 Bot statistics
- [ ] 🧰 More developer utilities

---

🤝 Contributing

Contributions, suggestions, and improvements are welcome.

Fork the repository

git clone https://github.com/active-X1/CyrusBot.git

Create your feature:

git checkout -b feature/my-feature

Make your changes, test them, and submit a pull request.

---

👨‍💻 Developer

<p align="center">
  <img src="https://github.com/active-X1.png" width="100" height="100" alt="Active X">
</p><h3 align="center">Active X</h3><p align="center">
  Python & JavaScript Developer • Builder • Learner
</p><p align="center">
  <a href="https://github.com/active-X1">
    GitHub
  </a>
</p>---

⭐ Support

If you find CyrusBot useful, consider giving the repository a ⭐.

It helps support the project and encourages further development.

---

📜 License

This project is intended for educational and development purposes.

Please use CyrusBot responsibly and respect WhatsApp's applicable terms and policies.

---

<p align="center">🤖 CyrusBot

Built with JavaScript • Powered by Baileys • Created by Active X

«Build. Learn. Break. Fix. Improve.»

</p>