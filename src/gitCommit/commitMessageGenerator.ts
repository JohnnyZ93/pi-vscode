import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import * as path from "path";
import * as vscode from "vscode";
import { getGitDiff } from "./gitUtils.ts";

/**
 * Git commit message generator module
 */

let commitGenerationAbortController: AbortController | undefined;

const DEFAULT_PROMPT = {
  system:
    "You are a helpful assistant that generates informative git commit messages based on git diffs output. Skip preamble and remove all backticks surrounding the commit message. Based on the provided git diff, generate a conventional format commit message.\n\n```\n<type>[optional scope]: <description>\n\n[optional body list]\n```",
  user: "Notes from developer (ignore if not relevant): {{USER_CURRENT_INPUT}}",
};

const TRUNCATED_DIFF_SIZE = 200000;
const MIN_PER_FILE_BUDGET = 2000;
const FILE_TRUNCATED_MARK = "\n[... file diff truncated ...]";

export async function generateCommitMsg(scm?: vscode.SourceControl) {
  try {
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
    if (!gitExtension) {
      throw new Error("Git extension not found");
    }

    const git = gitExtension.getAPI(1);
    if (git.repositories.length === 0) {
      throw new Error("No Git repositories available");
    }

    // If scm is provided, then the user specified one repository by clicking the "Source Control" menu button
    if (scm) {
      const repository = git.getRepository(scm.rootUri);

      if (!repository) {
        throw new Error("Repository not found for provided SCM");
      }

      await generateCommitMsgForRepository(repository);
      return;
    }

    await orchestrateWorkspaceCommitMsgGeneration(git.repositories);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`[Commit Generation Failed] ${errorMessage}`);
  }
}

async function orchestrateWorkspaceCommitMsgGeneration(repos: any[]) {
  const reposWithChanges = await filterForReposWithChanges(repos);

  if (reposWithChanges.length === 0) {
    vscode.window.showInformationMessage(`No changes found in any workspace repositories.`);
    return;
  }

  if (reposWithChanges.length === 1) {
    // Only one repo with changes, generate for it
    const repo = reposWithChanges[0];
    await generateCommitMsgForRepository(repo);
    return;
  }

  const selection = await promptRepoSelection(reposWithChanges);

  if (!selection) {
    // User cancelled
    return;
  }

  if (selection.repo === null) {
    // Generate for all repositories with changes
    for (const repo of reposWithChanges) {
      try {
        await generateCommitMsgForRepository(repo);
      } catch (error) {
        console.error(`Failed to generate commit message for ${repo.rootUri.fsPath}:`, error);
      }
    }
  } else {
    // Generate for selected repository
    await generateCommitMsgForRepository(selection.repo);
  }
}

async function filterForReposWithChanges(repos: any[]) {
  const reposWithChanges = [];

  // Check which repositories have changes
  for (const repo of repos) {
    try {
      const gitDiff = await getGitDiff(repo.rootUri.fsPath);
      if (gitDiff) {
        reposWithChanges.push(repo);
      }
    } catch {
      // Skip repositories with errors (no changes, etc.)
    }
  }
  return reposWithChanges;
}

async function promptRepoSelection(repos: any[]) {
  // Multiple repos with changes - ask user to choose
  const repoItems = repos.map((repo) => ({
    label: repo.rootUri.fsPath.split(path.sep).pop() || repo.rootUri.fsPath,
    description: repo.rootUri.fsPath,
    repo: repo,
  }));

  repoItems.unshift({
    label: "$(git-commit) Generate for all repositories with changes",
    description: `Generate commit messages for ${repos.length} repositories`,
    repo: null as any,
  });

  return await vscode.window.showQuickPick(repoItems, {
    placeHolder: "Select repository for commit message generation",
  });
}

async function generateCommitMsgForRepository(repository: any) {
  const inputBox = repository.inputBox;
  const repoPath = repository.rootUri.fsPath;
  const gitDiff = await getGitDiff(repoPath);

  if (!gitDiff) {
    throw new Error(
      `No changes in repository ${repoPath.split(path.sep).pop() || "repository"} for commit message`,
    );
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.SourceControl,
      title: `Generating commit message for ${repoPath.split(path.sep).pop() || "repository"}...`,
      cancellable: true,
    },
    (_progress, token) => {
      token.onCancellationRequested(() => abortCommitGeneration());
      return performCommitMsgGeneration(gitDiff, inputBox);
    },
  );
}

async function performCommitMsgGeneration(gitDiff: string, inputBox: any) {
  let unsubscribe: (() => void) | undefined;
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  let abortListener: (() => void) | undefined;

  try {
    vscode.commands.executeCommand("setContext", "pi-agent-studio.isGeneratingCommit", true);
    const config = vscode.workspace.getConfiguration();

    // Get custom prompts or use defaults
    const customSystemPrompt = config.get<string>("pi-agent-studio.commitMessagePrompt", "");
    const PROMPT = {
      system: customSystemPrompt || DEFAULT_PROMPT.system,
      user: DEFAULT_PROMPT.user,
    };

    const prompts: string[] = [];

    const currentInput = inputBox.value?.trim() || "";
    if (currentInput) {
      prompts.push(PROMPT.user.replace("{{USER_CURRENT_INPUT}}", currentInput));
    }

    const truncatedDiff = truncateDiffByFile(gitDiff, TRUNCATED_DIFF_SIZE);
    prompts.push(truncatedDiff);
    const userPrompt = prompts.join("\n\n");

    // Get commit language configuration
    const commitLanguage = config.get<string>("pi-agent-studio.commitLanguage", "English");

    // Create a system prompt with language instruction
    const systemPrompt = PROMPT.system + `\n\nGenerate commit message in ${commitLanguage}.`;

    commitGenerationAbortController = new AbortController();

    // ResourceLoader: skip every project/global resource and force our system prompt.
    const cwd = process.cwd();
    const agentDir = getAgentDir();
    const loader = new DefaultResourceLoader({
      cwd,
      agentDir,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      systemPromptOverride: () => systemPrompt,
      appendSystemPromptOverride: () => [],
    });
    await loader.reload();

    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);

    const created = await createAgentSession({
      cwd,
      agentDir,
      noTools: "all",
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      authStorage,
      modelRegistry,
    });
    session = created.session;

    // Bridge our AbortController to session.abort()
    abortListener = () => {
      session?.abort().catch(() => {
        /* ignore */
      });
    };
    commitGenerationAbortController.signal.addEventListener("abort", abortListener, { once: true });

    let response = "";
    unsubscribe = session.subscribe((event) => {
      if (event.type !== "message_update") return;
      const inner = event.assistantMessageEvent as { type: string; delta?: string };
      if (inner?.type === "text_delta" && typeof inner.delta === "string") {
        response += inner.delta;
        inputBox.value = extractCommitMessage(response);
      }
    });

    await session.prompt(userPrompt);

    if (commitGenerationAbortController.signal.aborted) {
      throw new Error("Commit message generation was cancelled");
    }

    inputBox.value = removeThinkTags(extractCommitMessage(response));

    if (!inputBox.value) {
      throw new Error("empty API response");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to generate commit message: ${errorMessage}`);
  } finally {
    if (abortListener) {
      commitGenerationAbortController?.signal.removeEventListener("abort", abortListener);
    }
    unsubscribe?.();
    session?.dispose();
    vscode.commands.executeCommand("setContext", "pi-agent-studio.isGeneratingCommit", false);
  }
}

export function abortCommitGeneration() {
  commitGenerationAbortController?.abort();
  vscode.commands.executeCommand("setContext", "pi-agent-studio.isGeneratingCommit", false);
}

/**
 * Extracts the commit message from the AI response
 * @param str String containing the AI response
 * @returns The extracted commit message
 */
function extractCommitMessage(str: string): string {
  // Remove any markdown formatting or extra text
  return str
    .trim()
    .replace(/^```[^\n]*\n?|```$/g, "")
    .trim();
}

function removeThinkTags(text: string): string {
  const regex = /<think>.*?<\/think>/gs;
  return text.replace(regex, "").trim();
}

/**
 * Split diff by `diff --git` headers and truncate each file's chunk so that the
 * total size stays within `maxSize`. Earlier strategy hard-cut the head of the
 * diff, frequently losing every file after the first large one.
 */
export function truncateDiffByFile(diff: string, maxSize: number): string {
  if (diff.length <= maxSize) return diff;

  // Preserve any preamble (e.g. wrapper line like "'git ...' Output:") that
  // appears before the first `diff --git` header.
  const firstHeader = diff.indexOf("diff --git ");
  const preamble = firstHeader > 0 ? diff.slice(0, firstHeader) : "";
  const body = firstHeader >= 0 ? diff.slice(firstHeader) : diff;

  // Split into file chunks, keeping the `diff --git` header at the start of each.
  const chunks: string[] = [];
  const headerRegex = /^diff --git .*$/gm;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(body)) !== null) indices.push(m.index);
  if (indices.length === 0) {
    // Fall back to plain head-cut on unrecognised input.
    return preamble + body.slice(0, maxSize - preamble.length) + FILE_TRUNCATED_MARK;
  }
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i]!;
    const end = i + 1 < indices.length ? indices[i + 1]! : body.length;
    chunks.push(body.slice(start, end));
  }

  const budget = Math.max(0, maxSize - preamble.length);
  const fileCount = chunks.length;
  // Fair share, with a floor so each file gets at least a usable slice.
  const perFile = Math.max(MIN_PER_FILE_BUDGET, Math.floor(budget / fileCount));

  // Pass 1: short files take only what they need; record leftover.
  const truncated: string[] = [];
  let remaining = budget;
  const oversized: number[] = [];
  for (let i = 0; i < fileCount; i++) {
    const c = chunks[i]!;
    if (c.length <= perFile) {
      truncated[i] = c;
      remaining -= c.length;
    } else {
      truncated[i] = ""; // placeholder, filled in pass 2
      oversized.push(i);
    }
  }

  // Pass 2: split remaining budget across oversized files.
  if (oversized.length > 0) {
    const share = Math.max(MIN_PER_FILE_BUDGET, Math.floor(remaining / oversized.length));
    for (const i of oversized) {
      truncated[i] = truncateFileChunk(chunks[i]!, share);
    }
  }

  return preamble + truncated.join("");
}

function truncateFileChunk(chunk: string, limit: number): string {
  if (chunk.length <= limit) return chunk;
  // Keep the header line(s) up to the first hunk so the model still sees the path.
  const firstHunk = chunk.indexOf("\n@@");
  const headerEnd = firstHunk >= 0 ? firstHunk + 1 : 0;
  const header = chunk.slice(0, headerEnd);
  const rest = chunk.slice(headerEnd);
  const bodyBudget = Math.max(0, limit - header.length - FILE_TRUNCATED_MARK.length);
  return header + rest.slice(0, bodyBudget) + FILE_TRUNCATED_MARK;
}
