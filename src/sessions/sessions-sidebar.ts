import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { SessionInfo } from "@earendil-works/pi-coding-agent";
import { createNewTerminal } from "../terminal.ts";
import type { SessionTracker } from "../sessions.ts";
import { filterAndSortSessions } from "./session-search.ts";
import { getSessionsHtml } from "./sessions-sidebar-html.ts";

export interface WorkspaceOption {
  name: string;
  fsPath: string;
}

export function createSessionsViewProvider(
  extensionUri: vscode.Uri,
  bridgeConfig: { url: string; token: string } | undefined,
  sessionTracker: SessionTracker,
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

  // Per-workspace cache of the most recent SessionManager.list() result.
  // Search filtering happens against this in-memory cache so each keystroke
  // doesn't re-read JSONL files from disk.
  const sessionCache = new Map<string, SessionInfo[]>();
  // Last search query per webview lifetime; survives refresh/rename/delete so
  // mutations re-apply the active filter.
  let lastSearchQuery = "";

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

      const sortByModifiedDesc = (sessions: SessionInfo[]): SessionInfo[] => {
        return [...sessions].sort((a, b) => {
          const am = a.modified instanceof Date ? a.modified.getTime() : 0;
          const bm = b.modified instanceof Date ? b.modified.getTime() : 0;
          return bm - am;
        });
      };

      const postFiltered = (query: string) => {
        const cwd = selectedWorkspace;
        if (!cwd) {
          webviewView.webview.postMessage({ type: "sessions", sessions: [], query });
          return;
        }
        const cached = sessionCache.get(cwd) ?? [];
        const trimmed = query.trim();
        if (!trimmed) {
          webviewView.webview.postMessage({
            type: "sessions",
            sessions: sortByModifiedDesc(cached).map((s) => serializeSession(s)),
            query,
          });
          return;
        }
        // With a query, sort by relevance.
        const { sessions: filtered, error } = filterAndSortSessions(cached, query, "relevance");
        webviewView.webview.postMessage({
          type: "sessions",
          sessions: filtered.map((s) => serializeSession(s)),
          query,
          searchError: error,
        });
      };

      const reloadAndPost = async (query: string) => {
        if (!selectedWorkspace) {
          webviewView.webview.postMessage({ type: "sessions", sessions: [], query });
          return;
        }
        try {
          const sessions = await SessionManager.list(selectedWorkspace);
          sessionCache.set(selectedWorkspace, sessions);
        } catch (err) {
          console.error("[pi-agent-studio] Sessions view: error fetching sessions:", err);
          sessionCache.set(selectedWorkspace, []);
        }
        postFiltered(query);
      };

      const refreshAll = async () => {
        postWorkspaces();
        await reloadAndPost(lastSearchQuery);
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
            await reloadAndPost(lastSearchQuery);
            break;
          case "search":
            lastSearchQuery = typeof msg.query === "string" ? msg.query : "";
            postFiltered(lastSearchQuery);
            break;
          case "new":
            await vscode.commands.executeCommand("pi-agent-studio.open");
            break;
          case "open":
            await openSession(msg.sessionFile, extensionUri, bridgeConfig, sessionTracker);
            break;
          case "rename":
            await renameSession(msg.sessionFile, msg.name);
            await reloadAndPost(lastSearchQuery);
            break;
          case "delete":
            await deleteSession(msg.sessionFile);
            await reloadAndPost(lastSearchQuery);
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
  sessionTracker: SessionTracker,
): Promise<void> {
  const existing = sessionTracker.findTerminalBySessionFile(sessionFile);
  if (existing) {
    existing.show();
    return;
  }
  const terminalId = randomUUID();
  const terminal = await createNewTerminal({
    extensionUri,
    bridgeConfig,
    sessionFile,
    terminalId,
  });
  if (terminal) {
    sessionTracker.track(terminal, terminalId);
    sessionTracker.update(terminalId, sessionFile);
    terminal.show();
  }
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
