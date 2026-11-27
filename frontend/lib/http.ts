import { ApiError, UNAUTHORIZED_EVENT, type ApiErrorCode } from "@/lib/api-error";
import { API_URL } from "@/lib/env";
import { isSimulatingOffline } from "@/lib/mock/db";
import { forgetSnapshots } from "@/lib/staff-snapshots";

/**
 * Signing in is a cookie. The server sets an httpOnly session cookie that scripts (ours included) cannot read,
 * and the browser sends it with every call. Nothing secret is kept in localStorage.
 */
export function clearAuth(): void {
  forgetSnapshots();
}

/** The server's address without the /api/v1 part, where Laravel hands out the CSRF cookie. */
const ORIGIN = API_URL.replace(/\/api\/v\d+$/, "");

/** Laravel's anti-forgery token, which it puts in a cookie we may read (unlike the session cookie). */
function xsrfToken(): string | null {
  const match = typeof document === "undefined" ? null : document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Ask Laravel to set a fresh CSRF cookie. Needed before signing in, and again if the cookie is missing or stale. */
export async function primeCsrf(): Promise<void> {
  try {
    await fetch(`${ORIGIN}/sanctum/csrf-cookie`, { credentials: "include", headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError("network", OFFLINE_MESSAGE);
  }
}

const KNOWN: ApiErrorCode[] = ["unauthorized", "forbidden", "not_found", "conflict", "expired", "validation", "throttled"];

const BY_STATUS: Record<number, ApiErrorCode> = { 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 410: "expired", 422: "validation", 429: "throttled" };

const OFFLINE_MESSAGE = "We can't reach the server. Check your connection and try again.";

/**
 * One call to the API. Sends the session cookie (and the CSRF header on changes), and turns every failure into an ApiError with the
 * same codes the mock uses: a dropped connection is "network", a refused request carries the
 * server's own `code` and `message`. A 401 tells the app to sign out.
 */
export async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: { silent?: boolean } = {},
): Promise<T> {
  if (isSimulatingOffline()) throw new ApiError("network", OFFLINE_MESSAGE);

  const changes = method !== "GET";
  if (changes && !xsrfToken()) await primeCsrf();

  const send = async (): Promise<Response> => {
    const xsrf = changes ? xsrfToken() : null;
    try {
      return await fetch(`${API_URL}${path}`, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("network", OFFLINE_MESSAGE);
    }
  };

  let response = await send();
  // 419: the CSRF token is stale (the session was renewed). Get a new one and try once more.
  if (response.status === 419 && changes) {
    await primeCsrf();
    response = await send();
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("network", "The server sent something we couldn't read. Please try again.");
    }
  }

  let payload: { code?: string; message?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // not JSON (a crash page, a proxy error)
  }

  if (response.status >= 500) {
    throw new ApiError("network", "Something went wrong on our side. Please try again.");
  }

  const code = KNOWN.includes(payload.code as ApiErrorCode) ? (payload.code as ApiErrorCode) : (BY_STATUS[response.status] ?? "validation");
  if (code === "unauthorized" && !options.silent) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  throw new ApiError(code, payload.message ?? "Something went wrong. Please try again.");
}
