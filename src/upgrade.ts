export const PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";

export type PiPackageManager = "bun" | "npm" | "pnpm" | "yarn";

export const PI_PACKAGE_MANAGERS: readonly PiPackageManager[] = ["npm", "bun", "pnpm", "yarn"];

export function guessPiPackageManager(piPath: string): PiPackageManager | undefined {
  const normalized = piPath.replaceAll("\\", "/").toLowerCase();
  const segments = normalized.split("/").filter(Boolean);
  const hasSegment = (segment: string) => segments.includes(segment);
  const includesPath = (path: string) => normalized.includes(path);

  if (includesPath("/.bun/") || hasSegment("bun")) return "bun";

  if (
    includesPath("/.local/share/pnpm/") ||
    includesPath("/appdata/local/pnpm/") ||
    hasSegment("pnpm") ||
    hasSegment("pnpm-global")
  ) {
    return "pnpm";
  }

  if (includesPath("/.yarn/") || hasSegment("yarn")) return "yarn";

  if (
    includesPath("/.npm-global/") ||
    includesPath("/appdata/roaming/npm/") ||
    hasSegment("npm") ||
    hasSegment("npm-global") ||
    hasSegment("node") ||
    hasSegment("nodejs") ||
    hasSegment(".nvm") ||
    hasSegment(".nodenv") ||
    hasSegment(".asdf") ||
    hasSegment("nvs")
  ) {
    return "npm";
  }

  return undefined;
}

// Pi does not require install scripts for normal npm installs.
export function createPiGlobalInstallCommand(manager: PiPackageManager): string {
  switch (manager) {
    case "bun":
      return `bun add -g --ignore-scripts ${PI_PACKAGE_NAME}`;
    case "npm":
      return `npm install -g --ignore-scripts ${PI_PACKAGE_NAME}`;
    case "pnpm":
      return `pnpm add -g --ignore-scripts ${PI_PACKAGE_NAME}`;
    case "yarn":
      return `yarn global add --ignore-scripts ${PI_PACKAGE_NAME}`;
  }
}

export function createPiUpdateCommand(piPath: string, platform: string): string {
  return `${quoteCommandPath(piPath, platform)} update`;
}

function quoteCommandPath(commandPath: string, platform: string): string {
  if (/^[\w./:@%+-]+$/.test(commandPath)) return commandPath;
  if (platform === "win32") return `"${commandPath.replaceAll('"', '""')}"`;
  return `'${commandPath.replaceAll("'", "'\\''")}'`;
}
