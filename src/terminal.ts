import * as vscode from "vscode";
import { TERMINAL_TITLE } from "./constants.ts";
import { createPiEnvironment, createPiShellArgs, ensurePiBinary } from "./pi.ts";

export async function createNewTerminal(options: {
  extensionUri: vscode.Uri;
  bridgeConfig?: { url: string; token: string };
  extraArgs?: string[];
  terminalId?: string;
  sessionFile?: string;
}): Promise<vscode.Terminal | undefined> {
  const piPath = await ensurePiBinary();
  if (!piPath) return undefined;

  const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const viewColumn = findPiColumn() ?? findUnusedColumn() ?? vscode.ViewColumn.Beside;

  const piArgs = createPiShellArgs({
    extensionUri: options.extensionUri,
    sessionFile: options.sessionFile,
    extraArgs: options.extraArgs,
  });

  const baseEnv = createPiEnvironment(options.bridgeConfig);
  const userEnv =
    vscode.workspace.getConfiguration("pi-vscode").get<Record<string, string>>("env") ?? {};
  const env = {
    ...userEnv,
    ...baseEnv,
    ...(options.terminalId ? { PI_VSCODE_TERMINAL_ID: options.terminalId } : {}),
  };

  const terminal = vscode.window.createTerminal({
    name: TERMINAL_TITLE,
    shellPath: piPath,
    shellArgs: piArgs,
    location: { viewColumn },
    isTransient: true,
    cwd,
    env,
    iconPath: {
      light: vscode.Uri.joinPath(options.extensionUri, "assets", "logo-light.svg"),
      dark: vscode.Uri.joinPath(options.extensionUri, "assets", "logo.svg"),
    },
  });

  void vscode.commands.executeCommand("workbench.action.lockEditorGroup");
  return terminal;
}

function findPiColumn(): vscode.ViewColumn | undefined {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputTerminal && tab.label === TERMINAL_TITLE) {
        return group.viewColumn;
      }
    }
  }
  return undefined;
}

function findUnusedColumn(): vscode.ViewColumn | undefined {
  const used = new Set<vscode.ViewColumn>();
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn !== undefined && group.tabs.length > 0) used.add(group.viewColumn);
  }
  for (let column = vscode.ViewColumn.One; column <= vscode.ViewColumn.Nine; column++) {
    if (!used.has(column)) return column;
  }
  return undefined;
}
