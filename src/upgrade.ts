export const PI_PACKAGE_NAME = "@earendil-works/pi-coding-agent";

export type PiPackageManager = "bun" | "npm" | "pnpm" | "yarn";

export const PI_PACKAGE_MANAGERS: readonly PiPackageManager[] = ["npm", "bun", "pnpm", "yarn"];

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
