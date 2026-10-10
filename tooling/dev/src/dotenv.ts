import { dirname, join } from "node:path";
import { config } from "@dotenvx/dotenvx";

const credentialKeys = new Set([
  "GEMINI_API_KEY",
  "AUTH_DISCORD_ID",
  "AUTH_DISCORD_SECRET",
]);

/** Optional external-service settings the local stack takes from `.env`; everything else is generated. */
export const isDotenvSetting = (key: string): boolean =>
  credentialKeys.has(key) || key.startsWith("OTEL_");

/** Drops dotenv-owned settings so a value exported in the invoking shell can never reach the stack. */
export const withoutDotenvSettings = (
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(env).filter(([key]) => !isDotenvSetting(key)),
  );

/**
 * Decrypts `path` with dotenvx (private key from the sibling `.env.keys`, `DOTENV_PRIVATE_KEY`, or
 * the OS keychain) and returns its non-empty dev settings without touching `process.env`. A missing
 * file or private key yields no settings, so a checkout without dotenvx keys still runs on fixtures.
 */
export function readDotenvSettings(path: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  try {
    config({
      path,
      envKeysFile: join(dirname(path), ".env.keys"),
      processEnv: parsed,
      quiet: true,
      strict: true,
      ignore: ["MISSING_ENV_FILE"],
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "DECRYPTION_FAILED") throw error;
    console.warn(
      `Could not decrypt ${path}: no dotenvx private key. Continuing without its settings.`,
    );
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      ([key, value]) => value !== "" && isDotenvSetting(key),
    ),
  );
}
