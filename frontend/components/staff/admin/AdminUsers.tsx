"use client";

import { useId, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-staff";
import type { UserInput, UserRole, UserRow } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { cn } from "@/lib/utils";
import { Field, FilterPill, PageHeader, Pagination, Select, StatusChip, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, Card, EmptyState, ErrorState, Modal, Notice, Skeleton } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

const ROLE: Record<UserRole, { label: string; tone: ChipTone; avatar: string }> = {
  tutor: { label: "Teacher", tone: "brand", avatar: "bg-peach-mid text-peach-ink" },
  student: { label: "Student", tone: "mint", avatar: "bg-mint text-mint-deep" },
  admin: { label: "Admin", tone: "sky", avatar: "bg-sky text-sky-deep" },
};

type Filter = "all" | UserRole;

export function AdminUsersScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  // The server searches, filters and pages, so a school with hundreds of students sends one page at a time.
  const { data, error, loading, reload, refresh } = useAsync(
    () => adminApi.users({ role: filter === "all" ? undefined : filter, q, page: page + 1, perPage: pageSize }),
    [filter, q, page, pageSize],
  );

  return (
    <StaffMain>
      <PageHeader
        title="Users"
        subtitle={data ? `${data.counts.tutors} teachers · ${data.counts.students} students · ${data.counts.admins} admin${data.counts.admins === 1 ? "" : "s"}` : " "}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-5" strokeWidth={3} aria-hidden /> Add user
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="user-search">Search users</label>
        <div className="relative min-w-0 max-w-[380px] flex-1 basis-64">
          <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
          <input
            id="user-search"
            type="search"
            placeholder="Search by name or email"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPage(0);
            }}
            className={cn(inputClass, "h-12 rounded-full pl-11 pr-5")}
          />
        </div>
        {(["all", "tutor", "student", "admin"] as const).map((f) => (
          <FilterPill
            key={f}
            active={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
          >
            {f === "all" ? "Everyone" : `${ROLE[f].label}s`}
          </FilterPill>
        ))}
      </div>

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <Skeleton className="h-96 rounded-[28px]" />}
      {!error && data && data.meta.total === 0 && <EmptyState title="No one matches">Try a different search or filter.</EmptyState>}
      {!error && data && data.meta.total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <Card className="flex flex-col p-2.5">
            {data.users.map((u) => (
              <div key={u.id} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] px-3.5 py-2.5 hover:bg-canvas">
                <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-black", ROLE[u.role].avatar, !u.isActive && "opacity-50")}>
                  {u.initials}
                </span>
                <div className="flex min-w-0 flex-1 basis-48 flex-col">
                  <span className={cn("text-base font-black", !u.isActive && "text-muted")}>{u.name}</span>
                  <span className="truncate text-[13px] font-bold text-muted">{u.email}</span>
                </div>
                <span className="flex w-[84px] flex-col items-center gap-1">
                  <StatusChip tone={ROLE[u.role].tone}>{ROLE[u.role].label}</StatusChip>
                  {!u.isActive && <StatusChip tone="neutral">Inactive</StatusChip>}
                </span>
                <span className="basis-[220px] text-sm font-bold text-ink-2 sm:flex-[0_1_220px]">{u.classes}</span>
                <Button variant="secondary" size="sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                  Edit
                </Button>
              </div>
            ))}
          </Card>
          <Pagination
            total={data.meta.total}
            page={page}
            pageSize={pageSize}
            sizes={[10, 25, 50, 100]}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
        </div>
      )}

      {editing && (
        <UserDialog
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </StaffMain>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const toast = useToast();
  const [form, setForm] = useState<UserInput>({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "student", isActive: user?.isActive ?? true });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      await adminApi.saveUser(user?.id ?? null, { ...form, ...(password ? { password } : {}) });
      toast(user ? "User updated" : "User added");
      onSaved();
    } catch (err) {
      setProblem(toApiError(err).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy={id}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-6 md:p-7">
        <h2 id={id} className="text-[22px] font-black">{user ? "Edit user" : "Add a user"}</h2>
        <Field label="Full name">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus autoComplete="off" />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            <option value="student">Student</option>
            <option value="tutor">Teacher</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label={user ? "New password" : "Password"} hint={user ? "Leave empty to keep their current password." : "Leave empty to give them the default password."}>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" />
        </Field>
        {user && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-paper px-3.5 py-3 text-sm font-extrabold">
            <input type="checkbox" className="size-[18px] accent-secondary" checked={form.isActive !== false} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Account is active
            <span className="ml-auto text-xs font-bold text-muted">Untick to sign them out and block sign-in</span>
          </label>
        )}
        {problem && <Notice variant="error">{problem}</Notice>}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" size="md" loading={saving}>{user ? "Save changes" : "Add user"}</Button>
        </div>
      </form>
    </Modal>
  );
}
