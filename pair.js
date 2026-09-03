const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { AUTH_DIR, ensureDir } = require("./config");
const { logInfo, logError } = require("./utils/logger");

async function pair() {
  ensureDir(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("CyrusBot"),
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 Scan the QR code below to pair this WhatsApp number:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("\n✅ Pairing complete. Bot is connected.");
      process.exit(0);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        logInfo("Logged out. Remove the auth folder and pair again.");
      }

      console.log(`Connection closed with status code: ${statusCode ?? "unknown"}`);
    }
  });

  console.log("\n🔐 CyrusBot pairing mode is running.");
  console.log("Scan the QR code in the terminal or use the pairing flow in the app.\n");
}

if (require.main === module) {
  pair().catch((error) => {
    logError(error, "pair");
    process.exit(1);
  });
}

module.exports = { pair };
