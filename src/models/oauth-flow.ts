import { AuthStorage } from "@earendil-works/pi-coding-agent";
import { getOAuthProviders, getOAuthProviderStatuses, logout } from "./auth-config.ts";

// Types from @earendil-works/pi-ai (transitive dependency, not directly importable).
interface OAuthAuthInfo {
  url: string;
  instructions?: string;
}
interface OAuthDeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  intervalSeconds?: number;
  expiresInSeconds?: number;
}
interface OAuthSelectOption {
  id: string;
  label: string;
}
interface OAuthLoginCallbacks {
  onAuth: (info: OAuthAuthInfo) => void;
  onDeviceCode: (info: OAuthDeviceCodeInfo) => void;
  onPrompt: (prompt: { message: string; placeholder?: string }) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  onSelect: (prompt: {
    message: string;
    options: OAuthSelectOption[];
  }) => Promise<string | undefined>;
  signal?: AbortSignal;
}

export interface OAuthProgressEvent {
  type:
    | "auth_url"
    | "device_code"
    | "prompt"
    | "select"
    | "progress"
    | "success"
    | "error"
    | "cancelled";
  url?: string;
  instructions?: string;
  userCode?: string;
  verificationUri?: string;
  message?: string;
  placeholder?: string;
  options?: { id: string; label: string }[];
  token?: string;
}

export interface OAuthFlowController {
  onProgress: (callback: (event: OAuthProgressEvent) => void) => void;
  respond: (token: string, value: string) => void;
  cancel: () => void;
}

interface PendingRequest {
  resolve: (v: string) => void;
  reject: (e: Error) => void;
}

function createToken(providerId: string): string {
  return `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Run an OAuth login for the given provider.
 *
 * Mirrors pi-web's `app/api/auth/login/[provider]/route.ts` SSE handler, but
 * in-process: instead of an HTTP request/response registry we use an
 * in-memory token → promise map that the webview drives via `respond()`.
 *
 * Key invariant (matches pi-web): `onAuth`, `onPrompt` and `onManualCodeInput`
 * share ONE memoized "manual input" request so the auth URL shown in the
 * webview and the promise the SDK awaits are the same object. Browser-based
 * providers (e.g. OpenAI Codex) race the local callback server against
 * `onManualCodeInput()`; if those used separate tokens the response would
 * never reach the awaited promise and login would hang forever.
 *
 * `AuthStorage.login()` runs the full flow and persists the REAL OAuth
 * credentials to auth.json itself — we must NOT overwrite them afterwards.
 */
export function startOAuthFlow(providerId: string): OAuthFlowController {
  const listeners: Array<(event: OAuthProgressEvent) => void> = [];
  const pendingRequests = new Map<string, PendingRequest>();

  const emit = (event: OAuthProgressEvent) => {
    for (const cb of listeners) cb(event);
  };

  const abort = new AbortController();

  // A one-shot client input request (token + promise) the webview resolves
  // via `respond(token, value)`.
  const createClientInputRequest = (): { token: string; promise: Promise<string> } => {
    const token = createToken(providerId);
    const promise = new Promise<string>((resolve, reject) => {
      pendingRequests.set(token, { resolve, reject });
    });
    return { token, promise };
  };

  // The shared "manual input" request — memoized so onAuth / onPrompt /
  // onManualCodeInput all resolve the same promise. Cleared once it settles.
  let pendingManual: { token: string; promise: Promise<string> } | undefined;
  const getManualInputRequest = (): { token: string; promise: Promise<string> } => {
    if (!pendingManual) {
      pendingManual = createClientInputRequest();
      pendingManual.promise
        .finally(() => {
          pendingManual = undefined;
        })
        .catch(() => {
          // Swallow rejection from cleanup() so it doesn't surface as an
          // unhandled promise rejection. The SDK already saw the result
          // (or threw its own error) by the time we cancel.
        });
    }
    return pendingManual;
  };

  const cleanup = () => {
    for (const [, req] of pendingRequests) {
      req.reject(new Error("Login cancelled"));
    }
    pendingRequests.clear();
    pendingManual = undefined;
  };

  // Defer the login run to a microtask so callers can attach their
  // onProgress listener synchronously AFTER startOAuthFlow() returns.
  // The first provider callback (onSelect / onPrompt / onAuth) fires
  // synchronously inside authStorage.login() — if we ran the IIFE inline,
  // that first emit() would race ahead of the listener registration and the
  // webview would never see the initial select/prompt/auth_url event
  // (looked like "clicking Login does nothing").
  queueMicrotask(() => {
    void (async () => {
      try {
        const providers = getOAuthProviders();
        const providerInfo = providers.find((p) => p.id === providerId);
        if (!providerInfo) {
          emit({ type: "error", message: `Unknown OAuth provider: ${providerId}` });
          return;
        }

        const authStorage = AuthStorage.create();

        const callbacks: OAuthLoginCallbacks = {
          onAuth: (info: OAuthAuthInfo) => {
            // Fire-and-forget event: surface the URL to the webview with the
            // shared manual-input token so the "paste code" box resolves the
            // same promise onManualCodeInput returns to the SDK.
            const request = getManualInputRequest();
            emit({
              type: "auth_url",
              url: info.url,
              instructions: info.instructions ?? undefined,
              token: request.token,
            });
          },
          onDeviceCode: (info: OAuthDeviceCodeInfo) => {
            emit({
              type: "device_code",
              userCode: info.userCode,
              verificationUri: info.verificationUri,
            });
          },
          onPrompt: async (prompt: { message: string; placeholder?: string }) => {
            const request = getManualInputRequest();
            emit({
              type: "prompt",
              message: prompt.message,
              placeholder: prompt.placeholder ?? undefined,
              token: request.token,
            });
            return request.promise;
          },
          onSelect: async (prompt: { message: string; options: OAuthSelectOption[] }) => {
            // Selects are independent one-shot requests, not memoized.
            const request = createClientInputRequest();
            emit({
              type: "select",
              message: prompt.message,
              options: prompt.options,
              token: request.token,
            });
            const value = await request.promise;
            return value || undefined;
          },
          onProgress: (message: string) => {
            emit({ type: "progress", message });
          },
          onManualCodeInput: () => getManualInputRequest().promise,
          signal: abort.signal,
        };

        await authStorage.login(providerId, callbacks);

        emit({ type: "success" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Login cancelled" || msg === "OAuth login cancelled") {
          emit({ type: "cancelled" });
        } else {
          emit({ type: "error", message: msg });
        }
      } finally {
        cleanup();
      }
    })();
  });

  return {
    onProgress(callback) {
      listeners.push(callback);
    },
    respond(token, value) {
      const req = pendingRequests.get(token);
      if (req) {
        pendingRequests.delete(token);
        req.resolve(value);
      }
    },
    cancel() {
      abort.abort();
      cleanup();
    },
  };
}

// Re-export from auth-config for convenience
export { getOAuthProviderStatuses, logout as logoutOAuth };
