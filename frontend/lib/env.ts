/**
 * Where the data comes from. By default the screens talk to the Laravel API; set
 * NEXT_PUBLIC_USE_MOCK=1 to run entirely on the in-browser demo data instead (no server needed).
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

/** Base address of the API, with the version prefix and no trailing slash. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");
