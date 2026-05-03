import { cookies } from "next/headers";

/**
 * Server-side fetch wrapper used by Next.js route handlers and server
 * components. Reads the HttpOnly `admin_at` cookie set by the BFF login
 * route and forwards it as a Bearer token to the api-server. This keeps
 * the access token OUT of the browser entirely (XSS safe).
 */
export const apiBase = (): string =>
  process.env.ADMIN_API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:80";

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

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** When true, do NOT throw on non-2xx — return raw envelope. */
  raw?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const at = cookies().get("admin_at")?.value;
  const headers = new Headers(opts.headers);
  headers.set("content-type", "application/json");
  if (at) headers.set("authorization", `Bearer ${at}`);

  const res = await fetch(`${apiBase()}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok && !opts.raw) {
    const err = data?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "UNKNOWN",
      err.message ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}
