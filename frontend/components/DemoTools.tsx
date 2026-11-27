"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Wrench, X } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import { announceDemoChange } from "@/lib/demo-events";
import { API_URL, USE_MOCK } from "@/lib/env";
import { PASSWORD, USERS } from "@/lib/mock/seed";
import type { ExamSession } from "@/lib/types";

/**
 * Developer panel that stands in for screens that don't exist yet (tutor marking and
 * releasing, admin opening exams) and lets you provoke error cases. Hide it with
 * NEXT_PUBLIC_DEMO_TOOLS=0. Nothing here talks to a real server.
 */
export function DemoTools() {
  if (process.env.NEXT_PUBLIC_DEMO_TOOLS === "0") return null;
  return <Panel />;
}

const statusLabel: Record<ExamSession["status"], string> = { not_open: "Not open", open: "Open", closed: "Closed" };

function Panel() {
  const { user, login } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [noViolations, setNoViolations] = useState(false);
  const [sessions, setSessions] = useState<ReturnType<typeof api.dev.openSessions>>([]);
  const [message, setMessage] = useState<string | null>(null);

  const attemptId = Number(/\/student\/attempts\/(\d+)/.exec(pathname)?.[1]) || null;

  const refresh = useCallback(() => {
    setOffline(api.dev.isOffline());
    setNoViolations(api.dev.isViolationsDisabled());
    setSessions(api.dev.openSessions());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  function act(fn: () => string | void) {
    try {
      setMessage(fn() ?? null);
    } catch (e) {
      setMessage(toApiError(e).message);
    }
    refresh();
    announceDemoChange();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Dev tools"
        className="fixed left-0 top-1/2 z-[60] flex -translate-y-1/2 flex-col items-center gap-2.5 rounded-r-2xl bg-secondary px-2.5 py-3.5 text-white shadow-lg ring-1 ring-black/10 transition hover:bg-secondary-dark active:scale-95"
      >
        {open ? <X className="size-[18px]" strokeWidth={2.6} aria-hidden /> : <Wrench className="size-[18px]" strokeWidth={2.4} aria-hidden />}
        <span className="rotate-180 text-xs font-black tracking-wider [writing-mode:vertical-rl]">Dev tools</span>
      </button>

      {open && (
        <div
          role="region"
          aria-label="Dev tools"
          className="fixed left-14 top-1/2 z-[60] flex max-h-[80dvh] w-72 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-white p-4 text-sm shadow-2xl"
        >
          <p className="text-xs font-black uppercase tracking-wide text-muted">Dev tools</p>

          <label className="flex flex-col gap-1 font-extrabold">
            Sign in as
            <select
              value={user?.email ?? ""}
              onChange={async (e) => {
                if (!e.target.value) return;
                const signedIn = await login(e.target.value, PASSWORD);
                router.push(homeFor(signedIn.role));
                announceDemoChange();
              }}
              className="h-10 rounded-xl border-2 border-line-input bg-white px-2 font-semibold"
            >
              <option value="">Not signed in</option>
              {USERS.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </label>

          {USE_MOCK && (
          <div className="flex flex-col gap-1.5">
            <span className="font-extrabold">Unit 3 Test, by class</span>
            {sessions.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-2 font-semibold">
                <span className="min-w-0 truncate">{s.label.replace("IGCSE Economics, ", "")}</span>
                <select
                  value={s.status}
                  onChange={(e) => act(() => api.dev.setSessionStatus(s.id, e.target.value as ExamSession["status"]))}
                  className="h-9 rounded-lg border-2 border-line-input bg-white px-1.5 font-bold"
                >
                  {(Object.keys(statusLabel) as ExamSession["status"][]).map((k) => (
                    <option key={k} value={k}>
                      {statusLabel[k]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          )}

          <label className="flex items-center gap-2 font-extrabold">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => act(() => api.dev.setOffline(e.target.checked))}
              className="size-5 accent-secondary"
            />
            Simulate no connection
          </label>

          <label className="flex items-center gap-2 font-extrabold">
            <input
              type="checkbox"
              checked={noViolations}
              onChange={(e) => act(() => api.dev.setViolationsDisabled(e.target.checked))}
              className="size-5 accent-secondary"
            />
            Ignore leaving the exam window
          </label>

          {USE_MOCK && attemptId && (
            <div className="flex flex-col gap-1.5">
              <span className="font-extrabold">Timer for this exam</span>
              <div className="flex gap-1.5">
                {[
                  { label: "10:00", sec: 600 },
                  { label: "4:50", sec: 290 },
                  { label: "1:00", sec: 60 },
                  { label: "0:05", sec: 5 },
                ].map((t) => (
                  <button
                    key={t.sec}
                    type="button"
                    onClick={() => act(() => api.dev.setTimeLeft(attemptId, t.sec))}
                    className="h-9 flex-1 rounded-lg bg-chip px-1 text-xs font-black hover:bg-line"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => act(() => api.dev.expireSession())}
            className="h-10 rounded-xl border-2 border-line-input px-3 text-left font-extrabold hover:bg-paper"
          >
            Expire my sign-in
          </button>

          {USE_MOCK && (
          <>
          <button
            type="button"
            onClick={() => act(() => `Marked and released: ${api.dev.teacherFinish().title}`)}
            className="h-10 rounded-xl bg-secondary-soft px-3 text-left font-black text-secondary-dark hover:bg-secondary-ring/60"
          >
            Teacher marks my latest exam and releases results
          </button>

          <button
            type="button"
            onClick={() => {
              act(() => {
                api.dev.reset();
                return "Demo data reset.";
              });
              router.push(user ? homeFor(user.role) : "/login");
            }}
            className="h-10 rounded-xl border-2 border-line-input px-3 font-extrabold hover:bg-paper"
          >
            Reset demo data
          </button>
          </>
          )}

          {!USE_MOCK && (
            <p className="rounded-xl bg-paper p-2.5 text-xs font-bold leading-relaxed text-ink-2">
              Connected to the API at {API_URL}. To reset the data, run{" "}
              <code className="font-mono">php artisan migrate:fresh --seed --seeder=DemoSeeder</code> in backend/.
            </p>
          )}

          {message && (
            <p role="status" className="rounded-xl bg-paper p-2.5 text-xs font-bold text-ink-2">
              {message}
            </p>
          )}
        </div>
      )}
    </>
  );
}
