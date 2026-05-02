import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().default("*"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formatted = result.error.errors
    .map((e) => `  ${e.path.join(".")}: ${e.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${formatted}`);
}

export const config = result.data;
