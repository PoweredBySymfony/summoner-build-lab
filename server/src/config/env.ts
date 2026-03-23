import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().default("http://localhost:8080"),
  RIOT_API_KEY: z.string().optional(),
  RIOT_REGION: z.string().default("europe"),
  RIOT_PLATFORM: z.string().default("euw1"),
  DEMO_USER_USERNAME: z.string().default("SummonerCoach"),
});

export const env = envSchema.parse(process.env);
