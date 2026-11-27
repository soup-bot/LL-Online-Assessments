"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_EVENT, api, restoreUser } from "@/lib/api";
import { USE_MOCK } from "@/lib/env";
import { SESSION_KEY } from "@/lib/mock/db";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** False until the stored session has been read on the client. */
  ready: boolean;
  /** The server ended the session while the app was open (as opposed to the person signing out). */
  expired: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // The session cookie can't be read from here, so ask the server who it belongs to.
    let alive = true;
    void restoreUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setReady(true);
    });

    // Demo data only: keep several tabs in step when someone signs in or out in one of them. (With the real
    // server the cookie is shared by every tab, and a tab that was signed out finds out on its next call.)
    const onStorage = (e: StorageEvent) => {
      if (USE_MOCK && (e.key === SESSION_KEY || e.key === null)) void restoreUser().then(setUser);
    };
    window.addEventListener("storage", onStorage);

    // The server says the session is gone: sign out and go to the login page. Anything the
    // student had typed in an exam is still saved on the device and comes back after signing in.
    const onUnauthorized = () => {
      api.auth.logout();
      setExpired(true);
      setUser(null);
      if (window.location.pathname !== "/login") router.replace("/login?expired=1");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await api.auth.login(email, password);
    setExpired(false);
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, expired, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Where each role lands after signing in. */
export function homeFor(role: User["role"]): string {
  return role === "student" ? "/student" : role === "tutor" ? "/tutor" : "/admin";
}
