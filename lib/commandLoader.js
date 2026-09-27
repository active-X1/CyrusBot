// lib/commandLoader.js
//
// Scans commands/*.js and builds a lookup map of every valid command.
// Adding a new command is just: drop a file in commands/ that exports
// the shape described below. Nothing here needs to change.
//
// Required shape of a command module:
//   module.exports = {
//     name: 'ping',            // string, lowercase, no prefix
//     aliases: ['p'],          // optional array of extra trigger words
//     description: '...',      // shown in .help
//     category: 'general',     // grouping used by .help
//     ownerOnly: false,        // if true, only owner/sudo may run it
//     execute: async (sock, msg, args, ctx) => { ... }
//   }

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const COMMANDS_DIR = path.resolve(__dirname, '..', 'commands');

function isValidCommand(mod) {
  return (
    mod &&
    typeof mod.name === 'string' &&
    mod.name.length > 0 &&
    typeof mod.execute === 'function'
  );
}

/**
 * Load every command file into a Map keyed by name AND alias, so lookups
 * are O(1). Returns { commands, byCategory } where `commands` is a
 * de-duplicated array (for iterating in .help) and byCategory groups them.
 */
function loadCommands() {
  const registry = new Map();
  const commands = [];

  const files = fs
    .readdirSync(COMMANDS_DIR)
    .filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const fullPath = path.join(COMMANDS_DIR, file);
    try {
      // Clear require cache entry so a future hot-reload feature (if you
      // add one) would pick up changes; harmless on first load.
      delete require.cache[require.resolve(fullPath)];
      const mod = require(fullPath);

      if (!isValidCommand(mod)) {
        logger.warn({ file }, 'Skipped invalid command file (missing name/execute)');
        continue;
      }

      if (registry.has(mod.name)) {
        logger.warn({ file, name: mod.name }, 'Duplicate command name, skipping');
        continue;
      }

      registry.set(mod.name, mod);
      for (const alias of mod.aliases || []) {
        if (registry.has(alias)) {
          logger.warn({ file, alias }, 'Alias collides with existing command/alias, skipping alias');
          continue;
        }
        registry.set(alias, mod);
      }

      commands.push(mod);
    } catch (err) {
      // A broken command file should never prevent the rest of the bot
      // from loading and running.
      logger.error({ file, err: err.message }, 'Failed to load command file');
    }
  }

  logger.info({ count: commands.length }, 'Commands loaded');

  return {
    registry, // Map<string trigger, command module>
    commands, // array of unique command modules (for .help)
  };
}

module.exports = { loadCommands };
