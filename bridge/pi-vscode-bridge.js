import path from "node:path";

export default function (pi) {
  const bridgeUrl = process.env.PI_VSCODE_BRIDGE_URL;
  const bridgeToken = process.env.PI_VSCODE_BRIDGE_TOKEN;

  if (!bridgeUrl || !bridgeToken) return;

  const MAX_RESULT_BYTES = 50 * 1024;
  const MAX_RESULT_LINES = 2000;
  const STATUS_ID = "pi-vscode";
  const STATUS_REFRESH_MS = 1500;
  const MAX_STATUS_PATH_LENGTH = 48;
  let statusTimer;
  let statusRefreshInFlight = false;
  let statusGeneration = 0;
  let lastStatusKey;

  const callBridge = async (method, params = {}) => {
    const response = await fetch(`${bridgeUrl}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pi-vscode-authorization": bridgeToken,
      },
      body: JSON.stringify({ method, params }),
    });

    const payload = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message = payload?.error || `Bridge request failed with status ${response.status}`;
      throw new Error(message);
    }
    return payload?.result;
  };

  const truncateText = (text) => {
    const lines = text.split("\n");
    let output =
      lines.length > MAX_RESULT_LINES ? lines.slice(0, MAX_RESULT_LINES).join("\n") : text;
    if (Buffer.byteLength(output, "utf8") > MAX_RESULT_BYTES) {
      const buffer = Buffer.from(output, "utf8");
      output = buffer.subarray(0, MAX_RESULT_BYTES).toString("utf8");
    }
    return output;
  };

  const boundedJson = (value) => {
    const text = JSON.stringify(value) ?? "null";
    const lineCount = text.split("\n").length;
    const byteCount = Buffer.byteLength(text, "utf8");
    if (lineCount <= MAX_RESULT_LINES && byteCount <= MAX_RESULT_BYTES) return text;
    return JSON.stringify({
      truncated: true,
      message:
        "VS Code bridge result exceeded output limits. Re-run the tool with a narrower file/range/query if you need complete structured data.",
      originalBytes: byteCount,
      originalLines: lineCount,
      resultJsonPrefix: truncateText(text),
    });
  };

  const jsonResult = async (method, params) => ({
    content: [{ type: "text", text: boundedJson(await callBridge(method, params)) }],
    details: {},
  });

  const workspaceRelativePath = (filePath, workspaceFolders = []) => {
    if (!filePath) return "";
    const roots = [
      ...workspaceFolders.map((folder) => folder?.filePath).filter(Boolean),
      process.cwd(),
    ];

    let best = filePath;
    for (const root of roots) {
      const relative = path.relative(root, filePath);
      if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
        if (!relative) return path.basename(filePath);
        if (relative.length < best.length) best = relative;
      }
    }
    return best;
  };

  const shortenPath = (filePath) => {
    if (filePath.length <= MAX_STATUS_PATH_LENGTH) return filePath;
    const parts = filePath.split(/[\\/]+/).filter(Boolean);
    if (parts.length <= 2) return `…${filePath.slice(-(MAX_STATUS_PATH_LENGTH - 1))}`;
    const shortened = `…/${parts.slice(-2).join("/")}`;
    if (shortened.length <= MAX_STATUS_PATH_LENGTH) return shortened;
    return `…${shortened.slice(-(MAX_STATUS_PATH_LENGTH - 1))}`;
  };

  const formatSelectionStatus = (selection) => {
    if (!selection) return "no selection";
    const startLine = selection.start.line + 1;
    const startCharacter = selection.start.character + 1;
    const endLine = selection.end.line + 1;
    const endCharacter = selection.end.character + 1;
    if (selection.isEmpty) return `Ln ${startLine}, Col ${startCharacter}`;

    const selectedCharacters = selection.selectedCharacterCount ?? selection.text?.length;
    if (startLine === endLine) {
      const size = selectedCharacters === undefined ? "" : ` ${selectedCharacters} chars`;
      return `sel${size} @ ${startLine}:${startCharacter}-${endCharacter}`;
    }
    return `sel ${selection.selectedLineCount ?? endLine - startLine + 1} lines @ ${startLine}-${endLine}`;
  };

  const diagnosticsStatus = (counts) => {
    const parts = [];
    if (counts.errors) parts.push(`E${counts.errors}`);
    if (counts.warnings) parts.push(`W${counts.warnings}`);
    if (counts.infos) parts.push(`I${counts.infos}`);
    if (counts.hints) parts.push(`H${counts.hints}`);
    return parts.length > 0 ? parts.join(" ") : "✓";
  };

  const formatStatus = (status, ctx) => {
    const theme = ctx.ui.theme;
    const prefix = theme.fg("accent", "VS Code");
    const activeEditor = status?.activeEditor;
    if (!activeEditor?.filePath) return `${prefix}: ${theme.fg("dim", "no active editor")}`;

    const relativePath = shortenPath(
      workspaceRelativePath(activeEditor.filePath, status.workspaceFolders),
    );
    const dirty = activeEditor.isDirty ? theme.fg("warning", "● ") : "";
    const language = activeEditor.languageId ? ` • ${activeEditor.languageId}` : "";
    const selectionText = formatSelectionStatus(status.selection);
    const diagnosticCounts = status.diagnostics ?? { errors: 0, warnings: 0, infos: 0, hints: 0 };
    const issueText = diagnosticsStatus(diagnosticCounts);
    const coloredIssues =
      diagnosticCounts.errors > 0
        ? theme.fg("error", issueText)
        : diagnosticCounts.warnings > 0
          ? theme.fg("warning", issueText)
          : theme.fg("success", issueText);

    return `${prefix}: ${dirty}${relativePath} • ${selectionText}${language} • ${coloredIssues}`;
  };

  const setStatus = (ctx, statusKey, statusText) => {
    if (!ctx?.hasUI) return;
    if (statusKey === lastStatusKey) return;
    lastStatusKey = statusKey;
    ctx.ui.setStatus(STATUS_ID, statusText);
  };

  const refreshStatus = async (ctx, generation = statusGeneration) => {
    if (!ctx?.hasUI || generation !== statusGeneration || statusRefreshInFlight) return;
    statusRefreshInFlight = true;
    try {
      const status = await callBridge("getStatus");
      if (generation !== statusGeneration) return;
      const statusText = formatStatus(status, ctx);
      setStatus(ctx, statusText, statusText);
    } catch (error) {
      if (generation !== statusGeneration) return;
      const message = error instanceof Error ? error.message : String(error);
      const statusText = `${ctx.ui.theme.fg("accent", "VS Code")}: ${ctx.ui.theme.fg(
        "warning",
        `bridge unavailable (${message})`,
      )}`;
      setStatus(ctx, `error:${message}`, statusText);
    } finally {
      statusRefreshInFlight = false;
    }
  };

  const stopStatusUpdates = (ctx) => {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = undefined;
    }
    statusGeneration++;
    lastStatusKey = undefined;
    if (ctx?.hasUI) ctx.ui.setStatus(STATUS_ID, undefined);
  };

  const startStatusUpdates = (ctx) => {
    if (!ctx?.hasUI) return;
    stopStatusUpdates(ctx);
    const generation = statusGeneration;
    void refreshStatus(ctx, generation);
    statusTimer = setInterval(() => {
      void refreshStatus(ctx, generation);
    }, STATUS_REFRESH_MS);
  };

  const reportTerminalSession = async (ctx) => {
    const terminalId = process.env.PI_VSCODE_TERMINAL_ID;
    if (!terminalId) return;
    const sessionFile = ctx?.sessionManager?.getSessionFile?.();
    if (!sessionFile) return;
    try {
      await callBridge("reportTerminalSession", { terminalId, sessionFile });
    } catch {}
  };

  pi.on("session_start", async (_event, ctx) => {
    startStatusUpdates(ctx);
    await reportTerminalSession(ctx);
  });

  pi.on("input", async (_event, ctx) => {
    void refreshStatus(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    void refreshStatus(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    stopStatusUpdates(ctx);
  });

  // ── LLM tool: only vscode_get_diagnostics ──

  pi.registerTool({
    name: "vscode_get_diagnostics",
    label: "VS Code Diagnostics",
    description:
      "Get VS Code diagnostics (LSP, lint, or type errors) for a file or the full workspace.",
    promptSnippet: "Read current VS Code diagnostics for a file or the workspace.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Optional absolute or workspace-relative file path",
        },
      },
      additionalProperties: false,
    },
    execute: async (_toolCallId, params) => jsonResult("getDiagnostics", params),
  });

  // ── Slash commands ──

  const resolveCurrentContext = async () => {
    try {
      const state = await callBridge("getEditorState");
      return {
        filePath: state?.activeEditor?.filePath,
        position: state?.currentSelection?.start,
      };
    } catch {
      return {};
    }
  };

  const looksLikePath = (s) => s && (s.includes("/") || s.includes("\\") || s.includes("."));

  pi.registerCommand("vscode-selection", {
    description: "获取当前 VS Code 编辑器选区文本和坐标",
    handler: async (args, _ctx) => {
      const result = await callBridge("getCurrentSelection");
      const json = JSON.stringify(result);
      const intent = args?.trim();
      const prefix = intent
        ? `${intent}\n\n/vscode-selection 结果:\n`
        : `/vscode-selection 结果:\n`;
      pi.sendUserMessage(`${prefix}\`\`\`json\n${json}\n\`\`\``);
    },
  });

  pi.registerCommand("vscode-diagnostics", {
    description: "获取 VS Code 诊断信息（可选文件路径参数）",
    handler: async (args, _ctx) => {
      const parts = args?.trim().split(/\s+/) ?? [];
      let filePath;
      let intent;

      if (parts.length > 0 && looksLikePath(parts[0])) {
        filePath = parts[0];
        intent = parts.slice(1).join(" ") || undefined;
      } else {
        const context = await resolveCurrentContext();
        filePath = context.filePath;
        intent = args?.trim() || undefined;
      }

      const result = await callBridge("getDiagnostics", filePath ? { filePath } : {});
      const json = JSON.stringify(result);
      const prefix = intent
        ? `${intent}\n\n/vscode-diagnostics 结果:\n`
        : `/vscode-diagnostics 结果:\n`;
      pi.sendUserMessage(`${prefix}\`\`\`json\n${json}\n\`\`\``);
    },
  });
}
