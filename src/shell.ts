import { accessSync, constants } from "node:fs";
import { extname, join } from "node:path";

export type ShellKind = "bash" | "powershell" | "cmd";

export interface ShellSpec {
  /** Absolute path or bare name of the shell binary */
  path: string;
  /** Logical kind, used by command/quoting builders */
  kind: ShellKind;
}

export interface ResolveShellOptions {
  platform?: string;
  pathEnv?: string;
  programFiles?: string;
  programFilesX86?: string;
  localAppData?: string;
  access?: (path: string, mode: number) => void;
}

/**
 * Pick a shell that can launch the given pi binary.
 *
 * Unix is trivial: any POSIX shell can `exec` pi.
 * Windows is path-dependent because npm/pnpm/bun produce shims with
 * different extensions (.cmd / .ps1 / no-ext bash script / occasionally .exe),
 * and not every shell can run every shim:
 *   .ps1                 → must use powershell
 *   .cmd / .bat / .exe   → cmd.exe is most reliable (no execution-policy issues,
 *                          no `exec` keyword expected)
 *   no extension         → bash shim (e.g. nvm4w / npm POSIX shim); cmd and
 *                          powershell can't execute it. We probe Git for
 *                          Windows install dirs first (`%ProgramFiles%\Git\bin`
 *                          etc.), THEN scan PATH while skipping
 *                          System32/SysWOW64/Sysnative — those host the WSL
 *                          launcher `bash.exe`, not POSIX bash, and would
 *                          route pi through a Linux subsystem with mangled
 *                          paths. Falls back to bare `bash` if none found —
 *                          if even that fails the terminal surfaces the
 *                          error loudly, which is the right signal.
 */
export function resolveShellForPi(piPath: string, opts: ResolveShellOptions = {}): ShellSpec {
  const platform = opts.platform ?? process.platform;
  if (platform === "win32") {
    const ext = extname(piPath).toLowerCase();
    if (ext === ".ps1") {
      return { path: "powershell", kind: "powershell" };
    }
    if (ext === "") {
      return { path: findWindowsBash(opts) ?? "bash", kind: "bash" };
    }
    return { path: process.env.ComSpec || "cmd.exe", kind: "cmd" };
  }
  return { path: process.env.SHELL || "/bin/bash", kind: "bash" };
}

function findWindowsBash(opts: ResolveShellOptions): string | null {
  const access = opts.access ?? accessSync;
  const pathEnv = opts.pathEnv ?? process.env.PATH ?? "";
  const programFiles = opts.programFiles ?? process.env.ProgramFiles ?? "";
  const programFilesX86 = opts.programFilesX86 ?? process.env["ProgramFiles(x86)"] ?? "";
  const localAppData = opts.localAppData ?? process.env.LOCALAPPDATA ?? "";

  // Git for Windows FIRST. We deliberately prefer this over PATH because
  // Windows ships `C:\Windows\System32\bash.exe` — the WSL launcher, NOT a
  // POSIX bash. Letting it win would route the pi shim through a Linux
  // subsystem with mangled Win32 paths.
  const gitRoots: string[] = [];
  if (programFiles) gitRoots.push(join(programFiles, "Git"));
  if (programFilesX86) gitRoots.push(join(programFilesX86, "Git"));
  if (localAppData) gitRoots.push(join(localAppData, "Programs", "Git"));

  for (const root of gitRoots) {
    for (const sub of [join("bin", "bash.exe"), join("usr", "bin", "bash.exe")]) {
      const candidate = join(root, sub);
      try {
        access(candidate, constants.F_OK);
        return candidate;
      } catch {}
    }
  }

  // Fall back to PATH, skipping the WSL launcher locations.
  for (const dir of pathEnv.split(";")) {
    if (!dir) continue;
    if (isWslBashDir(dir)) continue;
    const candidate = join(dir, "bash.exe");
    try {
      access(candidate, constants.F_OK);
      return candidate;
    } catch {}
  }

  return null;
}

/** Skip system directories where `bash.exe` is the WSL launcher, not POSIX bash. */
function isWslBashDir(dir: string): boolean {
  const normalized = dir.replaceAll("/", "\\").toLowerCase().replace(/\\+$/, "");
  return (
    normalized.endsWith("\\system32") ||
    normalized.endsWith("\\syswow64") ||
    normalized.endsWith("\\sysnative")
  );
}

/**
 * Build shell arguments that execute the given command string.
 *
 * Bash/zsh use interactive login flags so ~/.bash_profile / ~/.zprofile run
 * (needed for nvm, conda, asdf, etc.).
 * PowerShell uses -NoProfile -ExecutionPolicy Bypass to avoid script-policy
 * failures on .ps1 shims; -NoLogo for cleaner UX.
 */
export function buildShellArgs(kind: ShellKind, command: string): string[] {
  switch (kind) {
    case "powershell":
      return ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command];
    case "cmd":
      return ["/d", "/c", command];
    case "bash":
      return ["-i", "-l", "-c", command];
  }
}

/**
 * Non-interactive variant of {@link buildShellArgs} for short-lived child
 * processes (e.g. `pi --version`, `pi list`). Skips bash's `-i -l` flags so
 * we don't read user rc files — those can print banners, slow things down,
 * or block on prompts. Powershell/cmd already are non-interactive.
 */
export function buildShellArgsNonInteractive(kind: ShellKind, command: string): string[] {
  switch (kind) {
    case "powershell":
      return ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command];
    case "cmd":
      return ["/d", "/c", command];
    case "bash":
      return ["-c", command];
  }
}

/**
 * Build the command string that runs pi inside the chosen shell.
 *
 * Each shell needs its own quoting + invocation form:
 *   bash       → `exec '<path>' arg1 arg2`              (replaces shell process; clean exit)
 *   powershell → `& '<path>' arg1 arg2`                 (call operator; PowerShell has no `exec`)
 *   cmd        → `"<path>" arg1 arg2`                   (cmd has no `exec`; quoting via "")
 */
export function buildPiCommand(kind: ShellKind, piPath: string, piArgs: string[]): string {
  switch (kind) {
    case "bash": {
      const parts = [quoteBash(piPath), ...piArgs.map(quoteBash)];
      return `exec ${parts.join(" ")}`;
    }
    case "powershell": {
      const parts = [quotePowershell(piPath), ...piArgs.map(quotePowershell)];
      return `& ${parts.join(" ")}`;
    }
    case "cmd": {
      const parts = [quoteCmd(piPath), ...piArgs.map(quoteCmd)];
      return parts.join(" ");
    }
  }
}

/** Single-quote for POSIX shells. Any embedded `'` becomes `'\''`. */
function quoteBash(arg: string): string {
  if (/^[\w./:@%+\-=,]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", "'\\''")}'`;
}

/** Single-quote for PowerShell. Any embedded `'` becomes `''`. */
function quotePowershell(arg: string): string {
  if (/^[\w./:@%+\-=,]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", "''")}'`;
}

/**
 * Double-quote for cmd.exe. Embedded `"` → `""`. Embedded `%` is left alone
 * (we don't expect env-var refs in pi args; if it ever matters, callers should
 * disable delayed expansion explicitly).
 */
function quoteCmd(arg: string): string {
  if (/^[\w./:\\@%+\-=,]+$/.test(arg)) return arg;
  return `"${arg.replaceAll('"', '""')}"`;
}
