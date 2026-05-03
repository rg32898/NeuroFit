/**
 * Client-side fetch wrapper used inside browser components.
 *
 * The browser never holds the access token — it lives in an HttpOnly
 * cookie. Client requests go to the admin app's own /admin/api/* BFF
 * routes, which read the cookie server-side and forward to the real
 * api-server with a Bearer header.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Body = Record<string, unknown> | undefined;

async function call<T>(
  method: string,
  path: string,
  body?: Body,
): Promise<T> {
  const res = await fetch(`/admin/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "UNKNOWN",
      err.message ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: Body) => call<T>("POST", path, body),
  patch: <T>(path: string, body?: Body) => call<T>("PATCH", path, body),
  delete: <T>(path: string) => call<T>("DELETE", path),
};
