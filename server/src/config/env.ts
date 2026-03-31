import "dotenv/config";
import { z } from "zod";

const devAuthSecret =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "dev-only-auth-secret-change-me");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().default("http://localhost:8080"),
  APP_URL: z.string().default("http://localhost:8080"),
  AUTH_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("summoner_build_lab_session"),
  SYNC_ADMIN_TOKEN: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  RIOT_API_KEY: z.string().optional(),
  RIOT_REGION: z.string().default("europe"),
  RIOT_PLATFORM: z.string().default("euw1"),
  RIOT_API_BASE_DELAY_MS: z.coerce.number().default(120),
  RIOT_API_CONCURRENCY: z.coerce.number().default(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Summoner Build Lab <noreply@example.com>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
});

export const env = envSchema.parse({
  ...process.env,
  AUTH_SECRET: devAuthSecret,
});

export const isProduction = env.NODE_ENV === "production";

export const adminEmails = new Set(
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
