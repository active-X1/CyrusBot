const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

const {
  AUTH_DIR,
  config,
  ensureDir,
} = require("./config");

const {
  setupConnectionHandlers,
} = require("./handlers/connectionHandler");

const {
  handleIncomingMessage,
} = require("./handlers/messageHandler");

const {
  handleGroupJoinEvent,
  handleGroupLeaveEvent,
} = require("./handlers/groupHandler");

const {
  loadCommands,
} = require("./handlers/commandHandler");

const {
  logInfo,
  logError,
} = require("./utils/logger");

let reconnecting = false;

async function startBot() {
  if (reconnecting) {
    return;
  }

  reconnecting = true;

  try {
    ensureDir(AUTH_DIR);

    const {
      state,
      saveCreds,
    } = await useMultiFileAuthState(AUTH_DIR);

    console.log(
      "📱 Waiting for WhatsApp pairing. A QR code will appear in the terminal."
    );

    const sock = makeWASocket({
      auth: state,

      browser: Browsers.ubuntu(
        config.botName || "CyrusBot"
      ),

      syncFullHistory: false,

      markOnlineOnConnect: true,

      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,

      shouldIgnoreJid: (jid) =>
        jid === "status@broadcast",
    });

    sock.ev.on("creds.update", saveCreds);

    setupConnectionHandlers(sock, {
      onReady: async () => {
        reconnecting = false;

        const commands = loadCommands();

        logInfo(
          "CyrusBot connected successfully."
        );

        console.log(
          "\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"
        );

        console.log(
          "┃   ✅ WHATSAPP CONNECTED    ┃"
        );

        console.log(
          "┃   🤖 CYRUSBOT IS ONLINE   ┃"
        );

        console.log(
          "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
        );

        console.log(`Bot: ${config.botName}`);
        console.log(`Version: ${config.version}`);
        console.log(`Owner: ${config.ownerJid}`);
        console.log(
          `Loaded commands: ${Object.keys(commands).length}`
        );
      },

      onClose: async ({
        statusCode,
        shouldReconnect,
      }) => {
        reconnecting = false;

        if (
          statusCode === DisconnectReason.loggedOut
        ) {
          logInfo(
            "WhatsApp session logged out. Pair again."
          );

          return;
        }

        if (!shouldReconnect) {
          return;
        }

        logInfo(
          "Connection lost. Reconnecting in 5 seconds..."
        );

        setTimeout(() => {
          startBot().catch((error) => {
            logError(error, "reconnect");
          });
        }, 5000);
      },
    });

    sock.ev.on(
      "messages.upsert",
      async ({ messages, type }) => {
        if (type !== "notify") {
          return;
        }

        for (const message of messages) {
          if (
            !message.message ||
            message.key?.fromMe
          ) {
            continue;
          }

          try {
            await handleIncomingMessage(
              sock,
              message
            );
          } catch (error) {
            logError(
              error,
              "messages.upsert"
            );
          }
        }
      }
    );

    sock.ev.on(
      "group-participants.update",
      async ({ id, participants, action }) => {
        if (!id || !Array.isArray(participants)) {
          return;
        }

        try {
          if (action === "add") {
            await handleGroupJoinEvent(sock, id, participants);
          }

          if (action === "remove") {
            await handleGroupLeaveEvent(sock, id, participants);
          }
        } catch (error) {
          logError(error, "group-participants.update");
        }
      }
    );

    console.log("\n🚀 CyrusBot is starting...");

    console.log(
      `Loaded commands: ${
        Object.keys(loadCommands()).length
      }`
    );

    return sock;
  } catch (error) {
    reconnecting = false;

    logError(error, "startBot");

    setTimeout(() => {
      startBot().catch((err) => {
        logError(err, "restart");
      });
    }, 5000);
  }
}

if (require.main === module) {
  console.log(
    "\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"
  );

  console.log(
    "┃       🤖 CYRUSBOT          ┃"
  );

  console.log(
    `┃          v${config.version}          ┃`
  );

  console.log(
    "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n"
  );

  startBot();
}

module.exports = {
  startBot,
};