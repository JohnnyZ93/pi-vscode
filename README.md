<div align="center">

<img src="assets/icon.png" alt="Pi VSCode Logo" width="120" height="120">

# Pi Agent for VS Code

**A minimal VS Code extension for the [pi coding agent](https://pi.dev/) — terminal TUI, sessions, models, and an IDE bridge** 🔥

English | [简体中文](README.zh-CN.md)

</div>

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/johnny-zhao.pi-vscode?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/johnny-zhao/pi-vscode?label=Open%20VSX&color=purple)](https://open-vsx.org/extension/johnny-zhao/pi-vscode)
[![License](https://img.shields.io/github/license/JohnnyZ93/pi-vscode?color=orange&label=License)](https://github.com/JohnnyZ93/pi-vscode/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/JohnnyZ93/pi-vscode?style=social)](https://github.com/JohnnyZ93/pi-vscode)

## Features

- **Terminal-based** — Opens pi as an integrated terminal with full TUI/PTY support, placed beside the editor
- **VS Code bridge** — Bundles a pi extension and local HTTP bridge for live editor data
- **Live VS Code footer status** — pi's terminal UI shows the active VS Code file, cursor/selection, language, dirty marker, and diagnostic counts in its bottom status area
- **Diagnostics tool** — The agent can read VS Code diagnostics (LSP / lint / type errors) on demand via `vscode_get_diagnostics`
- **Slash commands** — `/vscode-selection` and `/vscode-diagnostics` inject the current editor selection or diagnostics into the conversation, with the rest of the editor surface intentionally kept off-limits to the model
- **Session restoration** — Per-workspace pi sessions are persisted and relaunched with `--session` after IDE reload
- **Sidebar views** — `Sessions`, `Models` (Providers / OAuth / API Keys), and `Settings` (env info, system prompt override/append) — all backed by webviews that read/write `~/.pi/agent/*.json` directly
- **Status bar / title bar buttons** — Pi button on the editor title bar for quick access
- **Auto-detection** — Finds the pi binary automatically from common paths (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`)
- **Cross-platform shell handling** — Path-driven shell selection (bash / PowerShell / cmd) with first-class support for nvm4w + git-bash on Windows

<img width="725" height="945" alt="Pi VSCode screenshot" src="./docs/screenshot.png" />

## Requirements

- `pi` CLI installed:

  ```bash
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  bun add -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  pnpm add -g --ignore-scripts @earendil-works/pi-coding-agent
  # or
  yarn global add --ignore-scripts @earendil-works/pi-coding-agent
  ```

- An API key (or OAuth credential) configured for at least one provider — manage them from the **Models** sidebar

## Install

Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-vscode) and [Open VSX](https://open-vsx.org/extension/johnny-zhao/pi-vscode):

```bash
# VS Code / Cursor
code --install-extension johnny-zhao.pi-vscode

# Open VSX (VSCodium, etc.)
ovsx get johnny-zhao/pi-vscode
```

## Commands

| Command                  | Keybinding    | Description                                                                                   |
| ------------------------ | ------------- | --------------------------------------------------------------------------------------------- |
| `Pi: Open`               | `Alt+Shift+P` | Open or focus the pi terminal beside the editor                                               |
| `Pi: Open in New Window` | —             | Open pi then move it to a new VS Code window                                                  |
| `Pi: Upgrade Pi`         | —             | Detect the pi binary's package manager and upgrade pi globally (does **not** run `pi update`) |

The **Pi: Open** command is also wired to the editor title bar for one-click access.

## Sidebar

The **Pi** activity bar icon opens a sidebar with three webviews:

- **Sessions** — Per-workspace session list; dropdown when multiple workspace folders exist
- **Models** — Three tabs:
  - **Providers** — Add / rename / edit / delete custom providers in `~/.pi/agent/models.json`
  - **OAuth** — Sign in to providers that support OAuth, managed through the bundled `AuthStorage`
  - **API Keys** — Manage stored API keys in `~/.pi/agent/auth.json`
- **Settings** — Environment info, quick links, `Upgrade Pi` button, `Open settings.json`, and two textareas:
  - **Append** → `~/.pi/agent/APPEND_SYSTEM.md` (appended to pi's system prompt)
  - **Override** → `~/.pi/agent/SYSTEM.md` (replaces pi's system prompt entirely)

## Bridge: tools, slash commands, and footer status

Each pi terminal launched by the extension loads a bundled pi extension that opens a local HTTP bridge to VS Code. The bridge powers three things:

1. **Live footer status** — Refreshed every ~1.5s in pi's TUI status area: active file, cursor / selection, language id, dirty marker, and diagnostic counts.
2. **One LLM tool** — The agent can autonomously read VS Code diagnostics. Other actions are intentionally **not** exposed to the model.
3. **Slash commands** — User-triggered commands that pull live editor context and inject it into the conversation as a user message.

> **Design note.** Earlier versions exposed 25 tools to the model. They were cut down to one: tool-spam pollutes context and tempts the model into making file edits behind the editor's back. The remaining live-editor surface is now driven by **explicit slash commands** so the human stays in control of when context flows in.

### LLM tool (1)

| Tool                     | What it returns                                                                  |
| ------------------------ | -------------------------------------------------------------------------------- |
| `vscode_get_diagnostics` | VS Code diagnostics (LSP / lint / type errors) for a file or the whole workspace |

Accepts an optional `filePath` (absolute or workspace-relative). With no argument it returns diagnostics for the whole workspace.

### Slash commands (2)

Type these inside the pi terminal. Each command resolves arguments from the **current VS Code state** when omitted, calls the bridge, and injects the JSON result back into the conversation as a user message (so the model sees it and can react).

| Command                                     | Arguments                           | Behavior                                                                                                                                                  |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vscode-selection [intent?]`               | optional free-text intent           | Returns the current editor selection (text, file path, coordinates). Trailing text is treated as the user's intent and prepended to the injected message. |
| `/vscode-diagnostics [filePath?] [intent?]` | optional file path, optional intent | Returns diagnostics for `filePath`, or for the active editor when omitted. Non-path tokens are treated as intent.                                         |

Example:

```text
/vscode-selection explain this regex
/vscode-diagnostics src/extension.ts why is this failing?
/vscode-diagnostics                 # → diagnostics for the currently active editor
```

### Notes

- Slash command arguments use a simple heuristic: a token containing `/`, `\`, or `.` is treated as a file path; everything else is treated as free-text intent.
- File paths can be absolute or workspace-relative.
- The bridge RPC layer (`src/bridge/handlers.ts`) still implements the full set of editor operations (selection, symbols, definitions, references, hover, code actions, formatting, workspace edits, save, notifications, …). They are reachable from the bundled bridge but **not** registered as LLM tools or slash commands today — reserved for future explicit commands.
- Oversized bridge results are capped; when a response exceeds the limit, the tool returns a valid JSON wrapper with `truncated: true`, original size metadata, and a `resultJsonPrefix` preview.

## Configuration

| Setting          | Type     | Default | Description                                                                           |
| ---------------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `pi-vscode.path` | `string` | `""`    | Absolute path to the pi binary (auto-detected if empty)                               |
| `pi-vscode.env`  | `object` | `{}`    | Environment variables merged into the pi terminal (bridge vars win on key collision)  |
| `pi-vscode.args` | `array`  | `[]`    | Extra CLI args appended after `--extension` and before any caller-supplied extra args |

### Windows / shell notes

Shell selection is **path-driven**, not configurable — the extension picks the right shell from the pi binary's extension so the `exec`/quoting rules always match:

| Pi binary (Windows)              | Shell used                                                       |
| -------------------------------- | ---------------------------------------------------------------- |
| `pi.ps1`                         | `powershell` (`-NoLogo -NoProfile -ExecutionPolicy Bypass`)      |
| `pi.cmd` / `pi.bat` / `pi.exe`   | `%ComSpec%` (`cmd /d /c`)                                        |
| `pi` (extensionless, e.g. nvm4w) | `bash.exe` from Git for Windows (`%ProgramFiles%\Git\bin`, etc.) |
| Unix (any)                       | `$SHELL` or `/bin/bash` (interactive login: `-i -l -c`)          |

For nvm4w / npm POSIX shim setups, point `pi-vscode.path` at the **extensionless** bash shim (e.g. `C:\nvm4w\nodejs\pi`); the resolver keeps the path verbatim and the shell layer auto-selects git-bash. The resolver only auto-probes `.exe` → `.cmd` → `.ps1` variants when the configured path is missing.

## Building from source

```bash
pnpm install
pnpm build         # rolldown bundle → dist/extension.cjs
pnpm package       # builds + vsce package --no-dependencies
pnpm install-local # package + install into local VS Code
```

Useful dev commands:

- `pnpm dev` — rolldown watch mode
- `pnpm fmt` — `oxlint --fix` + `oxfmt`
- `pnpm lint` — `oxlint . && oxfmt --check .`
- `pnpm typecheck` — `tsgo --noEmit --skipLibCheck`
- `pnpm vitest run` — run the test suite

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## License

[MIT](./LICENSE)
