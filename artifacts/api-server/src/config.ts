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
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.errors
    .map((e) => `  ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${formatted}`);
}

export const config = result.data;
