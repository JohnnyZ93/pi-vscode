import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import { createNewTerminal } from "../terminal.ts";

export interface WorkspaceSessions {
  workspace: vscode.WorkspaceFolder;
  sessions: SessionInfo[];
}

export function createSessionsViewProvider(
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView: vscode.WebviewView) {
      console.log("[pi-vscode] Sessions view: resolveWebviewView called");
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getSessionsHtml();

      const postSessions = async () => {
        console.log("[pi-vscode] Sessions view: fetching sessions...");
        try {
          const data = await listWorkspaceSessions();
          console.log(
            "[pi-vscode] Sessions view: found",
            data.length,
            "workspaces with",
            data.reduce((sum, w) => sum + w.sessions.length, 0),
            "sessions",
          );
          webviewView.webview.postMessage({ type: "sessions", data });
        } catch (err) {
          console.error("[pi-vscode] Sessions view: error fetching sessions:", err);
        }
      };

      postSessions();

      webviewView.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case "refresh":
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

async function listWorkspaceSessions(): Promise<WorkspaceSessions[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const results: WorkspaceSessions[] = [];
  for (const folder of folders) {
    try {
      const sessions = await SessionManager.list(folder.uri.fsPath);
      results.push({ workspace: folder, sessions });
    } catch {
      // Skip folders where session listing fails
    }
  }
  return results;
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

import { getSessionsHtml } from "./sessions-sidebar-html.ts";
