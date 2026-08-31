const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const cron = require("node-cron");
const os = require("os");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

const DEBUG_ALL_COMMANDS = process.env.DEBUG_ALL_COMMANDS === "1";

// ============================================================
// CONFIG
// ============================================================

const BOT_NAME = "CyrusBot";
const VERSION = "1.0.0";
const OWNER_JID = "2348066761823@s.whatsapp.net"; // YOUR NUMBER
const TIMEZONE = "Africa/Lagos";

const AUTH_DIR = path.join(__dirname, "auth_info");
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const LOG_DIR = path.join(__dirname, "logs");

const CONFIG_FILE = path.join(__dirname, "config.json");
const SCHEDULE_FILE = path.join(__dirname, "scheduled.json");

const DEFAULT_CONFIG = {
    autoReplyEnabled: true,
    autoReply: "Cyrus is a bit busy now but will soon respond.",
    groupMode: true
};

// ============================================================
// DIRECTORIES
// ============================================================

for (const dir of [AUTH_DIR, DOWNLOAD_DIR, LOG_DIR]) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
        console.error(`❌ Failed to create directory: ${dir}`);
        console.error(error);
    }
}

// ============================================================
// LOGGING
// ============================================================

function logError(error, context = "") {
    const message =
        error?.stack ||
        error?.message ||
        String(error);

    const line =
        `[${new Date().toISOString()}] ` +
        `${context ? context + ": " : ""}${message}\n`;

    try {
        fs.appendFileSync(
            path.join(LOG_DIR, "errors.log"),
            line
        );
    } catch (_) {}

    console.error(
        `❌ ${context ? context + ": " : ""}${message}`
    );
}

function logCommand(sender, commandName) {
    const line =
        `[${new Date().toISOString()}] ` +
        `${sender} -> .${commandName}\n`;

    try {
        fs.appendFileSync(
            path.join(LOG_DIR, "commands.log"),
            line
        );
    } catch (error) {
        logError(error, "logCommand");
    }
}

// ============================================================
// FILE HELPERS
// ============================================================

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2)
            );
            return fallback;
        }

        const data = fs.readFileSync(
            file,
            "utf8"
        ).trim();

        if (!data) {
            return fallback;
        }

        return JSON.parse(data);
    } catch (error) {
        logError(error, `Reading ${file}`);

        try {
            const backup = `${file}.broken_${Date.now()}`;
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, backup);
            }
        } catch (_) {}

        return fallback;
    }
}

function writeJSON(file, data) {
    try {
        const tempFile = `${file}.tmp`;
        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2)
        );
        fs.renameSync(
            tempFile,
            file
        );
        return true;
    } catch (error) {
        logError(error, `Writing ${file}`);

        try {
            const tempFile = `${file}.tmp`;
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch (_) {}

        return false;
    }
}

// ============================================================
// LOAD DATA
// ============================================================

let config = {
    ...DEFAULT_CONFIG,
    ...readJSON(CONFIG_FILE, DEFAULT_CONFIG)
};

let schedules = readJSON(
    SCHEDULE_FILE,
    []
);

if (!Array.isArray(schedules)) {
    schedules = [];
}

writeJSON(CONFIG_FILE, config);
writeJSON(SCHEDULE_FILE, schedules);

// ============================================================
// GLOBAL STATE
// ============================================================

let sock = null;
let reconnectTimer = null;
let connecting = false;
let reconnectAttempts = 0;
let shuttingDown = false;

let startTime = Date.now();
let messageCount = 0;
let commandCount = 0;

const messageCache = new Map();
const confirmationMap = new Map();
const scheduledJobs = new Map();

// ============================================================
// BASIC HELPERS
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanJid(jid) {
    if (!jid) return "";
    return jid.split(":")[0].split("@")[0];
}

function isOwner(jid) {
    if (!jid) return false;
    return cleanJid(jid) === cleanJid(OWNER_JID);
}

function isGroup(jid) {
    return jid?.endsWith("@g.us");
}

function uptime() {
    const seconds = Math.floor(
        (Date.now() - startTime) / 1000
    );
    const days = Math.floor(
        seconds / 86400
    );
    const hours = Math.floor(
        (seconds % 86400) / 3600
    );
    const minutes = Math.floor(
        (seconds % 3600) / 60
    );
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function getSender(msg, jid) {
    return (
        cleanJid(msg?.key?.participant) ||
        cleanJid(msg?.participant) ||
        cleanJid(jid)
    );
}

function ownerOnly(sender) {
    return isOwner(sender);
}

// ============================================================
// SEND MESSAGE
// ============================================================

async function sendText(jid, text, options = {}) {
    if (!sock) {
        console.error("❌ SEND FAILED: socket is null");
        return null;
    }

    if (!jid || !text) {
        return null;
    }

    try {
        return await sock.sendMessage(
            jid,
            {
                text: String(text),
                ...options
            }
        );
    } catch (error) {
        logError(error, "sendText");
        return null;
    }
}

async function sendBufferAsSticker(
    jid,
    buffer,
    metadata = {}
) {
    if (!sock || !buffer) {
        return null;
    }

    try {
        return await sock.sendMessage(
            jid,
            {
                sticker: buffer,
                ...metadata
            }
        );
    } catch (error) {
        logError(
            error,
            "sendBufferAsSticker"
        );
        return null;
    }
}

// ============================================================
// INPUT
// ============================================================

function question(text) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(
            text,
            answer => {
                rl.close();
                resolve(answer.trim());
            }
        );
    });
}

// ============================================================
// MESSAGE UNWRAPPING
// ============================================================

// ============================================================
// MESSAGE UNWRAPPING
// ============================================================

function unwrap(message) {
    if (!message) {
        return {};
    }

    if (message.ephemeralMessage?.message) {
        return unwrap(
            message.ephemeralMessage.message
        );
    }

    if (message.viewOnceMessage?.message) {
        return unwrap(
            message.viewOnceMessage.message
        );
    }

    if (message.viewOnceMessageV2?.message) {
        return unwrap(
            message.viewOnceMessageV2.message
        );
    }

    if (
        message.viewOnceMessageV2Extension?.message
    ) {
        return unwrap(
            message.viewOnceMessageV2Extension.message
        );
    }

    if (
        message.documentWithCaptionMessage?.message
    ) {
        return unwrap(
            message.documentWithCaptionMessage.message
        );
    }

    return message;
}

// ============================================================
// TEXT EXTRACTION
// ============================================================

function getText(msg) {
    if (!msg?.message) {
        return "";
    }

    const message =
        unwrap(msg.message);

    if (!message) {
        return "";
    }

    if (typeof message.conversation === "string") {
        return message.conversation.trim();
    }

    if (
        typeof message.extendedTextMessage?.text === "string"
    ) {
        return message.extendedTextMessage.text.trim();
    }

    if (
        typeof message.imageMessage?.caption === "string"
    ) {
        return message.imageMessage.caption.trim();
    }

    if (
        typeof message.videoMessage?.caption === "string"
    ) {
        return message.videoMessage.caption.trim();
    }

    if (
        typeof message.documentMessage?.caption === "string"
    ) {
        return message.documentMessage.caption.trim();
    }

    if (
        typeof message.buttonsResponseMessage?.selectedButtonId === "string"
    ) {
        return message.buttonsResponseMessage.selectedButtonId.trim();
    }

    if (
        typeof message.listResponseMessage
            ?.singleSelectReply
            ?.selectedRowId === "string"
    ) {
        return message.listResponseMessage
            .singleSelectReply
            .selectedRowId
            .trim();
    }

    if (
        typeof message.templateButtonReplyMessage?.selectedId === "string"
    ) {
        return message.templateButtonReplyMessage.selectedId.trim();
    }

    if (
        typeof message.interactiveResponseMessage
            ?.nativeFlowResponseMessage
            ?.paramsJson === "string"
    ) {
        try {
            const params =
                JSON.parse(
                    message.interactiveResponseMessage
                        .nativeFlowResponseMessage
                        .paramsJson
                );

            return (
                params.id ||
                params.button_id ||
                params.selected_id ||
                ""
            ).trim();

        } catch (_) {}
    }

    return "";
}

// ============================================================
// QUOTED MESSAGE
// ============================================================

function getQuoted(msg) {
    const message = unwrap(
        msg?.message
    );

    const context =
        message.extendedTextMessage?.contextInfo ||
        message.imageMessage?.contextInfo ||
        message.videoMessage?.contextInfo ||
        message.documentMessage?.contextInfo;

    if (!context?.quotedMessage) {
        return null;
    }

    return unwrap(
        context.quotedMessage
    );
}

function getMedia(quoted) {
    if (!quoted) return null;

    if (quoted.imageMessage) {
        return {
            type: "image",
            data: quoted.imageMessage,
            ext: "jpg"
        };
    }

    if (quoted.videoMessage) {
        return {
            type: "video",
            data: quoted.videoMessage,
            ext: "mp4"
        };
    }

    if (quoted.audioMessage) {
        return {
            type: "audio",
            data: quoted.audioMessage,
            ext: "mp3"
        };
    }

    if (quoted.stickerMessage) {
        return {
            type: "sticker",
            data: quoted.stickerMessage,
            ext: "webp"
        };
    }

    if (quoted.documentMessage) {
        return {
            type: "document",
            data: quoted.documentMessage,
            ext: "bin"
        };
    }

    return null;
}

// ============================================================
// COMMAND PARSER
// ============================================================

function parseCommand(text) {
    if (!text) return null;

    const trimmed = text.trim();

    if (
        !trimmed.startsWith(".") &&
        !trimmed.startsWith("!")
    ) {
        return null;
    }

    const body = trimmed
        .slice(1)
        .trim();

    if (!body) return null;

    const parts = body.split(/\s+/);

    const commandName = parts
        .shift()
        .toLowerCase();

    return {
        command: commandName,
        args: parts
    };
}

// ============================================================
// COMMAND SYSTEM
// ============================================================

const commands = {};

function command(
    name,
    handler,
    description = ""
) {
    commands[name] = {
        handler,
        description
    };
}

// ============================================================
// MENU
// ============================================================

command(
    "menu",
    async (msg, jid, sender) => {
        const commandsList =
            Object.keys(commands)
                .sort()
                .map(
                    name => `• .${name}`
                )
                .join("\n");

        const memory =
            process.memoryUsage();

        const totalMemory =
            os.totalmem();

        const usedMemory =
            memory.rss;

        let ram = Math.round(
            (usedMemory / totalMemory) * 100
        );

        ram = Math.max(
            0,
            Math.min(100, ram)
        );

        const bars = 10;

        const filled = Math.round(
            (ram / 100) * bars
        );

        const ramBar =
            "█".repeat(filled) +
            "░".repeat(
                bars - filled
            );

        let ramIcon = "🟢";

        if (ram >= 70) {
            ramIcon = "🟡";
        }

        if (ram >= 90) {
            ramIcon = "🔴";
        }

        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];

        const today =
            days[new Date().getDay()];

        const menuText =
`╭━━━『 bot 』━━━╮

👋 Hello @${cleanJid(sender)}!

⚡ Prefix: . !
📌 Version: ${VERSION}
👑 Owner: Cyrus
📦 Commands: ${Object.keys(commands).length}
🧠 RAM: ${ramIcon} [${ramBar}] ${ram}%
📅 ${today}
🏷️ Plan: 👑 Pro

╭━━━『 commands 』━━━╮

${commandsList}

╰━━━━━━━━━━━━━━━━╯`;

        const imagePath =
            path.join(
                __dirname,
                "image.jpeg"
            );

        try {
            if (
                fs.existsSync(imagePath) &&
                sock
            ) {
                await sock.sendMessage(
                    jid,
                    {
                        image:
                            fs.readFileSync(
                                imagePath
                            ),
                        caption: menuText,
                        mentions: [sender]
                    }
                );
            } else {
                await sendText(
                    jid,
                    menuText,
                    {
                        mentions: [sender]
                    }
                );
            }
        } catch (error) {
            logError(
                error,
                "menu"
            );

            await sendText(
                jid,
                menuText,
                {
                    mentions: [sender]
                }
            );
        }
    },
    "Show the CyrusBot menu."
);

// ============================================================
// HELP
// ============================================================

command(
    "help",
    async (msg, jid, sender, args) => {
        if (!args.length) {
            let text =
                `📖 *CYRUSBOT HELP*\n\n` +
                `Available commands:\n\n`;

            for (
                const name of Object.keys(commands).sort()
            ) {
                text +=
                    `.${name}\n`;
            }

            text +=
                `\nUse .help <command> for details.`;

            await sendText(
                jid,
                text
            );

            return;
        }

        const name =
            args[0].toLowerCase();

        const cmd =
            commands[name];

        if (!cmd) {
            await sendText(
                jid,
                `❌ Command .${name} not found.`
            );

            return;
        }

        await sendText(
            jid,
            `📖 *.${name}*\n\n` +
            `${cmd.description || "No description available."}`
        );
    },
    "Show command help."
);

// ============================================================
// PING
// ============================================================

command(
    "ping",
    async (msg, jid) => {
        const start = Date.now();

        try {
            const result =
                await sendText(
                    jid,
                    "🏓 Measuring..."
                );

            if (!result) {
                await sendText(
                    jid,
                    "❌ Failed to measure bot speed."
                );

                return;
            }

            const speed =
                Date.now() - start;

            let status = "Normal";
            let icon = "🟡";

            if (speed < 300) {
                status = "Fast";
                icon = "🟢";
            } else if (speed >= 1000) {
                status = "Slow";
                icon = "🔴";
            }

            const text =
`${icon} *Pong!*

⚡ *Speed:* ${speed}ms _(${status})_
⏱️ *Session:* ${uptime()}
🤖 *Bot:* Cyrus`;

            try {
                await sock.sendMessage(
                    jid,
                    {
                        text,
                        edit: result.key
                    }
                );
            } catch (_) {
                await sendText(
                    jid,
                    text
                );
            }

        } catch (error) {
            logError(
                error,
                "ping"
            );

            await sendText(
                jid,
                "❌ Failed to measure bot speed."
            );
        }
    },
    "Check CyrusBot response speed and session uptime."
);

// ============================================================
// STATS
// ============================================================

command(
    "stats",
    async (msg, jid) => {
        const memory =
            process.memoryUsage();

        const activeSchedules =
            schedules.filter(
                s => s.status === "active"
            ).length;

        await sendText(
            jid,
`📊 *CYRUSBOT STATS*

⏱️ Uptime: ${uptime()}
📨 Messages: ${messageCount}
⚡ Commands: ${commandCount}
📅 Schedules: ${activeSchedules}
💾 RAM: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB
🟢 Node: ${process.version}
🖥️ OS: ${process.platform}
📦 Commands: ${Object.keys(commands).length}`
        );
    },
    "Show bot statistics."
);

// ============================================================
// JID
// ============================================================

command(
    "jid",
    async (msg, jid, sender) => {
        await sendText(
            jid,
`📍 *JID INFORMATION*

Chat:
${jid}

Sender:
${sender}`
        );
    },
    "Show the current chat JID."
);

// ============================================================
// GROUP INFO
// ============================================================

command(
    "groupinfo",
    async (msg, jid) => {
        if (!isGroup(jid)) {
            await sendText(
                jid,
                "❌ This command only works in groups."
            );

            return;
        }

        try {
            const metadata =
                await sock.groupMetadata(jid);

            const admins =
                metadata.participants.filter(
                    p =>
                        p.admin === "admin" ||
                        p.admin === "superadmin" ||
                        p.admin
                );

            await sendText(
                jid,
`📊 *GROUP INFO*

📌 Name:
${metadata.subject || "Unknown"}

👥 Members:
${metadata.participants.length}

👑 Admins:
${admins.length}

🆔 JID:
${jid}

📝 Description:
${metadata.desc || "None"}`
            );

        } catch (error) {
            logError(
                error,
                "groupinfo"
            );

            await sendText(
                jid,
                "❌ Failed to get group information."
            );
        }
    },
    "Show group information."
);

// ============================================================
// ADMINS
// ============================================================

command(
    "admins",
    async (msg, jid) => {
        if (!isGroup(jid)) {
            await sendText(
                jid,
                "❌ This command only works in groups."
            );

            return;
        }

        try {
            const metadata =
                await sock.groupMetadata(jid);

            const admins =
                metadata.participants.filter(
                    p =>
                        p.admin === "admin" ||
                        p.admin === "superadmin" ||
                        p.admin
                );

            if (!admins.length) {
                await sendText(
                    jid,
                    "❌ No admins found."
                );

                return;
            }

            const mentions =
                admins.map(
                    p => p.id
                );

            const text =
                `👑 *GROUP ADMINS*\n\n` +
                admins
                    .map(
                        p =>
                            `• @${cleanJid(p.id)}`
                    )
                    .join("\n");

            await sendText(
                jid,
                text,
                { mentions }
            );

        } catch (error) {
            logError(
                error,
                "admins"
            );

            await sendText(
                jid,
                "❌ Failed to get admins."
            );
        }
    },
    "List group admins."
);

// ============================================================
// STICKER
// ============================================================

command(
    "sticker",
    async (msg, jid) => {
        const quoted =
            getQuoted(msg);

        const media =
            getMedia(quoted);

        if (!media) {
            await sendText(
                jid,
                "❌ Reply to an image or video with .sticker."
            );

            return;
        }

        if (
            media.type !== "image" &&
            media.type !== "video"
        ) {
            await sendText(
                jid,
                "❌ Only images and videos can be converted to stickers."
            );

            return;
        }

        if (
            media.type === "video" &&
            Number(media.data.seconds || 0) > 10
        ) {
            await sendText(
                jid,
                "❌ Video must be 10 seconds or less."
            );

            return;
        }

        try {
            await sendText(
                jid,
                "⏳ Creating sticker..."
            );

            const stream =
                await downloadContentFromMessage(
                    media.data,
                    media.type
                );

            const chunks = [];

            for await (
                const chunk of stream
            ) {
                chunks.push(chunk);
            }

            const buffer =
                Buffer.concat(chunks);

            if (!buffer.length) {
                throw new Error(
                    "Downloaded media is empty."
                );
            }

            const webp =
                await convertToStickerBuffer({
                    type: media.type,
                    buffer
                });

            const sent =
                await sendBufferAsSticker(
                    jid,
                    webp
                );

            if (!sent) {
                throw new Error(
                    "Sticker could not be sent."
                );
            }

            await sendText(
                jid,
                "✅ Sticker sent."
            );

        } catch (error) {
            logError(
                error,
                "sticker"
            );

            await sendText(
                jid,
                "❌ Failed to convert/send sticker."
            );
        }
    },
    "Convert a replied image or short video to a sticker."
);

// ============================================================
// TAG ADMINS
// ============================================================

command(
    "tagadmins",
    async (msg, jid, sender, args) => {
        if (!isGroup(jid)) {
            await sendText(
                jid,
                "❌ This command only works in groups."
            );

            return;
        }

        try {
            const metadata =
                await sock.groupMetadata(jid);

            const admins =
                metadata.participants.filter(
                    p =>
                        p.admin === "admin" ||
                        p.admin === "superadmin" ||
                        p.admin
                );

            if (!admins.length) {
                await sendText(
                    jid,
                    "❌ No admins found."
                );

                return;
            }

            const mentions =
                admins.map(
                    p => p.id
                );

            let text =
                "👑 *GROUP ADMINS*\n\n";

            text += admins
                .map(
                    p =>
                        `• @${cleanJid(p.id)}`
                )
                .join("\n");

            if (args.length) {
                text +=
                    `\n\n📢 ${args.join(" ")}`;
            }

            await sendText(
                jid,
                text,
                { mentions }
            );

        } catch (error) {
            logError(
                error,
                "tagadmins"
            );

            await sendText(
                jid,
                "❌ Failed to tag admins."
            );
        }
    },
    "Tag all group administrators."
);

// ============================================================
// LOGS
// ============================================================

command(
    "logs",
    async (msg, jid) => {
        if (!ownerOnly(
            getSender(msg, jid)
        )) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        const file =
            path.join(
                LOG_DIR,
                "commands.log"
            );

        if (!fs.existsSync(file)) {
            await sendText(
                jid,
                "📭 No command logs found."
            );

            return;
        }

        try {
            const lines =
                fs.readFileSync(
                    file,
                    "utf8"
                )
                .split("\n")
                .filter(Boolean);

            if (!lines.length) {
                await sendText(
                    jid,
                    "📭 No command logs found."
                );

                return;
            }

            const recent =
                lines
                    .slice(-20)
                    .join("\n");

            const output =
                `📋 *RECENT COMMAND LOGS*\n\n${recent}`;

            await sendText(
                jid,
                output.length > 4000
                    ? output.substring(
                        0,
                        4000
                    ) + "\n..."
                    : output
            );

        } catch (error) {
            logError(
                error,
                "logs"
            );

            await sendText(
                jid,
                "❌ Failed to read logs."
            );
        }
    },
    "Show the last 20 command logs."
);

// ============================================================
// MENTION ALL
// ============================================================

command(
    "mentionall",
    async (msg, jid, sender, args) => {
        if (!isGroup(jid)) {
            await sendText(
                jid,
                "❌ This command only works in groups."
            );

            return;
        }

        try {
            const metadata =
                await sock.groupMetadata(jid);

            const members =
                metadata.participants;

            if (!members.length) {
                await sendText(
                    jid,
                    "❌ No members found."
                );

                return;
            }

            if (members.length > 100) {
                confirmationMap.set(
                    `${jid}:${sender}`,
                    {
                        args,
                        expires:
                            Date.now() + 30000
                    }
                );

                await sendText(
                    jid,
`⚠️ This group has ${members.length} members.

Reply with *yes* within 30 seconds to continue.`
                );

                return;
            }

            await mentionEveryone(
                jid,
                members,
                args
            );

        } catch (error) {
            logError(
                error,
                "mentionall"
            );

            await sendText(
                jid,
                "❌ Failed to mention members."
            );
        }
    },
    "Mention all group members."
);

async function mentionEveryone(
    jid,
    members,
    args
) {
    const mentions =
        members.map(
            p => p.id
        );

    const extra =
        args.length
            ? `${args.join(" ")}\n\n`
            : "";

    const text =
        `📢 *EVERYONE*\n\n` +
        extra +
        mentions
            .map(
                id =>
                    `@${cleanJid(id)}`
            )
            .join(" ");

    await sendText(
        jid,
        text,
        { mentions }
    );
}

// ============================================================
// SET AUTO REPLY
// ============================================================

command(
    "setautoreply",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args.length) {
            await sendText(
                jid,
                "Usage:\n.setautoreply Your message"
            );

            return;
        }

        config.autoReply =
            args.join(" ");

        if (!writeJSON(
            CONFIG_FILE,
            config
        )) {
            await sendText(
                jid,
                "❌ Failed to save auto-reply."
            );

            return;
        }

        await sendText(
            jid,
            "✅ Auto-reply updated."
        );
    },
    "Change the auto-reply message."
);

// ============================================================
// AUTO REPLY TOGGLE
// ============================================================

command(
    "autoreply",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args.length) {
            await sendText(
                jid,
`🤖 *AUTO-REPLY*

Status:
${config.autoReplyEnabled ? "🟢 ON" : "🔴 OFF"}

Message:
${config.autoReply}`
            );

            return;
        }

        const option =
            args[0].toLowerCase();

        if (
            option !== "on" &&
            option !== "off"
        ) {
            await sendText(
                jid,
                "Usage: .autoreply on/off"
            );

            return;
        }

        config.autoReplyEnabled =
            option === "on";

        if (!writeJSON(
            CONFIG_FILE,
            config
        )) {
            await sendText(
                jid,
                "❌ Failed to save auto-reply setting."
            );

            return;
        }

        await sendText(
            jid,
            `✅ Auto-reply ${option}.`
        );
    },
    "Turn auto-reply on or off."
);

// ============================================================
// GROUP MODE
// ============================================================

command(
    "groupmode",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args.length) {
            await sendText(
                jid,
`👥 *GROUP MODE*

Status:
${config.groupMode ? "🟢 ON" : "🔴 OFF"}`
            );

            return;
        }

        const option =
            args[0].toLowerCase();

        if (
            option !== "on" &&
            option !== "off"
        ) {
            await sendText(
                jid,
                "Usage: .groupmode on/off"
            );

            return;
        }

        config.groupMode =
            option === "on";

        if (!writeJSON(
            CONFIG_FILE,
            config
        )) {
            await sendText(
                jid,
                "❌ Failed to save group mode."
            );

            return;
        }

        await sendText(
            jid,
            `✅ Group mode ${option}.`
        );
    },
    "Turn group auto-reply on or off."
);

// ============================================================
// SAVE MEDIA
// ============================================================

command(
    "save",
    async (msg, jid) => {
        const quoted =
            getQuoted(msg);

        const media =
            getMedia(quoted);

        if (!media) {
            await sendText(
                jid,
                "❌ Reply to an image, video, audio, sticker, or document."
            );

            return;
        }

        try {
            const stream =
                await downloadContentFromMessage(
                    media.data,
                    media.type
                );

            const chunks = [];

            for await (
                const chunk of stream
            ) {
                chunks.push(chunk);
            }

            const buffer =
                Buffer.concat(chunks);

            if (!buffer.length) {
                throw new Error(
                    "Downloaded media is empty."
                );
            }

            const filename =
                `media_${Date.now()}.${media.ext}`;

            const filePath =
                path.join(
                    DOWNLOAD_DIR,
                    filename
                );

            fs.writeFileSync(
                filePath,
                buffer
            );

            await sendText(
                jid,
`✅ *MEDIA SAVED*

📁 ${filename}
💾 ${(buffer.length / 1024).toFixed(1)} KB`
            );

        } catch (error) {
            logError(
                error,
                "save"
            );

            await sendText(
                jid,
                "❌ Failed to save media."
            );
        }
    },
    "Save replied media."
);

// ============================================================
// SCHEDULER
// ============================================================

function saveSchedules() {
    return writeJSON(
        SCHEDULE_FILE,
        schedules
    );
}

function stopSchedules() {
    for (
        const job of scheduledJobs.values()
    ) {
        try {
            job.stop();
        } catch (_) {}
    }

    scheduledJobs.clear();
}

function loadSchedules() {
    stopSchedules();

    for (
        const schedule of schedules
    ) {
        if (
            schedule.status !== "active"
        ) {
            continue;
        }

        if (
            !cron.validate(
                schedule.cron
            )
        ) {
            console.log(
                `⚠️ Invalid cron for schedule ${schedule.id}`
            );

            continue;
        }

        try {
            const job =
                cron.schedule(
                    schedule.cron,
                    async () => {
                        if (!sock) return;

                        try {
                            await sendText(
                                schedule.destination,
                                schedule.message
                            );
                        } catch (error) {
                            logError(
                                error,
                                `Schedule ${schedule.id}`
                            );
                        }
                    },
                    {
                        timezone:
                            schedule.timezone ||
                            TIMEZONE
                    }
                );

            scheduledJobs.set(
                schedule.id,
                job
            );

        } catch (error) {
            logError(
                error,
                `Loading schedule ${schedule.id}`
            );
        }
    }
}

function makeScheduleId() {
    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2, 7)
    );
}

// ============================================================
// SET MESSAGE
// ============================================================

command(
    "setmessage",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        const text =
            args.join(" ");

        const match =
            text.match(
                /^"(.+)"\s+(\d{1,2}:\d{2})\s*(AM|PM)\s+(.+)$/i
            );

        if (!match) {
            await sendText(
                jid,
`❌ Usage:

.setmessage "Your message" 08:00 AM 2348012345678@s.whatsapp.net`
            );

            return;
        }

        const message =
            match[1];

        const time =
            match[2];

        const hour =
            Number(
                time.split(":")[0]
            );

        const minute =
            Number(
                time.split(":")[1]
            );

        const period =
            match[3].toUpperCase();

        const destination =
            match[4].trim();

        if (
            !destination.endsWith(
                "@s.whatsapp.net"
            ) &&
            !destination.endsWith(
                "@g.us"
            )
        ) {
            await sendText(
                jid,
                "❌ Invalid destination JID."
            );

            return;
        }

        if (
            hour < 1 ||
            hour > 12 ||
            minute < 0 ||
            minute > 59
        ) {
            await sendText(
                jid,
                "❌ Invalid time."
            );

            return;
        }

        let h = hour;

        if (
            period === "PM" &&
            h !== 12
        ) {
            h += 12;
        }

        if (
            period === "AM" &&
            h === 12
        ) {
            h = 0;
        }

        const schedule = {
            id: makeScheduleId(),
            message,
            destination,
            cron:
                `${minute} ${h} * * *`,
            time:
                `${time} ${period}`,
            timezone: TIMEZONE,
            status: "active",
            createdAt:
                new Date().toISOString()
        };

        schedules.push(
            schedule
        );

        if (!saveSchedules()) {
            schedules.pop();

            await sendText(
                jid,
                "❌ Failed to save schedule."
            );

            return;
        }

        loadSchedules();

        await sendText(
            jid,
`✅ *SCHEDULE CREATED*

🆔 ${schedule.id}
📝 ${message}
🕐 ${schedule.time}
📱 ${schedule.destination}
🌍 ${schedule.timezone}`
        );
    },
    "Create a daily scheduled message."
);

// ============================================================
// LIST MESSAGES
// ============================================================

command(
    "listmessages",
    async (msg, jid) => {
        if (!ownerOnly(
            getSender(msg, jid)
        )) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!schedules.length) {
            await sendText(
                jid,
                "📭 No scheduled messages."
            );

            return;
        }

        let text =
            "📅 *SCHEDULES*\n\n";

        for (
            const item of schedules
        ) {
            text +=
                `🆔 ${item.id}\n` +
                `📝 ${item.message}\n` +
                `🕐 ${item.time}\n` +
                `📱 ${item.destination}\n` +
                `📊 ${item.status}\n\n`;
        }

        if (text.length > 4000) {
            text =
                text.substring(
                    0,
                    4000
                ) +
                "\n...";
        }

        await sendText(
            jid,
            text
        );
    },
    "List scheduled messages."
);

// ============================================================
// DELETE MESSAGE
// ============================================================

command(
    "delmessage",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args[0]) {
            await sendText(
                jid,
                "Usage: .delmessage <id>"
            );

            return;
        }

        const oldLength =
            schedules.length;

        schedules =
            schedules.filter(
                s =>
                    s.id !== args[0]
            );

        if (
            schedules.length ===
            oldLength
        ) {
            await sendText(
                jid,
                "❌ Schedule not found."
            );

            return;
        }

        if (!saveSchedules()) {
            await sendText(
                jid,
                "❌ Failed to save changes."
            );

            return;
        }

        loadSchedules();

        await sendText(
            jid,
            "✅ Schedule deleted."
        );
    },
    "Delete a scheduled message."
);

// ============================================================
// PAUSE MESSAGE
// ============================================================

command(
    "pausemessage",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args[0]) {
            await sendText(
                jid,
                "Usage: .pausemessage <id>"
            );

            return;
        }

        const item =
            schedules.find(
                s =>
                    s.id === args[0]
            );

        if (!item) {
            await sendText(
                jid,
                "❌ Schedule not found."
            );

            return;
        }

        if (
            item.status === "paused"
        ) {
            await sendText(
                jid,
                "ℹ️ Schedule is already paused."
            );

            return;
        }

        item.status = "paused";

        if (!saveSchedules()) {
            await sendText(
                jid,
                "❌ Failed to save changes."
            );

            return;
        }

        loadSchedules();

        await sendText(
            jid,
            "⏸️ Schedule paused."
        );
    },
    "Pause a scheduled message."
);

// ============================================================
// RESUME MESSAGE
// ============================================================

command(
    "resumemessage",
    async (msg, jid, sender, args) => {
        if (!ownerOnly(sender)) {
            await sendText(
                jid,
                "❌ Owner only."
            );

            return;
        }

        if (!args[0]) {
            await sendText(
                jid,
                "Usage: .resumemessage <id>"
            );

            return;
        }

        const item =
            schedules.find(
                s =>
                    s.id === args[0]
            );

        if (!item) {
            await sendText(
                jid,
                "❌ Schedule not found."
            );

            return;
        }

        if (
            item.status === "active"
        ) {
            await sendText(
                jid,
                "ℹ️ Schedule is already active."
            );

            return;
        }

        item.status = "active";

        if (!saveSchedules()) {
            await sendText(
                jid,
                "❌ Failed to save changes."
            );

            return;
        }

        loadSchedules();

        await sendText(
            jid,
            "▶️ Schedule resumed."
        );
    },
    "Resume a paused scheduled message."
);

// ============================================================
// MESSAGE CACHE
// ============================================================

function cacheMessage(
    msg,
    jid,
    sender
) {
    const id =
        msg.key?.id;

    if (!id) return;

    const message =
        unwrap(msg.message);

    let mediaType = "";

    if (message.imageMessage) {
        mediaType = "image";
    } else if (message.videoMessage) {
        mediaType = "video";
    } else if (message.audioMessage) {
        mediaType = "audio";
    } else if (message.stickerMessage) {
        mediaType = "sticker";
    } else if (message.documentMessage) {
        mediaType = "document";
    }

    messageCache.set(
        id,
        {
            jid,
            sender,
            text:
                getText(msg),
            mediaType,
            time: Date.now()
        }
    );

    while (
        messageCache.size > 500
    ) {
        const first =
            messageCache.keys()
                .next()
                .value;

        messageCache.delete(
            first
        );
    }
}

// ============================================================
// DELETE MESSAGE HANDLER
// ============================================================

async function handleDelete(msg) {
    const message =
        unwrap(msg?.message);

    const protocol =
        message.protocolMessage;

    if (
        !protocol ||
        protocol.type !== 0
    ) {
        return false;
    }

    const id =
        protocol.key?.id;

    if (!id) return true;

    const cached =
        messageCache.get(id);

    if (!cached) {
        return true;
    }

    const content =
        cached.text ||
        (
            cached.mediaType
                ? `[${cached.mediaType}]`
                : "[message]"
        );

    await sendText(
        OWNER_JID,
`🗑️ *MESSAGE DELETED*

👤 From:
${cached.sender}

💬 Chat:
${cached.jid}

📝 Message:
${content}`
    );

    messageCache.delete(
        id
    );

    return true;
}

// ============================================================
// AUTO REPLY - NOW REPLIES TO EVERY MESSAGE (except owner)
// ============================================================

async function autoReply(
    msg,
    jid,
    sender
) {
    if (
        !config.autoReplyEnabled
    ) {
        return;
    }

    if (isOwner(sender)) {
        return;   // owner doesn't get auto-reply
    }

    if (
        isGroup(jid) &&
        !config.groupMode
    ) {
        return;
    }

    // Removed the "cyrus" and mention checks – now replies to all
    await sendText(
        jid,
        config.autoReply,
        {
            mentions: [sender]
        }
    );
}

// ============================================================
// CONFIRMATION HANDLER
// ============================================================

async function handleConfirmation(
    msg,
    jid,
    sender,
    text
) {
    const key =
        `${jid}:${sender}`;

    const confirmation =
        confirmationMap.get(key);

    if (!confirmation) {
        return false;
    }

    if (
        Date.now() >
        confirmation.expires
    ) {
        confirmationMap.delete(key);
        return false;
    }

    const answer =
        text.trim().toLowerCase();

    if (
        answer === "yes" ||
        answer === "y"
    ) {
        confirmationMap.delete(
            key
        );

        try {
            const metadata =
                await sock.groupMetadata(
                    jid
                );

            await mentionEveryone(
                jid,
                metadata.participants,
                confirmation.args
            );
        } catch (error) {
            logError(
                error,
                "mentionall confirmation"
            );

            await sendText(
                jid,
                "❌ Failed to mention members."
            );
        }

        return true;
    }

    if (
        answer === "no" ||
        answer === "n" ||
        answer === "cancel"
    ) {
        confirmationMap.delete(
            key
        );

        await sendText(
            jid,
            "❌ Mention-all cancelled."
        );

        return true;
    }

    return false;
}

// ============================================================
// CLEAN OLD CONFIRMATIONS
// ============================================================

setInterval(
    () => {
        const now =
            Date.now();

        for (
            const [
                key,
                value
            ] of confirmationMap
        ) {
            if (
                now > value.expires
            ) {
                confirmationMap.delete(
                    key
                );
            }
        }
    },
    10000
);

// ============================================================
// MESSAGE HANDLER
// ============================================================

// ============================================================
// MESSAGE HANDLER
// ============================================================

function setupMessages(socket) {
    socket.ev.on(
        "messages.upsert",
        async ({ messages, type }) => {

            if (type !== "notify") {
                return;
            }

            for (const msg of messages) {
                try {
                    if (!msg || !msg.message) {
                        continue;
                    }

                    const jid =
                        msg.key?.remoteJid;

                    if (!jid) {
                        continue;
                    }

                    // Only handle private chats and groups
                    if (
                        !jid.endsWith("@s.whatsapp.net") &&
                        !jid.endsWith("@g.us")
                    ) {
                        continue;
                    }

                    // ------------------------------------------------
                    // IGNORE MESSAGES SENT BY THE BOT/OWNER
                    // ------------------------------------------------

                    if (msg.key?.fromMe) {
                        console.log(
                            "⏭️ Ignoring fromMe message."
                        );
                        continue;
                    }

                    // ------------------------------------------------
                    // UNWRAP MESSAGE
                    // ------------------------------------------------

                    const message =
                        unwrap(msg.message);

                    // ------------------------------------------------
                    // HANDLE DELETED MESSAGE
                    // ------------------------------------------------

                    if (
                        message?.protocolMessage
                    ) {
                        await handleDelete(msg);
                        continue;
                    }

                    // ------------------------------------------------
                    // EXTRACT TEXT
                    // ------------------------------------------------

                    const text =
                        getText(msg);

                    // ------------------------------------------------
                    // GET SENDER
                    // ------------------------------------------------

                    const sender =
                        getSender(
                            msg,
                            jid
                        );

                    // ------------------------------------------------
                    // TERMINAL LOG
                    // ------------------------------------------------

                    console.log(
                        "\n╭───────────────"
                    );

                    console.log(
                        "📨 MESSAGE RECEIVED"
                    );

                    console.log(
                        "💬 Chat:",
                        jid
                    );

                    console.log(
                        "👤 Sender:",
                        sender
                    );

                    console.log(
                        "🤖 FromMe:",
                        !!msg.key?.fromMe
                    );

                    console.log(
                        "📝 Text:",
                        text || "[no text]"
                    );

                    console.log(
                        "╰───────────────"
                    );

                    messageCount++;

                    // ------------------------------------------------
                    // CACHE MESSAGE
                    // ------------------------------------------------

                    cacheMessage(
                        msg,
                        jid,
                        sender
                    );

                    // No text = nothing to process
                    if (!text) {
                        continue;
                    }

                    // ------------------------------------------------
                    // PARSE COMMAND
                    // ------------------------------------------------

                    const parsed =
                        parseCommand(text);

                    console.log(
                        "🔎 Parsed:",
                        parsed
                    );

                    // ------------------------------------------------
                    // HANDLE CONFIRMATIONS
                    // ------------------------------------------------

                    if (!parsed) {
                        const handled =
                            await handleConfirmation(
                                msg,
                                jid,
                                sender,
                                text
                            );

                        if (handled) {
                            continue;
                        }
                    }

                    // ------------------------------------------------
                    // COMMAND EXECUTION
                    // ------------------------------------------------

                    if (parsed) {

                        const {
                            command: commandName,
                            args
                        } = parsed;

                        const cmd =
                            commands[
                                commandName
                            ];

                        if (!cmd) {
                            console.log(
                                `❌ Unknown command: ${commandName}`
                            );

                            await sendText(
                                jid,
                                `❌ Unknown command: .${commandName}\n\nUse .menu`
                            );

                            continue;
                        }

                        console.log(
                            `\n⚡ Executing: ${commandName}`
                        );

                        commandCount++;

                        logCommand(
                            sender,
                            commandName
                        );

                        try {

                            await cmd.handler(
                                msg,
                                jid,
                                sender,
                                args
                            );

                            console.log(
                                `✅ Executed: ${commandName}`
                            );

                        } catch (error) {

                            logError(
                                error,
                                `Command ${commandName}`
                            );

                            console.error(
                                `❌ Command ${commandName} failed:`,
                                error
                            );

                            await sendText(
                                jid,
                                `❌ .${commandName} failed.`
                            );
                        }

                        continue;
                    }

                    // ------------------------------------------------
                    // NORMAL MESSAGE → AUTO REPLY
                    // ------------------------------------------------

                    await autoReply(
                        msg,
                        jid,
                        sender
                    );

                } catch (error) {

                    logError(
                        error,
                        "messages.upsert"
                    );

                    console.error(
                        "❌ MESSAGE HANDLER ERROR:",
                        error
                    );
                }
            }
        }
    );
}

// ============================================================
// STICKER CONVERSION
// ============================================================

if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(
        ffmpegStatic
    );
}

async function convertToStickerBuffer(
    streamInfo
) {
    if (
        streamInfo.type === "image"
    ) {
        return await sharp(
            streamInfo.buffer
        )
            .rotate()
            .resize(
                512,
                512,
                {
                    fit: "inside",
                    withoutEnlargement: false
                }
            )
            .webp({
                lossless: true
            })
            .toBuffer();
    }

    if (
        streamInfo.type === "video"
    ) {
        if (!ffmpegStatic) {
            throw new Error(
                "ffmpeg-static is not available."
            );
        }

        const id =
            `${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}`;

        const tmpIn =
            path.join(
                DOWNLOAD_DIR,
                `sticker_in_${id}.mp4`
            );

        const tmpOut =
            path.join(
                DOWNLOAD_DIR,
                `sticker_out_${id}.webp`
            );

        fs.writeFileSync(
            tmpIn,
            streamInfo.buffer
        );

        return new Promise(
            (resolve, reject) => {
                ffmpeg(tmpIn)
                    .inputOptions([
                        "-t 10"
                    ])
                    .outputOptions([
                        "-vcodec libwebp",
                        "-vf scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,fps=15",
                        "-loop 0",
                        "-preset default",
                        "-an",
                        "-vsync 0"
                    ])
                    .duration(10)
                    .format("webp")
                    .save(tmpOut)
                    .on(
                        "end",
                        () => {
                            try {
                                if (
                                    !fs.existsSync(
                                        tmpOut
                                    )
                                ) {
                                    throw new Error(
                                        "FFmpeg output was not created."
                                    );
                                }

                                const buffer =
                                    fs.readFileSync(
                                        tmpOut
                                    );

                                try {
                                    fs.unlinkSync(
                                        tmpIn
                                    );
                                } catch (_) {}

                                try {
                                    fs.unlinkSync(
                                        tmpOut
                                    );
                                } catch (_) {}

                                resolve(
                                    buffer
                                );

                            } catch (error) {
                                reject(
                                    error
                                );
                            }
                        }
                    )
                    .on(
                        "error",
                        error => {
                            try {
                                fs.unlinkSync(
                                    tmpIn
                                );
                            } catch (_) {}

                            try {
                                fs.unlinkSync(
                                    tmpOut
                                );
                            } catch (_) {}

                            reject(
                                error
                            );
                        }
                    );
            }
        );
    }

    throw new Error(
        "Unsupported media type."
    );
}

// ============================================================
// CONNECTION
// ============================================================

function resetSocketState() {
    if (sock && typeof sock.end === "function") {
        try {
            sock.end(
                new Error(
                    "Reinitializing WhatsApp session"
                )
            );
        } catch (_) {}
    }

    sock = null;
    connecting = false;
}

function resetAuthSession(reason = "session reset") {
    try {
        console.log(
            `\n🧹 Clearing stale auth session: ${reason}`
        );

        if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(
                AUTH_DIR,
                {
                    recursive: true,
                    force: true
                }
            );
        }

        fs.mkdirSync(
            AUTH_DIR,
            {
                recursive: true
            }
        );
    } catch (error) {
        logError(
            error,
            "resetAuthSession"
        );
    }
}

async function startBot() {
    if (
        connecting ||
        shuttingDown
    ) {
        return;
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    connecting = true;

    try {
        const {
            state,
            saveCreds
        } =
            await useMultiFileAuthState(
                AUTH_DIR
            );

        if (sock && typeof sock.end === "function") {
            try {
                sock.end(
                    new Error(
                        "Socket replaced"
                    )
                );
            } catch (_) {}
        }

        const socket =
            makeWASocket({
                auth: state,

                logger: pino({
                    level: "silent"
                }),

                browser:
                    Browsers.windows(
                        BOT_NAME
                    ),

                printQRInTerminal: false,

                markOnlineOnConnect: false,

                syncFullHistory: false,

                shouldIgnoreJid: jid =>
                    jid === "status@broadcast"
            });

        sock = socket;

        socket.ev.on(
            "creds.update",
            saveCreds
        );

        setupMessages(
            socket
        );

        socket.ev.on(
            "connection.update",
            async update => {
                const {
                    connection,
                    lastDisconnect,
                    qr,
                    isNewLogin
                } = update;

                if (qr) {
                    console.log(
                        "\n📱 Scan this QR with WhatsApp:\n"
                    );
                    qrcode.generate(
                        qr,
                        {
                            small: true
                        }
                    );
                }

                if (isNewLogin) {
                    console.log(
                        "\n✅ Pairing successful."
                    );
                    console.log(
                        "🔄 Restarting WhatsApp connection..."
                    );
                }

                if (
                    connection === "connecting"
                ) {
                    connecting = true;
                    return;
                }

                if (
                    connection === "open"
                ) {
                    connecting = false;
                    reconnectAttempts = 0;

                    console.log(
                        "\n╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮"
                    );
                    console.log(
                        "┃   ✅ WHATSAPP CONNECTED    ┃"
                    );
                    console.log(
                        "┃   🤖 CYRUSBOT IS ONLINE    ┃"
                    );
                    console.log(
                        "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
                    );
                    console.log(
                        `👤 Owner: ${OWNER_JID}`
                    );
                    console.log(
                        `📌 Version: ${VERSION}`
                    );
                    console.log(
                        `📦 Commands: ${Object.keys(commands).length}`
                    );
                    console.log(
                        `📅 Active schedules: ${
                            schedules.filter(
                                s =>
                                    s.status === "active"
                            ).length
                        }`
                    );

                    loadSchedules();

                    return;
                }

                if (
                    connection === "close"
                ) {
                    connecting = false;

                    const code =
                        lastDisconnect
                            ?.error
                            ?.output
                            ?.statusCode;

                    console.log(
                        `\n⚠️ Connection closed. Code: ${
                            code || "unknown"
                        }`
                    );

                    if (
                        code ===
                            DisconnectReason.restartRequired ||
                        code === 515 ||
                        code === 428 ||
                        code === 408 ||
                        code === 500 ||
                        code === 503
                    ) {
                        console.log(
                            "🔄 Restart required or temporary network issue."
                        );

                        if (
                            reconnectAttempts >= 3
                        ) {
                            console.log(
                                "⚠️ Too many reconnect failures. Resetting auth state."
                            );
                            resetAuthSession(
                                "reconnect retry exhaustion"
                            );
                        }

                        sock = null;
                        reconnect(
                            1500
                        );
                        return;
                    }

                    if (
                        code ===
                        DisconnectReason.loggedOut
                    ) {
                        console.log(
                            "\n❌ WhatsApp logged out."
                        );
                        console.log(
                            "Delete auth_info only if you want to pair again."
                        );
                        resetAuthSession(
                            "logged out"
                        );
                        sock = null;
                        return;
                    }

                    if (
                        reconnectAttempts >= 5
                    ) {
                        console.log(
                            "⚠️ Session is unstable. Clearing auth and pairing again."
                        );
                        resetAuthSession(
                            "unstable session"
                        );
                    }

                    sock = null;
                    reconnectAttempts++;
                    const delay =
                        Math.min(
                            1500 *
                                reconnectAttempts,
                            20000
                        );
                    reconnect(
                        delay
                    );
                }
            }
        );

        if (
            !state.creds.registered
        ) {
            console.log(
                "\n╭━━━━━━━━━━━━━━━━━━━━━━╮"
            );
            console.log(
                "┃     CYRUSBOT LOGIN   ┃"
            );
            console.log(
                "╰━━━━━━━━━━━━━━━━━━━━━━╯\n"
            );
            console.log(
                "1. Pair with phone number"
            );
            console.log(
                "2. Use QR code"
            );

            const option =
                await question(
                    "\nChoose an option: "
                );

            if (
                option === "1"
            ) {
                let phone =
                    await question(
                        "Enter WhatsApp number (e.g. 2348012345678): "
                    );
                phone =
                    phone.replace(
                        /\D/g,
                        ""
                    );
                if (!phone) {
                    throw new Error(
                        "Invalid phone number."
                    );
                }

                console.log(
                    "\n🔑 Requesting pairing code..."
                );
                const code =
                    await socket.requestPairingCode(
                        phone
                    );
                console.log(
                    "\n╭━━━━━━━━━━━━━━━━━━━━━━╮"
                );
                console.log(
                    "┃    🔑 PAIRING CODE   ┃"
                );
                console.log(
                    "╰━━━━━━━━━━━━━━━━━━━━━━╯"
                );
                console.log(
                    `\n       ${code}\n`
                );
                console.log(
                    "Enter this code in WhatsApp:"
                );
                console.log(
                    "WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number"
                );
                console.log(
                    "\n⏳ Waiting for WhatsApp..."
                );

            } else {
                console.log(
                    "\n📱 Waiting for QR code..."
                );
            }

        } else {
            console.log(
                "\n🔐 Existing WhatsApp session found."
            );
            console.log(
                "🔄 Connecting CyrusBot..."
            );
        }

    } catch (error) {
        connecting = false;
        logError(
            error,
            "startBot"
        );
        console.log(
            "\n❌ Failed to start bot:"
        );
        console.log(
            error.message
        );
        if (!shuttingDown) {
            reconnect(
                10000
            );
        }
    }
}

// ============================================================
// RECONNECT
// ============================================================

function reconnect(delay) {
    if (
        reconnectTimer ||
        shuttingDown
    ) {
        return;
    }

    console.log(
        `🔄 Reconnecting in ${Math.ceil(
            delay / 1000
        )} seconds...`
    );

    reconnectTimer =
        setTimeout(
            async () => {
                reconnectTimer =
                    null;
                await startBot();
            },
            delay
        );
}

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown(signal) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    console.log(
        `\n🛑 ${signal} received.`
    );

    if (reconnectTimer) {
        clearTimeout(
            reconnectTimer
        );
        reconnectTimer = null;
    }

    stopSchedules();

    try {
        if (sock) {
            sock.end(
                new Error(
                    "Bot shutting down"
                )
            );
        }
    } catch (_) {}

    console.log(
        "✅ CyrusBot stopped."
    );
    process.exit(0);
}

// ============================================================
// PROCESS ERROR HANDLERS
// ============================================================

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "uncaughtException",
    error => {
        logError(
            error,
            "Uncaught exception"
        );
        connecting = false;
        if (!shuttingDown) {
            reconnect(5000);
        }
    }
);

process.on(
    "unhandledRejection",
    error => {
        logError(
            error,
            "Unhandled rejection"
        );
        connecting = false;
        if (!shuttingDown) {
            reconnect(5000);
        }
    }
);

// ============================================================
// START
// ============================================================

console.log(`
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
┃       🤖 CYRUSBOT          ┃
┃          v${VERSION}          ┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
`);

console.log(
    `📦 Loaded commands: ${Object.keys(commands).length}`
);

console.log(
    "🚀 Starting..."
);

startBot();