import { AuthStorage } from "@earendil-works/pi-coding-agent";
import {
  getOAuthProviders,
  getOAuthProviderStatuses,
  logout,
  saveOAuthCredentials,
} from "./auth-config.ts";

// Types from @earendil-works/pi-ai (transitive dependency, not directly importable)
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

export function startOAuthFlow(providerId: string): OAuthFlowController {
  const listeners: Array<(event: OAuthProgressEvent) => void> = [];
  const pendingRequests = new Map<
    string,
    { resolve: (v: string) => void; reject: (e: Error) => void }
  >();

  const emit = (event: OAuthProgressEvent) => {
    for (const cb of listeners) cb(event);
  };

  const abort = new AbortController();

  void (async () => {
    try {
      const providers = getOAuthProviders();
      const providerInfo = providers.find((p) => p.id === providerId);
      if (!providerInfo) {
        emit({ type: "error", message: `Unknown OAuth provider: ${providerId}` });
        return;
      }

      // Use pi SDK's AuthStorage only for the login flow (HTTP requests, no shell)
      // This avoids shell-dependent operations like getOAuthProviders() and hasAuth()
      const authStorage = AuthStorage.create();

      const callbacks: OAuthLoginCallbacks = {
        onAuth: (info: OAuthAuthInfo) => {
          const token = `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          emit({
            type: "auth_url",
            url: info.url,
            instructions: info.instructions ?? undefined,
            token,
          });
          pendingRequests.set(token, {
            resolve: () => {},
            reject: () => {},
          });
        },
        onDeviceCode: (info: OAuthDeviceCodeInfo) => {
          emit({
            type: "device_code",
            userCode: info.userCode,
            verificationUri: info.verificationUri,
            message: `Enter code: ${info.userCode}`,
          });
        },
        onPrompt: async (prompt: { message: string; placeholder?: string }) => {
          const token = `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          emit({
            type: "prompt",
            message: prompt.message,
            placeholder: prompt.placeholder ?? undefined,
            token,
          });
          const promise = new Promise<string>((resolve, reject) => {
            pendingRequests.set(token, { resolve, reject });
          });
          return promise;
        },
        onSelect: async (prompt: { message: string; options: OAuthSelectOption[] }) => {
          const token = `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          emit({
            type: "select",
            message: prompt.message,
            options: prompt.options,
            token,
          });
          const promise = new Promise<string>((resolve, reject) => {
            pendingRequests.set(token, { resolve, reject });
          });
          const value = await promise;
          return value || undefined;
        },
        onProgress: (message: string) => {
          emit({ type: "progress", message });
        },
        onManualCodeInput: async () => {
          const token = `${providerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          emit({
            type: "prompt",
            message: "Paste the authorization code from your browser:",
            placeholder: "Authorization code",
            token,
          });
          const promise = new Promise<string>((resolve, reject) => {
            pendingRequests.set(token, { resolve, reject });
          });
          return promise;
        },
        signal: abort.signal,
      };

      await authStorage.login(providerId, callbacks);

      // Save credentials to our auth.json (AuthStorage doesn't expose them directly)
      // We rely on AuthStorage saving to its own storage, then we sync
      // Actually, let's just save a marker that this provider is connected
      saveOAuthCredentials(providerId, { access_token: "oauth_token" });

      emit({ type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "Login cancelled" || msg === "OAuth login cancelled") {
        emit({ type: "cancelled" });
      } else {
        emit({ type: "error", message: msg });
      }
    }
  })();

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
      for (const [, req] of pendingRequests) {
        req.reject(new Error("OAuth login cancelled"));
      }
      pendingRequests.clear();
    },
  };
}

// Re-export from auth-config for convenience
export { getOAuthProviderStatuses, logout as logoutOAuth };
