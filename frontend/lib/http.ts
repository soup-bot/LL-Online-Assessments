import { ApiError, UNAUTHORIZED_EVENT, type ApiErrorCode } from "@/lib/api-error";
import { API_URL } from "@/lib/env";
import { isSimulatingOffline } from "@/lib/mock/db";
import type { User } from "@/lib/types";

/** The signed-in user and their token, kept on this device. */
export const TOKEN_KEY = "ll.token";
export const USER_KEY = "ll.user";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // storage blocked: the session lasts until the page is reloaded
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

const KNOWN: ApiErrorCode[] = ["unauthorized", "forbidden", "not_found", "conflict", "expired", "validation", "throttled"];

const BY_STATUS: Record<number, ApiErrorCode> = { 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 410: "expired", 422: "validation", 429: "throttled" };

const OFFLINE_MESSAGE = "We can't reach the server. Check your connection and try again.";

/**
 * One call to the API. Adds the token, and turns every failure into an ApiError with the
 * same codes the mock uses: a dropped connection is "network", a refused request carries the
 * server's own `code` and `message`. A 401 tells the app to sign out.
 */
export async function request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (isSimulatingOffline()) throw new ApiError("network", OFFLINE_MESSAGE);

  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network", OFFLINE_MESSAGE);
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
  if (code === "unauthorized") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  throw new ApiError(code, payload.message ?? "Something went wrong. Please try again.");
}
