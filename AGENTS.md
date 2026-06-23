# AGENTS.md

This file provides guidance to Code Agent when working with code in this repository.

**Always keep AGENTS.md updated with project status.**

## Build & Run

- `pnpm build` / `pnpm dev` (watch) / `pnpm package` (builds + `vsce package --no-dependencies`)
- `pnpm fmt` — auto-fix with `oxlint --fix` + `oxfmt`
- `pnpm lint` — `oxlint . && oxfmt --check .`
- `pnpm typecheck` — `tsgo --noEmit --skipLibCheck` (Microsoft TypeScript Native Preview, NOT `tsc`)
- `pnpm test` — runs `lint && typecheck` only. **`vitest` is installed but not wired into `pnpm test`**; run it directly: `pnpm vitest run`
- `pnpm install-local` — package and install the `.vsix` into local VS Code
- `pnpm release [major|minor|patch]` — bumps `package.json`, packages, commits, tags, pushes (CI publishes). Add `--local` to publish via `vsce`/`ovsx` from the dev machine
- Always run `pnpm fmt` **and** `pnpm typecheck` before finalizing changes

## Architecture Overview

Three cooperating pieces, no framework:

1. **VS Code extension host** (`src/extension.ts` → `dist/extension.cjs`) — Activates `onStartupFinished`, registers commands/views/status bar, owns the local bridge lifecycle.
2. **Local HTTP bridge** (`src/bridge/*`) — `createBridge` boots a localhost server with a per-session auth token. URL+token are injected as `PI_VSCODE_BRIDGE_URL` / `PI_VSCODE_BRIDGE_TOKEN` env vars into every pi terminal, alongside a per-terminal `PI_VSCODE_TERMINAL_ID`. Handlers serve RPC calls for editor state, diagnostics, symbols, definitions, hovers, references, code actions, formatting, and workspace edits.
3. **Bundled pi extension** (`bridge/pi-vscode-bridge.js`) — Loaded into every pi launch via `--extension <path>`. Registers `vscode_*` tools that call the bridge over HTTP. Also refreshes `ctx.ui.setStatus("pi-vscode", ...)` every ~1.5s so pi's TUI footer reflects live VS Code context.

Terminal launch flow (`src/terminal.ts` + `src/pi.ts`):

- Pi is spawned **directly** by VS Code's terminal: `shellPath = piPath`, `shellArgs = piArgs`.
- Implication for `pi-agent-studio.path`: point it at whatever pi shim works in your environment. On Windows nvm4w/npm setups, `pi.cmd` runs via cmd, `pi.ps1` via PowerShell — both fine.
- For short-lived child processes (`pi --version` in `settings-env.ts`, package-manager probes in `upgrade.ts`), use plain `execFile(piPath, args, ...)`. On Windows `child_process.execFile` runs `.cmd`/`.bat` via cmd internally when the path has that extension — no manual shell wrapping required for the current pi shims.
- Bridge extension is appended via `--extension bridge/pi-vscode-bridge.js`. User extra args (`pi-agent-studio.args`) and user env (`pi-agent-studio.env`) are merged in; bridge env wins on key collision.

Session restoration (`src/sessions.ts`):

- On `session_start`, the bundled bridge RPCs `reportTerminalSession({terminalId, sessionFile})`. The tracker persists `{terminalId → sessionFile}` to `workspaceState["pi-agent-studio.terminalSessions"]`.
- On activation, each stored entry (whose `sessionFile` still exists on disk) is relaunched with `--session <sessionFile>` so conversations survive IDE reload. Terminals closed by the user (non-`Shutdown` exit reason) are pruned from the map; missing-on-disk entries are also pruned on restore.
- The tracker also keeps an in-memory `terminalsById: Map<terminalId, vscode.Terminal>` so the Sessions sidebar can call `findTerminalBySessionFile(sessionFile)` and **reuse** an already-open terminal instead of spawning a duplicate. The Sessions sidebar header has a `+` button that delegates to `pi-agent-studio.open` for blank-session creation.

CJS wrapper pattern: source is ESM (`"type": "module"`), bundled by rolldown → `dist/extension.cjs` (CJS, `external: vscode`, minified). VS Code's `require()` loader works because the output is CJS.

Sidebar views (all webview, registered under `pi` activity container):

- **Sessions** (`src/sessions/`) — Per-workspace session list; dropdown when multiple workspace folders exist (lazy per-folder fetch). The Sessions sidebar header has a `+` button that opens a folder picker (or workspace root when single) and delegates to `pi-agent-studio.openInFolder` so new terminals start in the chosen directory.
- **Models** (`src/models/`) — Three tabs: Providers (CRUD), OAuth, API Keys. Reads/writes `~/.pi/agent/models.json` and `auth.json` through `models-config.ts` / `auth-config.ts` using **pure Node.js fs** to bypass pi SDK's shell-dependent APIs (`EINVAL` on Windows without bash).
- **Settings** (`src/settings/`) — Env info, links, `Upgrade Pi` button, `Open settings.json`, and two textareas: **Append** (`~/.pi/agent/APPEND_SYSTEM.md`) and **Override** (`~/.pi/agent/SYSTEM.md`). Pi auto-loads these via its `DefaultResourceLoader`, so no CLI flags are injected. Default `visibility: collapsed`. Node version shown in the env block is the Node that **actually runs pi**, not the extension host: `detectNodeVersion` (`settings-env.ts`) realpaths `piPath`, looks for `node`/`node.exe` in the same directory (matches nvm/nvm4w/bun/pnpm layouts), then `execFile`s `-p process.versions.node`. Falls back to `process.version + " (extension host)"` when no sibling node is found — do NOT replace this with `process.version`, that returns VS Code's bundled Node (e.g. v24) and misleads nvm users.
- Packages sidebar (`src/packages.ts`) exists in source but is **not** registered in `package.json` views — code is currently dormant; verify before referencing.

## Critical Patterns

- **Pi npm package is `@earendil-works/pi-coding-agent`** (see `src/upgrade.ts` `PI_PACKAGE_NAME`). The README/install instructions still mention the legacy `@mariozechner/pi-coding-agent` name — do not propagate the old name into new code.
- **Pi binary resolution** (`src/_resolve.ts`): workspace `node_modules/.bin/pi` → known global dirs (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`) → PATH → fallback `"pi"`. On Windows, **explicit `customPath` is respected as-is when the file exists**. Only when the configured path is missing do we probe `.exe` → `.cmd` → `.ps1` (auto-detect on workspace/global/PATH lookups also uses that order, so the default lands on `.cmd` which VS Code spawns cleanly). Use `F_OK` not `X_OK` on Windows. `piExistsCache` (in `src/pi.ts`) is invalidated by `invalidatePiBinaryCache()` — wired to `onDidChangeConfiguration("pi-agent-studio.path")` and to the post-install prompt branch.
- **Package manager inference was removed; upgrade now uses `pi update`.** First-time install still prompts the user to pick a manager (`PI_PACKAGE_MANAGERS`) and runs `createPiGlobalInstallCommand` with `--ignore-scripts` for npm/bun/pnpm.
- **Models Providers tab** uses event delegation with `data-action`/`data-id` (no inline `onclick` string concatenation — broke on dashes/quotes in ids). Renames combine with field updates into a single `renameProviderAndUpdate` message so they apply atomically. Empty-string fields are sent as `null` and converted to `undefined` so `JSON.stringify` drops them.
- **OAuth flow** (`src/models/oauth-flow.ts`) mirrors pi-web's `app/api/auth/login/[provider]/route.ts`: drives `AuthStorage.login()` with a shared memoized "manual input" request so `onAuth` / `onPrompt` / `onManualCodeInput` resolve the same promise. **Let `AuthStorage.login()` persist credentials itself** — do NOT write a placeholder credential afterwards (corrupts the SDK-managed entry).
- **Bridge details**: `vscode_get_selection` falls back to the latest cached VS Code selection while the pi terminal has focus. Mutating bridge tools are marked sequential. The bundled bridge truncates oversized JSON tool results into a valid wrapper object. VS Code chat RPC auto-cancels unsupported extension UI dialog requests so RPC sessions do not deadlock.
- **Formatting bridge methods** (`formatDocument`/`formatRange`) call `vscode.executeFormatDocumentProvider` / `executeFormatRangeProvider`, then convert `TextEdit[]` → `WorkspaceEdit` → `workspace.applyEdit` (safer than shelling out for open/dirty buffers).
- `BRIDGE_BOOTSTRAP_PROMPT` is defined in `src/constants.ts` but currently **unused** — kept for the bundled bridge to inject. Don't assume the extension host wires it.
- `rolldown.config.ts` must not use unsupported `output.clean`. Keep output minimal to avoid build warnings.
- Icons: see `.agents/docs/icons.md`. The custom `$(pi-logo)` codicon is generated by `fantasticon`; the glyph code in `assets/fonts/pi-icons.json` must match `fontCharacter` in `package.json` (currently `\F101`).



