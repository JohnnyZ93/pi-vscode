import * as vscode from "vscode";

type ShellKind = "bash" | "powershell" | "cmd" | "unknown";

/**
 * Resolve the shell path to use for launching pi.
 * Priority: pi-vscode.shell → OS default shell.
 * - Windows: powershell
 * - macOS: zsh
 * - Linux/other: bash
 */
export function resolveShellPath(): string | undefined {
  const customShell = vscode.workspace.getConfiguration("pi-vscode").get<string>("shell");
  if (customShell) return customShell;

  switch (process.platform) {
    case "win32":
      return "powershell";
    case "darwin":
      return "zsh";
    default:
      return "bash";
  }
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
