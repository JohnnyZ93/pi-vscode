import { execFile } from "node:child_process";
import { accessSync, constants, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { findPiBinary } from "../pi.ts";

const execFileAsync = promisify(execFile);

const EXTENSION_ID = "johnny-zhao.pi-agent-studio";

export interface SettingsStaticEnv {
  piPath: string;
  extensionVersion: string;
  nodeVersion: string;
}

export function getExtensionVersion(): string {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  const v = ext?.packageJSON?.version as string | undefined;
  return v ?? "(unknown)";
}

/** Synchronous environment info — pi/node versions are fetched separately. */
export function collectStaticEnv(): SettingsStaticEnv {
  return {
    piPath: findPiBinary(),
    extensionVersion: getExtensionVersion(),
    nodeVersion: "(loading…)",
  };
}

/**
 * Locate the `node` binary that actually runs `pi`.
 */
export function findPiNodeBinary(piPath: string): string | undefined {
  const isWin = process.platform === "win32";
  const nodeName = isWin ? "node.exe" : "node";
  const accessFlag = isWin ? constants.F_OK : constants.X_OK;

  const candidates: string[] = [];
  // 1. Same directory as the (real) pi binary — handles nvm/nvm4w/bun/pnpm.
  try {
    const real = realpathSync(piPath);
    candidates.push(join(dirname(real), nodeName));
  } catch {}
  // 2. Same directory as the (configured) pi path, in case the shim itself is the
  //    canonical location (npm global bin where shim and node sit side-by-side).
  try {
    candidates.push(join(dirname(piPath), nodeName));
  } catch {}

  for (const c of candidates) {
    try {
      accessSync(c, accessFlag);
      return c;
    } catch {}
  }
  return undefined;
}

/**
 * Detect the Node.js version that actually runs pi.
 * Falls back to the extension host's `process.version` (annotated) when detection fails.
 */
export async function detectNodeVersion(piPath: string): Promise<string> {
  const nodePath = findPiNodeBinary(piPath);
  if (nodePath) {
    try {
      const { stdout } = await execFileAsync(nodePath, ["-p", "process.versions.node"], {
        timeout: 5000,
        windowsHide: true,
      });
      const v = stdout.trim();
      if (v) return `v${v.replace(/^v/, "")}`;
    } catch {}
  }
  return `(unknown)`;
}

/**
 * Run a pi shim binary on Windows safely.
 */
function execPiShim(
  piPath: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  const isWin = process.platform === "win32";
  const lower = piPath.toLowerCase();
  const isShim =
    isWin && (lower.endsWith(".cmd") || lower.endsWith(".bat") || lower.endsWith(".ps1"));

  const opts = { timeout: timeoutMs, windowsHide: true, encoding: "utf8" as const };

  if (!isShim) {
    return execFileAsync(piPath, args, opts) as Promise<{ stdout: string; stderr: string }>;
  }

  if (lower.endsWith(".ps1")) {
    const quoteSingle = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const ps =
      `& ${quoteSingle(piPath)}` + (args.length ? " " + args.map(quoteSingle).join(" ") : "");
    return execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      opts,
    ) as Promise<{ stdout: string; stderr: string }>;
  }

  // .cmd / .bat — go through cmd.exe explicitly with proper quoting.
  return execFileAsync("cmd.exe", ["/d", "/s", "/c", piPath, ...args], opts) as Promise<{
    stdout: string;
    stderr: string;
  }>;
}

/**
 * Detect pi version by running `pi --version` (10s timeout).
 */
export async function detectPiVersion(piPath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execPiShim(piPath, ["--version"], 10000);
    if (stderr && stderr.trim()) {
      console.error(`[pi-agent-studio] detectPiVersion stderr: ${stderr.trim()}`);
    }
    const trimmed = stdout.trim();
    if (trimmed) {
      // pi --version typically prints just the version (e.g. "0.79.0") or "pi 0.79.0".
      // Take the last whitespace-separated token.
      const last = trimmed.split(/\s+/).pop();
      if (last) return last;
    }
  } catch (err) {
    console.error(`[pi-agent-studio] detectPiVersion failed (piPath=${piPath}):`, err);
  }
  return "(unknown)";
}
