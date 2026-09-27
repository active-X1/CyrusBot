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