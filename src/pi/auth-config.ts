/**
 * Pure Node.js implementation of auth storage.
 * Bypasses pi SDK's AuthStorage which requires shell on Windows.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

// Built-in OAuth providers (from pi-ai SDK)
const OAUTH_PROVIDERS: Array<{ id: string; name: string }> = [
  { id: "github_copilot", name: "GitHub Copilot" },
  { id: "google", name: "Google" },
  { id: "openai", name: "OpenAI" },
  { id: "azure_openai", name: "Azure OpenAI" },
];

// Built-in API key providers with display names (from pi-coding-agent)
const API_KEY_PROVIDERS: Array<{ id: string; name: string }> = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google Gemini" },
  { id: "groq", name: "Groq" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "mistral", name: "Mistral" },
  { id: "together", name: "Together AI" },
  { id: "fireworks", name: "Fireworks" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "cerebras", name: "Cerebras" },
  { id: "azure-openai-responses", name: "Azure OpenAI Responses" },
  { id: "xai", name: "xAI" },
  { id: "amazon-bedrock", name: "Amazon Bedrock" },
  { id: "google-vertex", name: "Google Vertex AI" },
  { id: "huggingface", name: "Hugging Face" },
  { id: "nvidia", name: "NVIDIA NIM" },
  { id: "cloudflare-ai-gateway", name: "Cloudflare AI Gateway" },
];

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
  return join(homedir(), ".pi", "auth.json");
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readAuthJson(): AuthJson {
  const path = getAuthPath();
  console.log("[pi-vscode] readAuthJson: path =", path, "exists =", existsSync(path));
  if (!existsSync(path)) return { version: 1 };
  try {
    const content = readFileSync(path, "utf8");
    const data = JSON.parse(content) as AuthJson;
    console.log(
      "[pi-vscode] readAuthJson: loaded keys =",
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

// OAuth providers list
export function getOAuthProviders(): Array<{ id: string; name: string }> {
  return [...OAUTH_PROVIDERS];
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

// Get OAuth provider statuses
export function getOAuthProviderStatuses(): Array<{
  id: string;
  name: string;
  connected: boolean;
}> {
  const providers = getOAuthProviders();
  return providers.map((p) => ({
    id: p.id,
    name: p.name,
    connected: hasAuth(p.id),
  }));
}

// Get API key provider statuses
export function getApiKeyProviderStatuses(): Array<{
  id: string;
  name: string;
  configured: boolean;
}> {
  return API_KEY_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    configured: hasAuth(p.id),
  }));
}

// Get display name for a provider
export function getProviderDisplayName(providerId: string): string {
  const oauth = OAUTH_PROVIDERS.find((p) => p.id === providerId);
  if (oauth) return oauth.name;
  const apiKey = API_KEY_PROVIDERS.find((p) => p.id === providerId);
  if (apiKey) return apiKey.name;
  return providerId;
}

// Check if provider is an OAuth provider
export function isOAuthProvider(providerId: string): boolean {
  return OAUTH_PROVIDERS.some((p) => p.id === providerId);
}

// Check if provider is an API key provider
export function isApiKeyProvider(providerId: string): boolean {
  return API_KEY_PROVIDERS.some((p) => p.id === providerId);
}
