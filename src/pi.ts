import { accessSync, constants } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { BRIDGE_EXTENSION_PATH } from "./constants.ts";
import { resolvePiBinary } from "./_resolve.ts";
import { createPiGlobalInstallCommand, PI_PACKAGE_MANAGERS } from "./upgrade.ts";

let piExistsCache: boolean | undefined;

/** Invalidate the cached existence check; call when `pi-agent-studio.path` changes. */
export function invalidatePiBinaryCache(): void {
  piExistsCache = undefined;
}

export function findPiBinary(): string {
  const config = vscode.workspace.getConfiguration("pi-agent-studio");
  return resolvePiBinary({
    customPath: config.get<string>("path") || undefined,
    workspaceDirs: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
  });
}

export async function ensurePiBinary(): Promise<string | undefined> {
  const piPath = findPiBinary();

  if (piExistsCache === undefined) {
    try {
      accessSync(piPath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      piExistsCache = true;
    } catch {
      piExistsCache = false;
    }
  }

  if (piExistsCache) return piPath;

  const managers = PI_PACKAGE_MANAGERS.filter((manager) => manager !== "yarn");
  const action = await vscode.window.showErrorMessage(
    "Pi binary not found. Install it globally?",
    ...managers,
  );
  if (action) {
    invalidatePiBinaryCache();
    const terminal = vscode.window.createTerminal({ name: "Install Pi" });
    terminal.show();
    terminal.sendText(createPiGlobalInstallCommand(action));
  }
  return undefined;
}

export async function upgradePiBinary(): Promise<void> {
  const piPath = await ensurePiBinary();
  if (!piPath) return;

  const terminal = vscode.window.createTerminal({ name: "Upgrade Pi" });
  terminal.show();
  terminal.sendText(`pi update`);
  void vscode.window.showInformationMessage("Upgrading Pi via `pi update`.");
}

/**
 * Build the pi CLI argument list (without the binary itself).
 */
export function createPiShellArgs(options: {
  extensionUri: vscode.Uri;
  sessionFile?: string;
  extraArgs?: string[];
}): string[] {
  const userArgs = vscode.workspace.getConfiguration("pi-agent-studio").get<string[]>("args") ?? [];
  const bridgeArgs = ["--extension", join(options.extensionUri.fsPath, BRIDGE_EXTENSION_PATH)];
  const args = options.sessionFile
    ? ["--session", options.sessionFile, ...bridgeArgs, ...userArgs, ...(options.extraArgs ?? [])]
    : [...bridgeArgs, ...userArgs, ...(options.extraArgs ?? [])];
  return args;
}

export function createPiEnvironment(
  bridgeConfig: { url: string; token: string } | undefined,
): Record<string, string> | undefined {
  if (!bridgeConfig) return undefined;
  return {
    PI_VSCODE_BRIDGE_URL: bridgeConfig.url,
    PI_VSCODE_BRIDGE_TOKEN: bridgeConfig.token,
  };
}
