const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
} = require("@whiskeysockets/baileys");

const { AUTH_DIR, config, ensureDir } = require("./config");
const { setupConnectionHandlers } = require("./handlers/connectionHandler");
const { handleIncomingMessage } = require("./handlers/messageHandler");
const { loadCommands } = require("./handlers/commandHandler");
const { logInfo, logError } = require("./utils/logger");

async function startBot() {
  ensureDir(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu(config.botName || "CyrusBot"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldIgnoreJid: (jid) => jid === "status@broadcast",
  });

  sock.ev.on("creds.update", saveCreds);

  setupConnectionHandlers(sock, {
    onReady: async () => {
      logInfo("CyrusBot connected successfully.");
      console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
      console.log("┃   ✅ WHATSAPP CONNECTED    ┃");
      console.log("┃   🤖 CYRUSBOT IS ONLINE  ┃");
      console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯");
      console.log(`Bot: ${config.botName}`);
      console.log(`Owner: ${config.ownerJid}`);
      console.log(`Loaded commands: ${Object.keys(loadCommands()).length}`);
    },
    onClose: async () => {
      logInfo("Socket closed. Waiting for reconnect.");
    },
    onReconnect: () => {
      logInfo("Reconnect attempt scheduled.");
    },
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      if (!message.message || message.key?.fromMe) continue;

      try {
        await handleIncomingMessage(sock, message);
      } catch (error) {
        logError(error, "messages.upsert");
      }
    }
  });

  console.log("\n🚀 CyrusBot is starting...");
  console.log(`Loaded commands: ${Object.keys(loadCommands()).length}`);

  return sock;
}

if (require.main === module) {
  console.log("\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮");
  console.log("┃       🤖 CYRUSBOT          ┃");
  console.log("┃          v1.0.0            ┃");
  console.log("╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n");

  startBot().catch((error) => {
    logError(error, "startBot");
    process.exit(1);
  });
}

module.exports = { startBot };
