const { DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { logInfo } = require("../utils/logger");

function setupConnectionHandlers(sock, { onReady, onClose }) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 QR code ready. Scan it from WhatsApp.\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      logInfo("WhatsApp connection opened.");

      if (typeof onReady === "function") {
        await onReady();
      }

      return;
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      logInfo(
        `Connection closed: ${statusCode ?? "unknown"}`
      );

      if (typeof onClose === "function") {
        await onClose({
          statusCode,
          lastDisconnect,
          shouldReconnect:
            statusCode !== DisconnectReason.loggedOut,
        });
      }
    }
  });
}

module.exports = {
  setupConnectionHandlers,
};