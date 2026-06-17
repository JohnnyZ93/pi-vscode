import { accessSync, constants, realpathSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { BRIDGE_BOOTSTRAP_PROMPT, BRIDGE_EXTENSION_PATH } from "./constants.ts";
import { resolvePiBinary } from "./_resolve.ts";
import {
  createPiGlobalInstallCommand,
  createPiUpgradeCommand,
  guessPiPackageManager,
  PI_PACKAGE_MANAGERS,
  type PiPackageManager,
} from "./upgrade.ts";

let piExistsCache: boolean | undefined;

export function findPiBinary(): string {
  const config = vscode.workspace.getConfiguration("pi-vscode");
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
    piExistsCache = undefined;
    const terminal = vscode.window.createTerminal({ name: "Install Pi" });
    terminal.show();
    terminal.sendText(createPiGlobalInstallCommand(action));
  }
  return undefined;
}

export async function upgradePiBinary(): Promise<void> {
  const piPath = await ensurePiBinary();
  if (!piPath) return;

  let manager: PiPackageManager | undefined = guessPiPackageManager(piPath);
  if (!manager) {
    try {
      manager = guessPiPackageManager(realpathSync(piPath));
    } catch {}
  }
  if (!manager) {
    manager = (await vscode.window.showQuickPick([...PI_PACKAGE_MANAGERS], {
      placeHolder: `Could not infer the package manager for ${piPath}. Choose one to upgrade Pi globally.`,
    })) as PiPackageManager | undefined;
  }
  if (!manager) return;

  const terminal = vscode.window.createTerminal({ name: "Upgrade Pi" });
  terminal.show();
  terminal.sendText(createPiUpgradeCommand(manager, piPath));
  void vscode.window.showInformationMessage(`Upgrading Pi with ${manager}. Found pi at: ${piPath}`);
}

export function createPiShellArgs(options: {
  extensionUri: vscode.Uri;
  sessionFile?: string;
  extraArgs?: string[];
}): string[] {
  const userArgs = vscode.workspace.getConfiguration("pi-vscode").get<string[]>("args") ?? [];
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

/**
 * Build the pi command string for shell execution.
 * Uses `exec` so the terminal closes when pi exits.
 */
export function buildPiCommand(piPath: string, piArgs: string[]): string {
  const quotedPath = quoteForShell(piPath);
  const quotedArgs = piArgs.map(quoteForShell).join(" ");
  if (quotedArgs) {
    return `exec ${quotedPath} ${quotedArgs}`;
  }
  return `exec ${quotedPath}`;
}

function quoteForShell(arg: string): string {
  if (/^[\w./:@%+\-=,]+$/.test(arg)) return arg;
  const escaped = arg.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}
