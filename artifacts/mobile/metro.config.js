const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// pnpm does not hoist by default, so packages that omit a `react` peer
// dependency (e.g. `@expo-google-fonts/inter`) cannot resolve `react`
// from their own .pnpm location — Metro returns `null` and every hook
// call crashes with `Cannot read properties of null (reading 'useState')`.
// Pinning the singletons to this artifact's node_modules guarantees one
// shared copy across the whole bundle.
const singletonModules = [
  "react",
  "react-dom",
  "react-native",
  "react-native-web",
  "@react-native-async-storage/async-storage",
  "@tanstack/react-query",
];
const extraNodeModules = {};
for (const name of singletonModules) {
  try {
    extraNodeModules[name] = path.dirname(
      require.resolve(`${name}/package.json`, { paths: [__dirname] }),
    );
  } catch {
    // package not installed — fine, just skip
  }
}

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
// React 19's package.json declares a "react-server" export condition that
// returns a server-only build with no hooks (useState, useEffect, …).
// Metro can otherwise pick that condition when bundling for web, which
// makes every component crash with `Cannot read properties of null
// (reading 'useState')` in `useFonts` / any hook call. Forcing the
// per-platform condition list to the browser-shaped set avoids that.
config.resolver.unstable_conditionsByPlatform = {
  ...(config.resolver.unstable_conditionsByPlatform ?? {}),
  web: ["browser"],
};
config.resolver.unstable_conditionNames = ["require", "react-native"];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...extraNodeModules,
};

// `extraNodeModules` only kicks in when normal node resolution fails.
// pnpm puts react inside `.pnpm/<pkg>@<v>_<peer-hash>/node_modules/react`,
// so different transitive paths can pick up DIFFERENT react copies (we've
// observed react@18.3.1, react@19.1.0 and react@19.1.17 all ending up in
// the same web bundle, which makes `dispatcher` null and every hook crash).
// `resolveRequest` runs FIRST, so we use it to force every import of
// `react`, `react-dom`, etc. to resolve from this artifact's node_modules.
const prevResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // The "3 react copies" bug only manifests in the WEB bundle (Metro's
  // node-resolution under pnpm picks different transitively-installed
  // copies). On iOS/Android, Metro's platform-aware haste map already
  // returns a single react-native module from the project's own
  // node_modules, and intercepting it here can defeat the platform
  // overlay (.ios.js / .android.js files). Scope the override to web
  // so native resolution is left untouched.
  if (platform === "web") {
    for (const singleton of singletonModules) {
      if (
        moduleName === singleton ||
        moduleName.startsWith(`${singleton}/`)
      ) {
        const root = extraNodeModules[singleton];
        // If the singleton isn't actually installed, fall through to
        // default resolution instead of building an `"undefined…"` path
        // that crashes.
        if (!root) break;
        const sub = moduleName.slice(singleton.length); // "" or "/foo"
        return context.resolveRequest(context, `${root}${sub}`, platform);
      }
    }
  }
  if (prevResolveRequest) {
    return prevResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
config.watcher = config.watcher ?? {};
config.watcher.additionalExts = config.watcher.additionalExts ?? [];
// Metro uses healthCheck.filePrefix; ignore transient files under any node_modules.
config.watcher.healthCheck = {
  ...(config.watcher.healthCheck ?? {}),
  enabled: false,
};

module.exports = config;
