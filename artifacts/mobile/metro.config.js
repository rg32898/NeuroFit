const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// pnpm creates short-lived `_tmp_<id>` directories under .pnpm/ during installs.
// Metro's file watcher tries to watch them and crashes with ENOENT when they
// vanish. Excluding them (plus a few other noisy paths) keeps the dev server
// stable on Linux/macOS without any Replit-specific config.
const blockList = [
  /\/node_modules\/\.pnpm\/.*_tmp_.*\//,
  /\/node_modules\/\.pnpm\/.*\/node_modules\/.*\/_tmp_.*\//,
  /\/\.git\//,
];
config.resolver = config.resolver ?? {};
config.resolver.blockList = blockList;
config.watcher = config.watcher ?? {};
config.watcher.additionalExts = config.watcher.additionalExts ?? [];
// Metro uses healthCheck.filePrefix; ignore transient files under any node_modules.
config.watcher.healthCheck = {
  ...(config.watcher.healthCheck ?? {}),
  enabled: false,
};

module.exports = config;
