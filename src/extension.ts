import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { createBridge } from "./bridge/server.ts";
import { TERMINAL_TITLE } from "./constants.ts";
import { upgradePiBinary, invalidatePiBinaryCache } from "./pi.ts";
import { createSessionsViewProvider } from "./sessions/sessions-sidebar.ts";
import { createModelsViewProvider } from "./models/models-sidebar.ts";
import { createSettingsViewProvider } from "./settings/settings-sidebar.ts";
import { createSessionTracker } from "./sessions.ts";
import { createNewTerminal } from "./terminal.ts";

let extensionUri: vscode.Uri;
let bridgeConfig: { url: string; token: string } | undefined;
let bridgeDispose: (() => Promise<void>) | undefined;

export async function activate(context: vscode.ExtensionContext) {
  extensionUri = context.extensionUri;

  const sessions = createSessionTracker(context);
  const bridge = await createBridge(context, (terminalId, sessionFile) => {
    sessions.update(terminalId, sessionFile);
  });
  bridgeConfig = { url: bridge.url, token: bridge.token };
  bridgeDispose = () => bridge.dispose();
  context.subscriptions.push({
    dispose: () => {
      const dispose = bridgeDispose;
      bridgeDispose = undefined;
      bridgeConfig = undefined;
      void dispose?.();
    },
  });

  const openTerminal = async (extraArgs?: string[]): Promise<vscode.Terminal | undefined> => {
    const terminalId = randomUUID();
    const terminal = await createNewTerminal({
      extensionUri,
      bridgeConfig,
      extraArgs,
      terminalId,
    });
    if (terminal) sessions.track(terminal, terminalId);
    return terminal;
  };

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(pi-logo) Pi";
  statusBarItem.tooltip = "Open Pi Terminal";
  statusBarItem.command = "pi-vscode.open";
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.window.onDidCloseTerminal((terminal) => sessions.onClose(terminal)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("pi-vscode.path")) invalidatePiBinaryCache();
    }),
    vscode.commands.registerCommand("pi-vscode.open", async () => {
      const terminal = await openTerminal();
      terminal?.show();
    }),
    vscode.commands.registerCommand("pi-vscode.openInNewWindow", async () => {
      const terminal = await openTerminal();
      if (!terminal) return;
      terminal.show();
      await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
    }),
    vscode.commands.registerCommand("pi-vscode.upgrade", upgradePiBinary),
    vscode.window.registerWebviewViewProvider(
      "pi-vscode.sessions",
      createSessionsViewProvider(extensionUri, bridgeConfig),
    ),
    vscode.window.registerWebviewViewProvider("pi-vscode.models", createModelsViewProvider()),
    vscode.window.registerWebviewViewProvider("pi-vscode.settings", createSettingsViewProvider()),
  );

  if (bridgeConfig) void sessions.restore(extensionUri, bridgeConfig);
}

export async function deactivate() {
  for (const terminal of vscode.window.terminals) {
    if (terminal.name === TERMINAL_TITLE) terminal.dispose();
  }
  const dispose = bridgeDispose;
  bridgeDispose = undefined;
  bridgeConfig = undefined;
  await dispose?.();
}
