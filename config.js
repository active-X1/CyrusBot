const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;

const AUTH_DIR = path.join(ROOT_DIR, "auth");
const SESSIONS_DIR = path.join(ROOT_DIR, "sessions");
const DOWNLOAD_DIR = path.join(ROOT_DIR, "downloads");
const TEMP_DIR = path.join(ROOT_DIR, "temp");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const DATABASE_DIR = path.join(ROOT_DIR, "database");
const MEDIA_DIR = path.join(ROOT_DIR, "media");

const CONFIG_FILE = path.join(ROOT_DIR, "config.json");
const SCHEDULE_FILE = path.join(ROOT_DIR, "scheduled.json");

const DEFAULT_CONFIG = {
  botName: "CyrusBot",
  version: "1.0.0",
  ownerNumber: "08068363588",
  ownerJid: "2348068363588@s.whatsapp.net",
  timezone: "Africa/Lagos",
  prefix: ".",
  autoReplyEnabled: true,
  autoReply: "Cyrus is a bit busy now but will soon respond.",
  groupMode: true,
};

function normalizePhoneNumber(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 13 && digits.startsWith("234")) {
    return digits;
  }

  return digits;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureStructure() {
  const dirs = [
    AUTH_DIR,
    SESSIONS_DIR,
    DOWNLOAD_DIR,
    TEMP_DIR,
    LOG_DIR,
    DATABASE_DIR,
    MEDIA_DIR,
  ];

  dirs.forEach(ensureDir);
}

function writeJSON(filePath, data) {
  try {
    const tempFile = `${filePath}.tmp`;

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(tempFile, filePath);
    return true;
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error.message);
    return false;
  }
}

function readJSON(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, fallback);
      return fallback;
    }

    const data = fs.readFileSync(filePath, "utf8").trim();

    if (!data) {
      writeJSON(filePath, fallback);
      return fallback;
    }

    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
}

ensureStructure();

const storedConfig = readJSON(CONFIG_FILE, {});
const config = {
  ...DEFAULT_CONFIG,
  ...storedConfig,
};

const schedules = readJSON(SCHEDULE_FILE, []);

if (!Array.isArray(schedules)) {
  throw new Error("scheduled.json must contain an array.");
}

writeJSON(CONFIG_FILE, config);
writeJSON(SCHEDULE_FILE, schedules);

module.exports = {
  ROOT_DIR,
  AUTH_DIR,
  SESSIONS_DIR,
  DOWNLOAD_DIR,
  TEMP_DIR,
  LOG_DIR,
  DATABASE_DIR,
  MEDIA_DIR,
  CONFIG_FILE,
  SCHEDULE_FILE,
  DEFAULT_CONFIG,
  config,
  schedules,
  normalizePhoneNumber,
  ensureDir,
  ensureStructure,
  readJSON,
  writeJSON,
};