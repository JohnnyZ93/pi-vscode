import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { TERMINAL_TITLE } from "./constants.ts";
import { createNewTerminal } from "./terminal.ts";

const SESSIONS_KEY = "pi-agent-studio.terminalSessions";

type TerminalSessionMap = Record<string, string>;

export interface SessionTracker {
  update(terminalId: string, sessionFile: string): void;
  track(terminal: vscode.Terminal, terminalId: string): void;
  onClose(terminal: vscode.Terminal): void;
  findTerminalBySessionFile(sessionFile: string): vscode.Terminal | undefined;
  restore(extensionUri: vscode.Uri, bridgeConfig: { url: string; token: string }): Promise<void>;
}

export function createSessionTracker(context: vscode.ExtensionContext): SessionTracker {
  const terminalIds = new WeakMap<vscode.Terminal, string>();
  const terminalsById = new Map<string, vscode.Terminal>();

  const read = () => context.workspaceState.get<TerminalSessionMap>(SESSIONS_KEY) ?? {};
  const write = (map: TerminalSessionMap) => context.workspaceState.update(SESSIONS_KEY, map);

  return {
    update(terminalId, sessionFile) {
      const map = read();
      if (map[terminalId] === sessionFile) return;
      map[terminalId] = sessionFile;
      void write(map);
    },
    track(terminal, terminalId) {
      terminalIds.set(terminal, terminalId);
      terminalsById.set(terminalId, terminal);
    },
    onClose(terminal) {
      if (terminal.name !== TERMINAL_TITLE) return;
      const id = terminalIds.get(terminal);
      if (id) terminalsById.delete(id);
      if (terminal.exitStatus?.reason === vscode.TerminalExitReason.Shutdown) return;
      if (!id) return;
      const map = read();
      if (!(id in map)) return;
      delete map[id];
      void write(map);
    },
    findTerminalBySessionFile(sessionFile) {
      const map = read();
      for (const [terminalId, file] of Object.entries(map)) {
        if (file !== sessionFile) continue;
        const terminal = terminalsById.get(terminalId);
        if (terminal && terminal.exitStatus === undefined) return terminal;
      }
      return undefined;
    },
    async restore(extensionUri, bridgeConfig) {
      const map = read();
      const valid: TerminalSessionMap = {};
      for (const [terminalId, sessionFile] of Object.entries(map)) {
        if (existsSync(sessionFile)) valid[terminalId] = sessionFile;
      }
      if (Object.keys(valid).length !== Object.keys(map).length) {
        await write(valid);
      }
      for (const [terminalId, sessionFile] of Object.entries(valid)) {
        const terminal = await createNewTerminal({
          extensionUri,
          bridgeConfig,
          terminalId,
          sessionFile,
        });
        if (terminal) {
          terminalIds.set(terminal, terminalId);
          terminalsById.set(terminalId, terminal);
          terminal.show(true);
        }
      }
    },
  };
}
