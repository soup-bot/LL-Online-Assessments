"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_EVENT, api, getCurrentUser } from "@/lib/api";
import { USER_KEY } from "@/lib/http";
import { SESSION_KEY } from "@/lib/mock/db";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  /** False until the stored session has been read on the client. */
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setUser(getCurrentUser());
    setReady(true);

    // Keep several tabs in step when someone signs in or out in one of them.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY || e.key === USER_KEY || e.key === null) setUser(getCurrentUser());
    };
    window.addEventListener("storage", onStorage);

    // The server says the session is gone: sign out and go to the login page. Anything the
    // student had typed in an exam is still saved on the device and comes back after signing in.
    const onUnauthorized = () => {
      api.auth.logout();
      setUser(null);
      if (window.location.pathname !== "/login") router.replace("/login?expired=1");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const signedIn = await api.auth.login(email, password);
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
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
