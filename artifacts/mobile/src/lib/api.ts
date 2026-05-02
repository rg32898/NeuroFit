import { clearTokens, loadTokens, saveTokens } from "./tokenStorage";

/**
 * Typed fetch wrapper for the NeuroFit backend.
 *
 * Responsibilities:
 *   - Reads `EXPO_PUBLIC_API_URL` once and prepends it to all paths.
 *   - Attaches `Authorization: Bearer <accessToken>` from secure-store
 *     when present.
 *   - On 401, attempts ONE refresh against `/api/auth/refresh` using the
 *     stored refresh token. Retries the original request once on success.
 *   - On refresh failure, clears tokens and emits a logout event so the
 *     auth store can react.
 *   - Always returns parsed JSON (or `undefined` for 204) and throws a
 *     structured `ApiError` on non-2xx.
 */

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
// Strip any trailing slash so callers pass paths like "/api/foo".
const BASE_URL = RAW_BASE.replace(/\/+$/, "");

export type ApiErrorShape = {
  code: string;
  message: string;
  issues?: unknown;
  requestId?: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;
  readonly requestId?: string | null;

  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.issues = body.issues;
    this.requestId = body.requestId ?? null;
  }
}

export type RequestInitX = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth header attachment (used internally for /auth/refresh). */
  noAuth?: boolean;
};

// ── Logout signalling ────────────────────────────────────────────────────────
//
// The api module can't import the auth-store without creating a cycle, so we
// publish a tiny callback registry. The auth store subscribes on init.
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();

export function onForcedLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}

function emitForcedLogout() {
  for (const fn of logoutListeners) {
    try {
      fn();
    } catch {
      // Listener errors must not break the API flow.
    }
  }
}

// ── Refresh single-flight ────────────────────────────────────────────────────
//
// If many requests hit 401 at the same time (common right after wakeup), we
// want exactly ONE /auth/refresh call. Subsequent callers await the same
// in-flight promise.
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const { refreshToken } = await loadTokens();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await saveTokens({
        accessToken: json.accessToken,
        refreshToken: json.refreshToken,
      });
      return json.accessToken;
    } catch {
      return null;
    } finally {
      // Allow a fresh refresh next time; null reset happens after callers read.
      setTimeout(() => {
        inFlightRefresh = null;
      }, 0);
    }
  })();

  return inFlightRefresh;
}

// ── Core request ─────────────────────────────────────────────────────────────

async function send<T>(
  path: string,
  init: RequestInitX,
  isRetry: boolean,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    accept: "application/json",
    ...(init.headers ?? {}),
  };

  let body: BodyInit | undefined;
  if (init.body !== undefined && init.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData) {
      body = init.body as BodyInit;
    } else {
      headers["content-type"] = headers["content-type"] ?? "application/json";
      body = JSON.stringify(init.body);
    }
  }

  if (!init.noAuth) {
    const { accessToken } = await loadTokens();
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body,
    signal: init.signal,
  });

  if (res.status === 401 && !init.noAuth && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return send<T>(path, init, true);
    }
    await clearTokens();
    emitForcedLogout();
  }

  if (res.status === 204) return undefined as T;

  // Parse body once; we may need it for both success and error paths.
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { code: "PARSE_ERROR", message: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    // Backend errors come back in two shapes:
    //   { error: { code, message, ... } }   (standard middleware)
    //   { code, message, ... }              (some legacy / passthrough paths)
    // Plus there's no guarantee `code` is present at all. Always synthesize
    // safe defaults so callers can branch on `err.code` without nullchecks.
    const fallback: ApiErrorShape = {
      code: `HTTP_${res.status}`,
      message: res.statusText || `Request failed with ${res.status}`,
    };
    const obj = (parsed ?? {}) as Record<string, unknown>;
    const nested = (obj.error ?? null) as Partial<ApiErrorShape> | null;
    const flat = obj as Partial<ApiErrorShape>;
    const merged: ApiErrorShape = {
      code: nested?.code ?? flat.code ?? fallback.code,
      message: nested?.message ?? flat.message ?? fallback.message,
      issues: nested?.issues ?? flat.issues,
      requestId: nested?.requestId ?? flat.requestId ?? null,
    };
    throw new ApiError(res.status, merged);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, init: RequestInitX = {}) =>
    send<T>(path, { ...init, method: "GET" }, false),
  post: <T>(path: string, body?: unknown, init: RequestInitX = {}) =>
    send<T>(path, { ...init, method: "POST", body }, false),
  put: <T>(path: string, body?: unknown, init: RequestInitX = {}) =>
    send<T>(path, { ...init, method: "PUT", body }, false),
  patch: <T>(path: string, body?: unknown, init: RequestInitX = {}) =>
    send<T>(path, { ...init, method: "PATCH", body }, false),
  delete: <T>(path: string, init: RequestInitX = {}) =>
    send<T>(path, { ...init, method: "DELETE" }, false),
};

export const API_BASE_URL = BASE_URL;
