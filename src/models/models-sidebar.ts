import * as vscode from "vscode";
import {
  readModelsJson,
  writeModelsJson,
  addProvider,
  updateProvider,
  renameProvider,
  deleteProvider,
  addModel,
  updateModel,
  deleteModel,
  getModelsPath,
  ensureModelsJsonExists,
  type ModelsJson,
  type ProviderEntry,
} from "./models-config.ts";
import { startOAuthFlow, type OAuthProgressEvent, type OAuthFlowController } from "./oauth-flow.ts";
import {
  getOAuthProviderStatuses,
  getApiKeyProviderStatuses,
  saveApiKey,
  removeApiKey,
  logout,
} from "./auth-config.ts";

interface ProviderInfo {
  id: string;
  name: string;
  type: "custom" | "oauth" | "apikey";
  connected?: boolean;
  configured?: boolean;
  modelCount: number;
}

interface ModelsViewData {
  providers: ProviderInfo[];
  modelsJson: ModelsJson;
  oauthStatuses: Array<{ id: string; name: string; connected: boolean }>;
  apikeyStatuses: Array<{ id: string; name: string; configured: boolean; modelCount: number }>;
}

export function createModelsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      console.log("[pi-vscode] Models view: resolveWebviewView called");
      webviewView.webview.options = { enableScripts: true };
      const modelsPath = getModelsPath();
      webviewView.webview.html = getModelsHtml(modelsPath);

      let activeOAuthFlow: OAuthFlowController | undefined;

      const postData = () => {
        try {
          const data = buildModelsViewData();
          console.log(
            "[pi-vscode] Models view: posting data with",
            data.providers.length,
            "providers",
          );
          webviewView.webview.postMessage({ type: "data", data, title: modelsPath });
        } catch (err) {
          console.error("[pi-vscode] Models view: error building data:", err);
        }
      };

      postData();

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          console.log("[pi-vscode] Models view: became visible, refreshing...");
          postData();
        }
      });

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === "ready") {
          console.log("[pi-vscode] Models view: webview ready, resending data");
          postData();
          return;
        }
        try {
          switch (msg.type) {
            case "openModelsFile": {
              const modelsPath = ensureModelsJsonExists();
              const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(modelsPath));
              await vscode.window.showTextDocument(doc, { preview: false });
              break;
            }
            case "refresh":
              postData();
              break;
            case "addProvider":
              addProvider(msg.name, msg.entry);
              postData();
              break;
            case "updateProvider":
              updateProvider(msg.name, sanitizeUpdates(msg.updates));
              postData();
              break;
            case "renameProvider":
              renameProvider(msg.oldName, msg.newName);
              postData();
              break;
            case "renameProviderAndUpdate": {
              // Update fields first (against old name), then rename atomically.
              updateProvider(msg.oldName, sanitizeUpdates(msg.updates));
              if (msg.oldName !== msg.newName) {
                renameProvider(msg.oldName, msg.newName);
              }
              postData();
              break;
            }
            case "deleteProvider":
              deleteProvider(msg.name);
              postData();
              break;
            case "addModel":
              addModel(msg.providerName, msg.model);
              postData();
              break;
            case "updateModel":
              updateModel(msg.providerName, msg.modelId, sanitizeModelUpdates(msg.updates));
              postData();
              break;
            case "deleteModel":
              deleteModel(msg.providerName, msg.modelId);
              postData();
              break;
            case "oauthLogin": {
              activeOAuthFlow?.cancel();
              const flow = startOAuthFlow(msg.providerId);
              activeOAuthFlow = flow;
              flow.onProgress((event: OAuthProgressEvent) => {
                webviewView.webview.postMessage({ type: "oauthProgress", event });
                if (
                  event.type === "success" ||
                  event.type === "error" ||
                  event.type === "cancelled"
                ) {
                  activeOAuthFlow = undefined;
                  postData();
                }
              });
              break;
            }
            case "oauthRespond":
              activeOAuthFlow?.respond(msg.token, msg.value);
              break;
            case "oauthCancel":
              activeOAuthFlow?.cancel();
              activeOAuthFlow = undefined;
              break;
            case "oauthLogout":
              logout(msg.providerId);
              postData();
              break;
            case "saveApiKey": {
              saveApiKey(msg.providerId, msg.apiKey.trim());
              postData();
              break;
            }
            case "removeApiKey": {
              removeApiKey(msg.providerId);
              postData();
              break;
            }
            case "writeModelsJson":
              writeModelsJson(msg.data);
              postData();
              break;
          }
        } catch (err) {
          webviewView.webview.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}

/**
 * Convert webview's null sentinels to undefined so that the spread merge in
 * updateProvider effectively removes those fields when JSON.stringify drops them.
 */
function sanitizeUpdates(updates: Partial<ProviderEntry> | undefined): Partial<ProviderEntry> {
  if (!updates) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[key] = value === null ? undefined : value;
  }
  return result as Partial<ProviderEntry>;
}

/**
 * Same null → undefined conversion for model updates so unchecking e.g. "Image input"
 * actually drops the `input` field instead of preserving the old one via spread merge.
 */
function sanitizeModelUpdates<T extends Record<string, unknown>>(updates: T | undefined): T {
  if (!updates) return {} as T;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[key] = value === null ? undefined : value;
  }
  return result as T;
}

function buildModelsViewData(): ModelsViewData {
  try {
    const modelsJson = readModelsJson();
    console.log(
      "[pi-vscode] Models view: read models config, providers:",
      Object.keys(modelsJson.providers ?? {}).length,
    );

    // Custom providers from models.json
    const customProviders: ProviderInfo[] = Object.entries(modelsJson.providers ?? {}).map(
      ([id, entry]) => ({
        id,
        name: entry.name ?? id,
        type: "custom" as const,
        modelCount: entry.models?.length ?? 0,
      }),
    );

    // OAuth providers
    const oauthStatuses = getOAuthProviderStatuses();
    console.log("[pi-vscode] Models view: OAuth providers:", oauthStatuses.length);

    // API key providers - modelCount already returned by getApiKeyProviderStatuses
    // (computed from the SDK registry, same as pi-web).
    const apikeyStatuses = getApiKeyProviderStatuses();

    console.log("[pi-vscode] Models view: API key providers:", apikeyStatuses.length);

    return { providers: customProviders, modelsJson, oauthStatuses, apikeyStatuses };
  } catch (err) {
    console.error("[pi-vscode] Models view: Failed to build data:", err);
    return {
      providers: [],
      modelsJson: { providers: {} },
      oauthStatuses: [],
      apikeyStatuses: [],
    };
  }
}

import { getModelsHtml } from "./models-sidebar-html.ts";
