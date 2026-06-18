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
  type ModelsJson,
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
            case "refresh":
              postData();
              break;
            case "addProvider":
              addProvider(msg.name, msg.entry);
              postData();
              break;
            case "updateProvider":
              updateProvider(msg.name, msg.updates);
              postData();
              break;
            case "renameProvider":
              renameProvider(msg.oldName, msg.newName);
              postData();
              break;
            case "deleteProvider":
              deleteProvider(msg.name);
              postData();
              break;
            case "addModel":
              addModel(msg.providerName, msg.model);
              postData();
              break;
            case "updateModel":
              updateModel(msg.providerName, msg.modelId, msg.updates);
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

    // API key providers - count models from models.json overrides + default 1 per provider
    const apikeyStatuses = getApiKeyProviderStatuses().map((p) => {
      const customModels = modelsJson.providers?.[p.id]?.models ?? [];
      const modelCount = customModels.length > 0 ? customModels.length : 1;
      return { ...p, modelCount };
    });

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
