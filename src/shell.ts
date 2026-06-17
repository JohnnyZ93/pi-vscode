import * as vscode from "vscode";

type ShellKind = "bash" | "powershell" | "cmd" | "unknown";

/**
 * Resolve the shell path to use for launching pi.
 * Priority: pi-vscode.shell → VS Code default terminal profile → error.
 */
export function resolveShellPath(): string | undefined {
  const config = vscode.workspace.getConfiguration("pi-vscode");
  const customShell = config.get<string>("shell");
  if (customShell) return customShell;

  const defaultProfile = readDefaultProfile();
  if (defaultProfile) {
    const profilePath = readProfilePath(defaultProfile);
    if (profilePath) return profilePath;
  }

  void vscode.window.showErrorMessage(
    "Cannot determine shell for Pi terminal. Set 'pi-vscode.shell' to an absolute shell path, or configure 'terminal.integrated.defaultProfile.{platform}' in VS Code settings.",
  );
  return undefined;
}

function readDefaultProfile(): string | undefined {
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  const platform = process.platform;
  const key = platform === "win32" ? "windows" : platform === "darwin" ? "osx" : "linux";
  return terminalConfig.get<string>(`defaultProfile.${key}`);
}

function readProfilePath(profileName: string): string | undefined {
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  const platform = process.platform;
  const key = platform === "win32" ? "windows" : platform === "darwin" ? "osx" : "linux";
  const profiles = terminalConfig.get<Record<string, { path?: string }>>(`profiles.${key}`);
  return profiles?.[profileName]?.path;
}

/**
 * Detect the shell kind from its executable path.
 */
export function detectShellKind(shellPath: string): ShellKind {
  const lower = shellPath.toLowerCase().replaceAll("\\", "/");
  const basename = lower.split("/").pop() ?? "";

  if (
    basename === "bash" ||
    basename === "zsh" ||
    basename === "sh" ||
    basename.startsWith("git-bash") ||
    basename.includes("bash")
  ) {
    return "bash";
  }
  if (basename === "pwsh" || basename === "powershell" || basename.startsWith("pwsh")) {
    return "powershell";
  }
  if (basename === "cmd" || basename === "cmd.exe") {
    return "cmd";
  }
  return "unknown";
}

/**
 * Build shell arguments that execute the given command.
 * Uses interactive login shell flags so ~/.bash_profile / ~/.zprofile are sourced
 * and interactive-only init scripts (e.g. conda) run correctly.
 */
export function buildShellArgs(shellPath: string, command: string): string[] {
  const kind = detectShellKind(shellPath);
  switch (kind) {
    case "powershell":
      return ["-Login", "-Command", command];
    case "cmd":
      return ["/c", command];
    case "bash":
    case "unknown":
    default:
      return ["-i", "-l", "-c", command];
  }
}
