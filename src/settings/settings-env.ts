import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { findPiBinary } from "../pi.ts";

const execFileAsync = promisify(execFile);

const EXTENSION_ID = "johnny-zhao.pi-vscode";

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

export function getNodeVersion(): string {
  return process.version;
}

/** Synchronous environment info — pi version is fetched separately via {@link detectPiVersion}. */
export function collectStaticEnv(): SettingsStaticEnv {
  return {
    piPath: findPiBinary(),
    extensionVersion: getExtensionVersion(),
    nodeVersion: getNodeVersion(),
  };
}

/**
 * Detect pi version:
 * 1. Run `pi --version` (5s timeout).
 * 2. Fallback: read SDK package.json from extension's node_modules.
 * 3. Fallback: "(unknown)".
 */
export async function detectPiVersion(piPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(piPath, ["--version"], {
      timeout: 5000,
      windowsHide: true,
    });
    const trimmed = stdout.trim();
    if (trimmed) {
      // pi --version typically prints just the version (e.g. "0.79.0") or "pi 0.79.0".
      // Take the last whitespace-separated token.
      const last = trimmed.split(/\s+/).pop();
      if (last) return last;
    }
  } catch {
    // fall through to SDK fallback
  }

  try {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (ext) {
      const pkgPath = join(
        ext.extensionPath,
        "node_modules",
        "@earendil-works",
        "pi-coding-agent",
        "package.json",
      );
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    }
  } catch {
    // ignore
  }

  return "(unknown)";
}
