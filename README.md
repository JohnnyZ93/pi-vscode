<div align="center">

<img src="https://github.com/user-attachments/assets/7cb43959-bb66-4dda-a0ab-f6706412ba72" alt="Pi VSCode Logo" width="120" height="120">

# Pi Agent Studio

**A VS Code extension for the [pi coding agent](https://pi.dev/) — native terminal TUI with a visual sidebar to manage sessions, models, and settings** 🔥

English | [简体中文](README.zh-CN.md)

</div>

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/johnny-zhao.pi-agent-studio?label=VS%20Code%20Marketplace&color=blue)](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio)
[![Open VSX](https://img.shields.io/open-vsx/v/johnny-zhao/pi-agent-studio?label=Open%20VSX&color=purple)](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio)
[![License](https://img.shields.io/github/license/JohnnyZ93/pi-agent-studio?color=orange&label=License)](https://github.com/JohnnyZ93/pi-agent-studio/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/JohnnyZ93/pi-agent-studio?style=social)](https://github.com/JohnnyZ93/pi-agent-studio)

## Features

- **Native terminal TUI** — Pi runs in a real VS Code integrated terminal (PTY), not a webview GUI wrapper. No shell layer, no quoting hacks — pi is spawned directly
- **VS Code bridge** — Bundles a pi extension and local HTTP bridge for live editor data
- **Live VS Code footer status** — pi's terminal UI shows the active VS Code file, cursor/selection, language, dirty marker, and diagnostic counts in its bottom status area
- **Diagnostics tool** — The agent can read VS Code diagnostics (LSP / lint / type errors) on demand via `vscode_get_diagnostics`
- **Slash commands** — `/vscode-selection` and `/vscode-diagnostics` inject the current editor selection or diagnostics into the conversation, with the rest of the editor surface intentionally kept off-limits to the model
- **Session restoration** — Per-workspace pi sessions are persisted and relaunched with `--session` after IDE reload
- **Sidebar views** — Visual management panel: `Sessions` (new/restore/switch), `Models` (Providers / OAuth / API Keys), and `Settings` (env info, system prompt override/append) — all webviews backed by direct `~/.pi/agent/*.json` I/O
- **Status bar / title bar buttons** — Pi button on the editor title bar for quick access
- **Auto-detection** — Finds the pi binary automatically from common paths (`~/.bun/bin`, `~/.local/bin`, `~/.npm-global/bin`; on Windows `%APPDATA%/npm`, `%LOCALAPPDATA%/pnpm`)

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

Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=johnny-zhao.pi-agent-studio) and [Open VSX](https://open-vsx.org/extension/johnny-zhao/pi-agent-studio):

```bash
# VS Code / Cursor
code --install-extension johnny-zhao.pi-agent-studio

# Open VSX (VSCodium, etc.)
ovsx get johnny-zhao/pi-agent-studio
```

## Commands

| Command                  | Keybinding    | Description                                                                                    |
| ------------------------ | ------------- | ---------------------------------------------------------------------------------------------- |
| `Pi: Open`               | `Alt+Shift+P` | Open or focus the pi terminal beside the editor                                                |
| `Pi: Open in New Window` | —             | Open pi then move it to a new VS Code window                                                   |
| `Pi: Upgrade Pi`         | —             | Detect the pi binary's package manager and upgrade pi globally (does **not** run `pi update`)  |
| `Pi: Open settings.json` | —             | Open `~/.pi/agent/settings.json` in the editor (creates an empty `{}` if missing)              |
| `Pi: Open models.json`   | —             | Open `~/.pi/agent/models.json` in the editor (creates an empty `{ providers: {} }` if missing) |

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
| `pi-agent-studio.path` | `string` | `""`    | Absolute path to the pi binary (auto-detected if empty)                               |
| `pi-agent-studio.env`  | `object` | `{}`    | Environment variables merged into the pi terminal (bridge vars win on key collision)  |
| `pi-agent-studio.args` | `array`  | `[]`    | Extra CLI args appended after `--extension` and before any caller-supplied extra args |

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
