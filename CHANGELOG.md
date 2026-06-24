# Changelog

All notable changes to **Pi Agent Studio** are documented in this file.

## [1.0.3] - 2026-06-24

- Added `pi-agent-studio.commitModel` setting to pick the model used for AI commit message generation (`provider/model` format).
- `Pi: Upgrade Pi` now falls back to the inferred package manager (`npm` / `pnpm` / `bun` / `yarn`) when `PI_OFFLINE` or `PI_SKIP_VERSION_CHECK` is set, instead of always running `pi update`.
- Truncated long session names in the Sessions sidebar delete confirmation (full name available in tooltip).

## [1.0.2] - 2026-06-23

- Replaced package manager inference with `pi update` for binary upgrades.
- Added AI-powered Git commit message generation with 14 language support.
- Added "Pi: Open Here" context menu command for explorer folders.
- Fixed sidebar UI to use CSS variables for consistent error styling.

## [1.0.1] - 2026-06-22

- Added session search with fuzzy matching, quoted phrases, and `re:` regex.
- Improved Windows pi shim execution and version detection error handling.
- Fixed Sessions sidebar opening a session while renaming.

## [1.0.0] - 2026-06-18

First stable release under the new `johnny-zhao.pi-agent-studio` publisher. Major rework of the extension surface area, sidebar, and Windows shell handling.
