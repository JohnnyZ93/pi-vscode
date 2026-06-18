import * as vscode from "vscode";
import {
  ensurePromptFileExists,
  ensureSettingsJsonExists,
  getAppendSystemPromptPath,
  getSettingsJsonPath,
  getSystemPromptPath,
  readTextFile,
  writeTextFile,
} from "./settings-config.ts";
import { collectStaticEnv, detectNodeVersion, detectPiVersion } from "./settings-env.ts";
import { getSettingsHtml } from "./settings-sidebar-html.ts";

const LINK_HOME = "https://pi.dev";
const LINK_PACKAGES = "https://pi.dev/packages";
const LINK_GITHUB = "https://github.com/JohnnyZ93/pi-agent-studio";

export function createSettingsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView) {
      console.log("[pi-agent-studio] Settings view: resolveWebviewView called");
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getSettingsHtml();

      const postData = async () => {
        const env = collectStaticEnv();
        const systemPath = getSystemPromptPath();
        const appendPath = getAppendSystemPromptPath();
        webviewView.webview.postMessage({
          type: "data",
          env: { ...env, piVersion: "(loading…)" },
          systemPrompt: { path: systemPath, content: readTextFile(systemPath) },
          appendSystemPrompt: { path: appendPath, content: readTextFile(appendPath) },
          settingsJsonPath: getSettingsJsonPath(),
          links: { home: LINK_HOME, packages: LINK_PACKAGES, github: LINK_GITHUB },
        });
        try {
          const piVersion = await detectPiVersion(env.piPath);
          webviewView.webview.postMessage({ type: "piVersion", piVersion });
        } catch (err) {
          console.error("[pi-agent-studio] Settings view: pi version detect failed:", err);
          webviewView.webview.postMessage({ type: "piVersion", piVersion: "(unknown)" });
        }
        try {
          const nodeVersion = await detectNodeVersion(env.piPath);
          webviewView.webview.postMessage({ type: "nodeVersion", nodeVersion });
        } catch (err) {
          console.error("[pi-agent-studio] Settings view: node version detect failed:", err);
          webviewView.webview.postMessage({
            type: "nodeVersion",
            nodeVersion: `${process.version} (extension host)`,
          });
        }
      };

      const openInEditor = async (path: string) => {
        const doc = await vscode.workspace.openTextDocument(path);
        await vscode.window.showTextDocument(doc);
      };

      webviewView.webview.onDidReceiveMessage(async (msg: { type?: string; content?: string }) => {
        try {
          switch (msg.type) {
            case "ready":
            case "refresh":
              await postData();
              return;

            case "saveSystemPrompt":
              writeTextFile(getSystemPromptPath(), msg.content ?? "");
              webviewView.webview.postMessage({ type: "saved", what: "system" });
              await postData();
              return;

            case "saveAppendSystemPrompt":
              writeTextFile(getAppendSystemPromptPath(), msg.content ?? "");
              webviewView.webview.postMessage({ type: "saved", what: "append" });
              await postData();
              return;

            case "openSettingsFile":
              await openInEditor(ensureSettingsJsonExists());
              return;

            case "openSystemPromptFile":
              await openInEditor(ensurePromptFileExists(getSystemPromptPath()));
              return;

            case "openAppendSystemPromptFile":
              await openInEditor(ensurePromptFileExists(getAppendSystemPromptPath()));
              return;

            case "upgrade":
              await vscode.commands.executeCommand("pi-agent-studio.upgrade");
              return;
          }
        } catch (err) {
          console.error("[pi-agent-studio] Settings view: error handling message:", err);
          webviewView.webview.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          console.log("[pi-agent-studio] Settings view: became visible, refreshing...");
          void postData();
        }
      });
    },
  };
}
