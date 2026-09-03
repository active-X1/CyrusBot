const { DisconnectReason } = require("@whiskeysockets/baileys");
const { logInfo, logError } = require("../utils/logger");

function setupConnectionHandlers(sock, { onReady, onClose, onReconnect }) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR code ready. Please scan it from the linked device.\n");
    }

    if (connection === "open") {
      logInfo("WhatsApp connection opened.");
      if (typeof onReady === "function") await onReady();
      return;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logInfo(`Connection closed with reason: ${statusCode ?? "unknown"}`);

      if (statusCode === DisconnectReason.loggedOut) {
        logInfo("Session logged out. Remove auth and pair again.");
      }

      if (typeof onClose === "function") {
        await onClose({ statusCode, lastDisconnect });
      }

      if (typeof onReconnect === "function") {
        onReconnect(statusCode);
      }
    }
  });
}

module.exports = { setupConnectionHandlers };
