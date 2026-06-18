import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import { createNewTerminal } from "../terminal.ts";
import { getSessionsHtml } from "./sessions-sidebar-html.ts";

export interface WorkspaceOption {
  name: string;
  fsPath: string;
}

export function createSessionsViewProvider(
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
): vscode.WebviewViewProvider {
  let selectedWorkspace: string | undefined;

  const pickInitialWorkspace = (): string | undefined => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return undefined;
    // Prefer the workspace containing the active editor
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active) {
      const match = vscode.workspace.getWorkspaceFolder(active);
      if (match) return match.uri.fsPath;
    }
    return folders[0]!.uri.fsPath;
  };

  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      webviewView.webview.options = { enableScripts: true };

      const folders = vscode.workspace.workspaceFolders ?? [];
      if (!selectedWorkspace || !folders.some((f) => f.uri.fsPath === selectedWorkspace)) {
        selectedWorkspace = pickInitialWorkspace();
      }

      webviewView.webview.html = getSessionsHtml();

      const postWorkspaces = () => {
        const workspaces: WorkspaceOption[] = (vscode.workspace.workspaceFolders ?? []).map(
          (f) => ({ name: f.name, fsPath: f.uri.fsPath }),
        );
        webviewView.webview.postMessage({
          type: "workspaces",
          workspaces,
          selected: selectedWorkspace,
        });
      };

      const postSessions = async () => {
        if (!selectedWorkspace) {
          webviewView.webview.postMessage({ type: "sessions", sessions: [] });
          return;
        }
        try {
          const sessions = await SessionManager.list(selectedWorkspace);
          webviewView.webview.postMessage({
            type: "sessions",
            sessions: sessions.map((s) => serializeSession(s)),
          });
        } catch (err) {
          console.error("[pi-vscode] Sessions view: error fetching sessions:", err);
          webviewView.webview.postMessage({ type: "sessions", sessions: [] });
        }
      };

      const refreshAll = async () => {
        postWorkspaces();
        await postSessions();
      };

      void refreshAll();

      const folderSub = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        const current = vscode.workspace.workspaceFolders ?? [];
        if (!current.some((f) => f.uri.fsPath === selectedWorkspace)) {
          selectedWorkspace = pickInitialWorkspace();
        }
        void refreshAll();
      });

      const visSub = webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) void refreshAll();
      });

      webviewView.onDidDispose(() => {
        folderSub.dispose();
        visSub.dispose();
      });

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case "refresh":
            await refreshAll();
            break;
          case "selectWorkspace":
            selectedWorkspace = msg.fsPath;
            await postSessions();
            break;
          case "open":
            await openSession(msg.sessionFile, extensionUri, bridgeConfig);
            break;
          case "rename":
            await renameSession(msg.sessionFile, msg.name);
            await postSessions();
            break;
          case "delete":
            await deleteSession(msg.sessionFile);
            await postSessions();
            break;
        }
      });
    },
  };
}

function serializeSession(s: SessionInfo) {
  return {
    path: s.path,
    name: s.name || "",
    firstMessage: s.firstMessage || "",
    messageCount: s.messageCount || 0,
    modified: s.modified instanceof Date ? s.modified.toISOString() : (s.modified ?? ""),
  };
}

async function openSession(
  sessionFile: string,
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
): Promise<void> {
  const terminalId = randomUUID();
  const terminal = await createNewTerminal({
    extensionUri,
    bridgeConfig,
    sessionFile,
    terminalId,
  });
  if (terminal) terminal.show();
}

async function renameSession(sessionFile: string, name: string): Promise<void> {
  const sm = SessionManager.open(sessionFile);
  sm.appendSessionInfo(name.trim());
}

async function deleteSession(sessionFile: string): Promise<void> {
  // Read header to get parentSession path for cascade re-parent
  let parentSessionPath: string | undefined;
  try {
    const firstLine = readFileSync(sessionFile, "utf8").split("\n")[0]!;
    const header = JSON.parse(firstLine) as { type?: string; parentSession?: string };
    if (header.type === "session") parentSessionPath = header.parentSession;
  } catch {
    // ignore malformed header
  }

  // Cascade re-parent: scan sibling .jsonl files and rewrite child headers
  const dir = sessionFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".jsonl") && join(dir, f) !== sessionFile,
    );
    for (const file of files) {
      const childPath = join(dir, file);
      try {
        const content = readFileSync(childPath, "utf8");
        const lines = content.split("\n");
        const header = JSON.parse(lines[0]!) as { type?: string; parentSession?: string };
        if (header.type === "session" && header.parentSession === sessionFile) {
          header.parentSession = parentSessionPath;
          lines[0] = JSON.stringify(header);
          writeFileSync(childPath, lines.join("\n"));
        }
      } catch {
        // skip malformed files
      }
    }
  } catch {
    // skip if dir unreadable
  }

  unlinkSync(sessionFile);
}
