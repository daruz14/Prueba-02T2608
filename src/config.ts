import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  TZ: z.string().min(1).default("America/Santiago"),
  MODEL_BACKEND: z.enum(["gemini", "fake"]).default("fake"),
  GEMINI_API_KEY: z.string().min(1).nullish(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  INGRESS_API_KEY: z.string().min(8).nullish(),
});

export type Config = Readonly<z.infer<typeof envSchema>>;

function withoutEmptyValues(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== ""),
  );
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(withoutEmptyValues(env));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${details}`);
  }
  const config = parsed.data;
  if (config.MODEL_BACKEND === "gemini" && !config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when MODEL_BACKEND=gemini");
  }
  return Object.freeze(config);
}
