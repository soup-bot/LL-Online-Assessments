"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getCurrentUser } from "@/lib/api";
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

  useEffect(() => {
    setUser(getCurrentUser());
    setReady(true);

    // Keep several tabs in step when someone signs in or out in one of them.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_KEY || e.key === null) setUser(getCurrentUser());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
  return role === "student" ? "/student" : "/dashboard";
}
