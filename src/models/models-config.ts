import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// ============================================================================
// Types matching ~/.pi/agent/models.json structure
// ============================================================================

export interface ModelEntry {
  id: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  thinkingLevelMap?: Record<string, string | null>;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  compat?: Record<string, unknown>;
}

export interface ProviderEntry {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
  compat?: Record<string, unknown>;
  models?: ModelEntry[];
  modelOverrides?: Record<string, unknown>;
}

export interface ModelsJson {
  providers?: Record<string, ProviderEntry>;
}

// ============================================================================
// Path helpers
// ============================================================================

export function getModelsPath(): string {
  return join(getAgentDir(), "models.json");
}

// ============================================================================
// Read / Write
// ============================================================================

export function readModelsJson(): ModelsJson {
  const path = getModelsPath();
  console.log("[pi-vscode] readModelsJson: path =", path, "exists =", existsSync(path));
  if (!existsSync(path)) return { providers: {} };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as ModelsJson;
    console.log(
      "[pi-vscode] readModelsJson: loaded, providers =",
      Object.keys(data.providers ?? {}).length,
    );
    return data;
  } catch {
    return { providers: {} };
  }
}

export function writeModelsJson(data: ModelsJson): void {
  const path = getModelsPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

// ============================================================================
// Provider CRUD
// ============================================================================

export function addProvider(name: string, entry: ProviderEntry): ModelsJson {
  const data = readModelsJson();
  data.providers ??= {};
  data.providers[name] = entry;
  writeModelsJson(data);
  return data;
}

export function updateProvider(name: string, updates: Partial<ProviderEntry>): ModelsJson {
  const data = readModelsJson();
  const existing = data.providers?.[name];
  if (!existing) throw new Error(`Provider "${name}" not found`);
  data.providers![name] = { ...existing, ...updates };
  writeModelsJson(data);
  return data;
}

export function renameProvider(oldName: string, newName: string): ModelsJson {
  const data = readModelsJson();
  const entry = data.providers?.[oldName];
  if (!entry) throw new Error(`Provider "${oldName}" not found`);
  delete data.providers![oldName];
  data.providers![newName] = entry;
  writeModelsJson(data);
  return data;
}

export function deleteProvider(name: string): ModelsJson {
  const data = readModelsJson();
  delete data.providers?.[name];
  writeModelsJson(data);
  return data;
}

// ============================================================================
// Model CRUD (within a provider)
// ============================================================================

export function addModel(providerName: string, model: ModelEntry): ModelsJson {
  const data = readModelsJson();
  const provider = data.providers?.[providerName];
  if (!provider) throw new Error(`Provider "${providerName}" not found`);
  provider.models ??= [];
  // Avoid duplicates
  const idx = provider.models.findIndex((m) => m.id === model.id);
  if (idx >= 0) {
    provider.models[idx] = model;
  } else {
    provider.models.push(model);
  }
  writeModelsJson(data);
  return data;
}

export function updateModel(
  providerName: string,
  modelId: string,
  updates: Partial<ModelEntry>,
): ModelsJson {
  const data = readModelsJson();
  const provider = data.providers?.[providerName];
  if (!provider) throw new Error(`Provider "${providerName}" not found`);
  const idx = provider.models?.findIndex((m) => m.id === modelId) ?? -1;
  if (idx < 0) throw new Error(`Model "${modelId}" not found in provider "${providerName}"`);
  provider.models![idx] = { ...provider.models![idx]!, ...updates };
  writeModelsJson(data);
  return data;
}

export function deleteModel(providerName: string, modelId: string): ModelsJson {
  const data = readModelsJson();
  const provider = data.providers?.[providerName];
  if (!provider) throw new Error(`Provider "${providerName}" not found`);
  provider.models = (provider.models ?? []).filter((m) => m.id !== modelId);
  writeModelsJson(data);
  return data;
}

// ============================================================================
// Helpers
// ============================================================================

export function getProviderNames(): string[] {
  const data = readModelsJson();
  return Object.keys(data.providers ?? {});
}

export function getProvider(name: string): ProviderEntry | undefined {
  const data = readModelsJson();
  return data.providers?.[name];
}
