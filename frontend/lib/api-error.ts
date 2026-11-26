/** The one error shape every screen handles, whether the data comes from the mock or the real API. */

export type ApiErrorCode =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "expired"
  | "validation"
  | "throttled";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Anything thrown becomes an ApiError so screens only handle one shape. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError("network", "Something went wrong on our side. Please try again.");
}

/** Fired whenever the API reports the session has ended. */
export const UNAUTHORIZED_EVENT = "ll-unauthorized";
