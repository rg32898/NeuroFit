import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("*"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(1)
    .default("dev-access-secret-change-in-production"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(1)
    .default("dev-refresh-secret-change-in-production"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Shared secrets used by support/admin tooling. Required in production.
  CRON_SECRET: z.string().min(1).default("dev-cron-secret-change-in-production"),
  SUPPORT_TOKEN: z
    .string()
    .min(1)
    .default("dev-support-token-change-in-production"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.errors
    .map((e) => `  ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${formatted}`);
}

// Fail fast in production if the dev placeholders for cron / support tokens
// were never overridden. Using known defaults in prod would let anyone hit
// /api/admin/cron/daily and /api/progress/restore-streak.
if (result.data.NODE_ENV === "production") {
  const insecure: string[] = [];
  if (result.data.CRON_SECRET.startsWith("dev-")) insecure.push("CRON_SECRET");
  if (result.data.SUPPORT_TOKEN.startsWith("dev-"))
    insecure.push("SUPPORT_TOKEN");
  if (insecure.length > 0) {
    throw new Error(
      `Refusing to boot in production with insecure default(s) for: ${insecure.join(", ")}. Set these env vars to strong random values.`,
    );
  }
}

export const config = result.data;
