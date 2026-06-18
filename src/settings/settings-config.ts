import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Path helpers — pure Node.js, mirrors src/models/models-config.ts
// ============================================================================

export function getSystemPromptPath(): string {
  return join(getAgentDir(), "SYSTEM.md");
}

export function getAppendSystemPromptPath(): string {
  return join(getAgentDir(), "APPEND_SYSTEM.md");
}

export function getSettingsJsonPath(): string {
  return join(getAgentDir(), "settings.json");
}

// ============================================================================
// Read / Write helpers
// ============================================================================

export function readTextFile(path: string): string {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function writeTextFile(path: string, content: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf8");
}

/** Ensure settings.json exists (create empty `{}` if missing) and return its path. */
export function ensureSettingsJsonExists(): string {
  const path = getSettingsJsonPath();
  if (!existsSync(path)) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, "{}\n", "utf8");
  }
  return path;
}

/** Ensure a markdown prompt file exists (create empty file if missing) and return its path. */
export function ensurePromptFileExists(path: string): string {
  if (!existsSync(path)) writeTextFile(path, "");
  return path;
}
