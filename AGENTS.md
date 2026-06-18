# AGENTS.md

This file provides guidance to Code Agent when working with code in this repository.

**Always keep AGENTS.md updated with project status.**

## Build & Run

- `pnpm build` / `pnpm dev` (watch) / `pnpm package` (builds + `vsce package --no-dependencies`)
- `pnpm fmt` — auto-fix with `oxlint --fix` + `oxfmt`
- `pnpm lint` — `oxlint . && oxfmt --check .`
- `pnpm typecheck` — `tsgo --noEmit --skipLibCheck` (Microsoft TypeScript Native Preview, NOT `tsc`)
- `pnpm test` — runs `lint && typecheck` only. **`vitest` is installed but not wired into `pnpm test`**; run it directly: `pnpm vitest run` or `pnpm vitest run test/resolve.test.ts`
- `pnpm install-local` — package and install the `.vsix` into local VS Code
- `pnpm release [major|minor|patch]` — bumps `package.json`, packages, commits, tags, pushes (CI publishes). Add `--local` to publish via `vsce`/`ovsx` from the dev machine
- Always run `pnpm fmt` **and** `pnpm typecheck` before finalizing changes

## Architecture Overview

Three cooperating pieces, no framework:

1. **VS Code extension host** (`src/extension.ts` → `dist/extension.cjs`) — Activates `onStartupFinished`, registers commands/views/status bar, owns the local bridge lifecycle.
2. **Local HTTP bridge** (`src/bridge/*`) — `createBridge` boots a localhost server with a per-session auth token. URL+token are injected as `PI_VSCODE_BRIDGE_URL` / `PI_VSCODE_BRIDGE_TOKEN` env vars into every pi terminal, alongside a per-terminal `PI_VSCODE_TERMINAL_ID`. Handlers serve RPC calls for editor state, diagnostics, symbols, definitions, hovers, references, code actions, formatting, and workspace edits.
3. **Bundled pi extension** (`bridge/pi-vscode-bridge.js`) — Loaded into every pi launch via `--extension <path>`. Registers `vscode_*` tools that call the bridge over HTTP. Also refreshes `ctx.ui.setStatus("pi-vscode", ...)` every ~1.5s so pi's TUI footer reflects live VS Code context.

Terminal launch flow (`src/terminal.ts` + `src/pi.ts` + `src/shell.ts`):

- Pi is **not** spawned directly. The terminal's `shellPath` is a real shell (resolved from `pi-vscode.shell`, else OS default: `powershell` on Windows, `zsh` on macOS, `bash` on Linux — bare names, relying on PATH); `shellArgs` invokes `exec <pi> <args>` so the terminal closes when pi exits. This is required for interactive login shells (`-i -l` for bash/zsh, `-Login -Command` for PowerShell, `/c` for cmd) to source profile scripts like conda/nvm.
- Bridge extension is appended via `--extension bridge/pi-vscode-bridge.js`. User extra args (`pi-vscode.args`) and user env (`pi-vscode.env`) are merged in; bridge env wins on key collision.
- Terminal placement: reuses existing PI Code column → first unused ViewColumn → `Beside`. Editor group is locked after creation.

Session restoration (`src/sessions.ts`):

- On `session_start`, the bundled bridge RPCs `reportTerminalSession({terminalId, sessionFile})`. The tracker persists `{terminalId → sessionFile}` to `workspaceState["pi-vscode.terminalSessions"]`.
- On activation, each stored entry (whose `sessionFile` still exists on disk) is relaunched with `--session <sessionFile>` so conversations survive IDE reload. Terminals closed by the user (non-`Shutdown` exit reason) are pruned from the map; missing-on-disk entries are also pruned on restore.

CJS wrapper pattern: source is ESM (`"type": "module"`), bundled by rolldown → `dist/extension.cjs` (CJS, `external: vscode`, minified). VS Code's `require()` loader works because the output is CJS.

Sidebar views (all webview, registered under `pi` activity container):

- **Sessions** (`src/sessions/`) — Per-workspace session list; dropdown when multiple workspace folders exist (lazy per-folder fetch).
- **Models** (`src/models/`) — Three tabs: Providers (CRUD), OAuth, API Keys. Reads/writes `~/.pi/agent/models.json` and `auth.json` through `models-config.ts` / `auth-config.ts` using **pure Node.js fs** to bypass pi SDK's shell-dependent APIs (`EINVAL` on Windows without bash).
- **Settings** (`src/settings/`) — Env info, links, `Upgrade Pi` button, `Open settings.json`, and two textareas: **Append** (`~/.pi/agent/APPEND_SYSTEM.md`) and **Override** (`~/.pi/agent/SYSTEM.md`). Pi auto-loads these via its `DefaultResourceLoader`, so no CLI flags are injected. Default `visibility: collapsed`.
- Packages sidebar (`src/packages.ts`) exists in source but is **not** registered in `package.json` views — code is currently dormant; verify before referencing.

## Critical Patterns

- **Pi npm package is `@earendil-works/pi-coding-agent`** (see `src/upgrade.ts` `PI_PACKAGE_NAME`). The README/install instructions still mention the legacy `@mariozechner/pi-coding-agent` name — do not propagate the old name into new code.
- **Pi binary resolution** (`src/_resolve.ts`): workspace `node_modules/.bin/pi` → known global dirs (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`) → PATH → fallback `"pi"`. On Windows, extensionless paths are probed for `.cmd` / `.exe` / `.ps1` because extensionless npm shims are bash scripts that cannot be spawned. Use `F_OK` not `X_OK` on Windows.
- **Package manager inference** (`src/upgrade.ts` `guessPiPackageManager`): path-segment heuristic. `npm install --global` uses `--ignore-scripts`. `Pi: Upgrade Pi` only upgrades the binary; `createPiUpgradeCommand` (binary + `pi update`) exists but is intentionally **not** wired to any command yet.
- **Models Providers tab** uses event delegation with `data-action`/`data-id` (no inline `onclick` string concatenation — broke on dashes/quotes in ids). Renames combine with field updates into a single `renameProviderAndUpdate` message so they apply atomically. Empty-string fields are sent as `null` and converted to `undefined` so `JSON.stringify` drops them.
- **OAuth flow** (`src/models/oauth-flow.ts`) mirrors pi-web's `app/api/auth/login/[provider]/route.ts`: drives `AuthStorage.login()` with a shared memoized "manual input" request so `onAuth` / `onPrompt` / `onManualCodeInput` resolve the same promise. **Let `AuthStorage.login()` persist credentials itself** — do NOT write a placeholder credential afterwards (corrupts the SDK-managed entry).
- **Bridge details**: `vscode_get_selection` falls back to the latest cached VS Code selection while the pi terminal has focus. Mutating bridge tools are marked sequential. The bundled bridge truncates oversized JSON tool results into a valid wrapper object. VS Code chat RPC auto-cancels unsupported extension UI dialog requests so RPC sessions do not deadlock.
- **Formatting bridge methods** (`formatDocument`/`formatRange`) call `vscode.executeFormatDocumentProvider` / `executeFormatRangeProvider`, then convert `TextEdit[]` → `WorkspaceEdit` → `workspace.applyEdit` (safer than shelling out for open/dirty buffers).
- `BRIDGE_BOOTSTRAP_PROMPT` is defined in `src/constants.ts` but currently **unused** — kept for the bundled bridge to inject. Don't assume the extension host wires it.
- `rolldown.config.ts` must not use unsupported `output.clean`. Keep output minimal to avoid build warnings.
- Icons: see `.agents/docs/icons.md`. The custom `$(pi-logo)` codicon is generated by `fantasticon`; the glyph code in `assets/fonts/pi-icons.json` must match `fontCharacter` in `package.json` (currently `\F101`).

## Commands (declared in `package.json`)

- `pi-vscode.open` (`Alt+Shift+P`) — open/focus pi terminal (also editor title bar)
- `pi-vscode.openInNewWindow` — open pi then `workbench.action.moveEditorToNewWindow`
- `pi-vscode.upgrade` — binary-only upgrade flow (does **not** run `pi update`)

> Earlier docs mentioned `Pi: Open with File`, `Pi: Send Selection`, and an `@pi` chat participant. These are removed — do not re-add references unless reimplemented.

## Configuration

- `pi-vscode.path` — absolute path to pi binary (empty = auto-detect)
- `pi-vscode.shell` — absolute shell path (empty = OS default: `powershell` / `zsh` / `bash`)
- `pi-vscode.env` — env vars merged into pi terminal (bridge vars override on collision)
- `pi-vscode.args` — extra CLI args appended after `--extension` and before any caller-supplied `extraArgs`
