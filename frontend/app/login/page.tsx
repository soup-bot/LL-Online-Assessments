"use client";

import { useEffect, useId, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button, Label, Logo, Notice, TextInput } from "@/components/ui";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 md:size-[22px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}


export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  // Sent here because the session ended (see AuthProvider).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired")) {
      setInfo("Your session ended, so we signed you out. Sign in again and pick up where you left off.");
    }
  }, []);

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const signedIn = await login(email, password);
      router.replace(homeFor(signedIn.role));
    } catch (err) {
      setError(toApiError(err).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-6 pb-10 pt-14 md:py-14">
      <div className="flex w-full max-w-[400px] flex-col gap-5 md:gap-[22px]">
        <Logo priority className="mb-3 h-14 self-center md:mb-2.5 md:h-16" />

        <div className="flex flex-col gap-1 text-center md:gap-1.5">
          <h1 className="text-[28px] font-black md:text-[32px]">Welcome back!</h1>
          <p className="text-[15px] font-semibold text-muted md:text-base">Sign in to your account to continue.</p>
        </div>

        <Button
          variant="secondary"
          block
          className="h-[52px] text-[15px] md:h-[54px] md:text-base"
          onClick={() => {
            setError(null);
            setInfo("Google sign-in isn't connected yet. Please use your email and password for now.");
          }}
        >
          <GoogleMark /> Continue with Google
        </Button>

        <div aria-hidden className="flex items-center gap-2.5 text-xs font-extrabold text-subtle md:gap-3 md:text-[13px]">
          <span className="h-px flex-1 bg-dot" />
          or use your email
          <span className="h-px flex-1 bg-dot" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3.5 md:gap-4" noValidate={false}>
          <div className="flex flex-col gap-1.5 md:gap-[7px]">
            <Label htmlFor={emailId}>Email</Label>
            <TextInput
              id={emailId}
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ll.test"
              aria-invalid={error ? true : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor={passwordId}>Password</Label>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfo("Ask your school admin to reset your password. They manage everyone's accounts.");
                }}
                className="text-sm font-bold text-secondary hover:text-secondary-dark"
              >
                Forgot it?
              </button>
            </div>
            <div className="relative">
              <TextInput
                id={passwordId}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                aria-invalid={error ? true : undefined}
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-chip"
              >
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>
          </div>

          {error && <Notice variant="error">{error}</Notice>}
          {info && <Notice variant="info">{info}</Notice>}

          <Button type="submit" loading={busy} block className={cn("h-[54px] text-[17px]", busy && "opacity-80")}>
            {busy ? "Signing in…" : "Sign in"}
            {!busy && <ArrowRight className="size-5" aria-hidden />}
          </Button>
        </form>

      </div>
    </main>
  );
}
