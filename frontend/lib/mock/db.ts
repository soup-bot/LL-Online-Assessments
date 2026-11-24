import type { DbState } from "@/lib/types";
import { DB_VERSION, buildSeed } from "@/lib/mock/seed";

/**
 * Browser-side stand-in for the database. Every call reads the latest state from
 * localStorage, applies a change and writes it back, so two tabs stay consistent
 * and a page reload loses nothing. Only call these from the browser.
 */

const DB_KEY = "ll.mock.db";
export const SESSION_KEY = "ll.session";
const OFFLINE_KEY = "ll.dev.offline";

export function readDb(): DbState {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // corrupted or blocked storage: fall through to a fresh seed
  }
  const fresh = buildSeed();
  writeDb(fresh);
  return fresh;
}

export function writeDb(db: DbState): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked: keep working with the in-flight copy only
  }
}

/**
 * Read, change and persist in one step. State is saved even when `fn` throws, because
 * handlers finalise expired attempts before rejecting a request.
 */
export function mutate<T>(fn: (db: DbState) => T): T {
  const db = readDb();
  try {
    return fn(db);
  } finally {
    writeDb(db);
  }
}

export function resetDb(): void {
  writeDb(buildSeed());
}

/** The signed-in user's id, as stored by the mock sign-in. */
export function sessionUserId(): number | null {
  try {
    const id = Number(localStorage.getItem(SESSION_KEY));
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setSessionUserId(id: number | null): void {
  try {
    if (id == null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, String(id));
  } catch {
    // ignore
  }
}

/** Dev switch: make every API call fail like a dropped connection. */
export function isSimulatingOffline(): boolean {
  try {
    return localStorage.getItem(OFFLINE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimulatingOffline(on: boolean): void {
  try {
    if (on) localStorage.setItem(OFFLINE_KEY, "1");
    else localStorage.removeItem(OFFLINE_KEY);
  } catch {
    // ignore
  }
}
