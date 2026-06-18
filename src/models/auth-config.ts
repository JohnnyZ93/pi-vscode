/**
 * Pure Node.js implementation of auth storage.
 * Bypasses pi SDK's AuthStorage file-locking (heavy on Windows), but reuses the
 * SDK to enumerate built-in providers so the list stays in sync with the SDK —
 * same approach as pi-web (see app/api/auth/all-providers/route.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AuthStorage, ModelRegistry, getAgentDir } from "@earendil-works/pi-coding-agent";

// Providers that authenticate via OAuth — excluded from the API Keys tab.
// Mirrors pi-web's app/api/auth/all-providers/route.ts.
const OAUTH_PROVIDER_IDS = new Set(["anthropic", "github-copilot", "openai-codex"]);

// OAuth providers we deliberately hide from the OAuth tab. Mirrors pi-web's
// app/api/auth/providers/route.ts EXCLUDED set.
const OAUTH_HIDDEN: Set<string> = new Set(["anthropic"]);
// Display name overrides for the OAuth tab (mirrors pi-web).
const OAUTH_DISPLAY_NAMES: Record<string, string> = {
  "openai-codex": "ChatGPT Plus/Pro",
  "github-copilot": "GitHub Copilot",
};

interface AuthEntry {
  type: "oauth" | "api_key";
  // OAuth fields
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  // API key field
  key?: string;
}

interface AuthJson {
  version?: number;
  [providerId: string]: AuthEntry | number | undefined;
}

function getAuthPath(): string {
  // Must match the SDK's AuthStorage default: ~/.pi/agent/auth.json.
  // Writing elsewhere means pi never sees keys saved via this webview.
  return join(getAgentDir(), "auth.json");
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readAuthJson(): AuthJson {
  const path = getAuthPath();
  console.log("[pi-agent-studio] readAuthJson: path =", path, "exists =", existsSync(path));
  if (!existsSync(path)) return { version: 1 };
  try {
    const content = readFileSync(path, "utf8");
    const data = JSON.parse(content) as AuthJson;
    console.log(
      "[pi-agent-studio] readAuthJson: loaded keys =",
      Object.keys(data).filter((k) => k !== "version").length,
    );
    return data;
  } catch {
    return { version: 1 };
  }
}

function writeAuthJson(data: AuthJson): void {
  const path = getAuthPath();
  ensureDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Build a ModelRegistry backed by our pure-Node auth reader, so the provider
 * list reflects both built-in models and user models.json overrides. The
 * registry is constructed per call (cheap) so changes are always fresh.
 */
function buildRegistry(): ModelRegistry {
  // AuthStorage.create() only reads auth.json + env vars lazily; it does not
  // spawn a shell, so it is safe on Windows.
  return ModelRegistry.create(AuthStorage.create());
}

// Check if provider has auth
export function hasAuth(providerId: string): boolean {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "oauth") {
    return !!entry.access_token;
  }
  if (entry.type === "api_key") {
    return !!entry.key;
  }
  return false;
}

// Logout (remove auth)
export function logout(providerId: string): void {
  const auth = readAuthJson();
  delete auth[providerId];
  writeAuthJson(auth);
}

// Save OAuth credentials
export function saveOAuthCredentials(
  providerId: string,
  credentials: { access_token: string; refresh_token?: string; expires_at?: string },
): void {
  const auth = readAuthJson();
  auth[providerId] = {
    type: "oauth",
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expires_at: credentials.expires_at,
  };
  writeAuthJson(auth);
}

// Get OAuth credentials
export function getOAuthCredentials(providerId: string):
  | {
      access_token?: string;
      refresh_token?: string;
      expires_at?: string;
    }
  | undefined {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object" || entry.type !== "oauth") return undefined;
  return {
    access_token: entry.access_token,
    refresh_token: entry.refresh_token,
    expires_at: entry.expires_at,
  };
}

// Save API key
export function saveApiKey(providerId: string, key: string): void {
  const auth = readAuthJson();
  auth[providerId] = {
    type: "api_key",
    key: key.trim(),
  };
  writeAuthJson(auth);
}

// Get API key
export function getApiKey(providerId: string): string | undefined {
  const auth = readAuthJson();
  const entry = auth[providerId];
  if (!entry || typeof entry !== "object" || entry.type !== "api_key") return undefined;
  return entry.key;
}

// Remove API key
export function removeApiKey(providerId: string): void {
  const auth = readAuthJson();
  delete auth[providerId];
  writeAuthJson(auth);
}

/**
 * OAuth providers, sourced from the SDK. Mirrors pi-web's
 * /api/auth/providers list (same exclusions + display name overrides).
 */
export function getOAuthProviders(): Array<{ id: string; name: string }> {
  const authStorage = AuthStorage.create();
  return authStorage
    .getOAuthProviders()
    .filter((p) => !OAUTH_HIDDEN.has(p.id))
    .map((p) => ({ id: p.id, name: OAUTH_DISPLAY_NAMES[p.id] ?? p.name }));
}

// Get OAuth provider statuses
export function getOAuthProviderStatuses(): Array<{
  id: string;
  name: string;
  connected: boolean;
}> {
  const authStorage = AuthStorage.create();
  return authStorage
    .getOAuthProviders()
    .filter((p) => !OAUTH_HIDDEN.has(p.id))
    .map((p) => ({
      id: p.id,
      name: OAUTH_DISPLAY_NAMES[p.id] ?? p.name,
      connected: authStorage.has(p.id),
    }));
}

/**
 * API key providers, sourced from the SDK registry. Mirrors pi-web's
 * /api/auth/all-providers: iterate all models, dedupe by provider, skip
 * OAuth-only providers and custom (models.json_key) providers.
 */
export function getApiKeyProviderStatuses(): Array<{
  id: string;
  name: string;
  configured: boolean;
  modelCount: number;
}> {
  try {
    const registry = buildRegistry();
    const all = registry.getAll();
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      name: string;
      configured: boolean;
      modelCount: number;
    }> = [];

    for (const m of all) {
      if (seen.has(m.provider)) continue;
      seen.add(m.provider);
      if (OAUTH_PROVIDER_IDS.has(m.provider)) continue;
      const status = registry.getProviderAuthStatus(m.provider);
      // Skip providers whose key comes from models.json (those are custom providers).
      if (status.source === "models_json_key") continue;
      const modelCount = all.filter((x) => x.provider === m.provider).length;
      result.push({
        id: m.provider,
        name: registry.getProviderDisplayName(m.provider),
        configured: status.configured,
        modelCount,
      });
    }

    return result;
  } catch (err) {
    console.error("[pi-agent-studio] getApiKeyProviderStatuses failed:", err);
    return [];
  }
}

// Get display name for a provider
export function getProviderDisplayName(providerId: string): string {
  const oauth = getOAuthProviders().find((p) => p.id === providerId);
  if (oauth) return oauth.name;
  try {
    return buildRegistry().getProviderDisplayName(providerId);
  } catch {
    return providerId;
  }
}

// Check if provider is an OAuth provider
export function isOAuthProvider(providerId: string): boolean {
  return getOAuthProviders().some((p) => p.id === providerId);
}

// Check if provider is an API key provider
export function isApiKeyProvider(providerId: string): boolean {
  return getApiKeyProviderStatuses().some((p) => p.id === providerId);
}
