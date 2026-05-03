#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Host-agnostic Expo dev launcher.
 *
 * On a plain laptop:
 *   `pnpm --filter @workspace/mobile run dev` boots Metro on PORT (default
 *   8081), prints a QR code, and you scan it with Expo Go.
 *
 * On a managed dev environment that proxies traffic through a public
 * domain (e.g. Replit), the launcher detects the platform-provided
 * env vars (REPLIT_*) and forwards them to Expo so the QR code points at
 * the public URL instead of localhost. These env vars are convenience
 * only — setting EXPO_PUBLIC_DOMAIN works on any host.
 */
const { spawn } = require("node:child_process");

const env = { ...process.env };

const port = env.PORT || "8081";
env.PORT = port;

const args = ["exec", "expo", "start", "--port", port];

if (env.REPLIT_EXPO_DEV_DOMAIN) {
  // Replit-only — the platform fronts Metro with a public TLS URL. Tell
  // Expo to advertise that URL in the QR code instead of localhost.
  env.EXPO_PACKAGER_PROXY_URL = `https://${env.REPLIT_EXPO_DEV_DOMAIN}`;
  if (env.REPLIT_DEV_DOMAIN) {
    env.EXPO_PUBLIC_DOMAIN = env.EXPO_PUBLIC_DOMAIN || env.REPLIT_DEV_DOMAIN;
    env.REACT_NATIVE_PACKAGER_HOSTNAME = env.REPLIT_DEV_DOMAIN;
  }
  if (env.REPL_ID) env.EXPO_PUBLIC_REPL_ID = env.REPL_ID;
  args.push("--localhost");
}

const child = spawn("pnpm", args, { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
