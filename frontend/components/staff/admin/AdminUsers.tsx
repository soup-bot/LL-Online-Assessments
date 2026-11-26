"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { toApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-staff";
import type { UserInput, UserRole, UserRow } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn } from "@/lib/utils";
import { Field, FilterPill, PageHeader, Select, StatusChip, inputClass } from "@/components/staff/bits";
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
  const { data, error, loading, reload, refresh } = useAsync(() => adminApi.users(), []);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  const q = query.trim().toLowerCase();
  const shown = (data?.users ?? []).filter(
    (u) => (filter === "all" || u.role === filter) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
  );

  return (
    <>
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
          <input
            id="user-search"
            type="search"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(inputClass, "h-12 max-w-[380px] flex-1 basis-64 rounded-full px-5")}
          />
          {(["all", "tutor", "student", "admin"] as const).map((f) => (
            <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "Everyone" : `${ROLE[f].label}s`}
            </FilterPill>
          ))}
        </div>

        {loading && <Skeleton className="h-96 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
        {data && shown.length === 0 && <EmptyState title="No one matches">Try a different search or filter.</EmptyState>}
        {data && shown.length > 0 && (
          <Card className="flex flex-col p-2.5">
            {shown.map((u) => (
              <div key={u.id} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] px-3.5 py-2.5 hover:bg-canvas">
                <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-black", ROLE[u.role].avatar)}>
                  {u.initials}
                </span>
                <div className="flex min-w-0 flex-1 basis-48 flex-col">
                  <span className="text-base font-black">{u.name}</span>
                  <span className="truncate text-[13px] font-bold text-muted">{u.email}</span>
                </div>
                <span className="w-[84px] text-center">
                  <StatusChip tone={ROLE[u.role].tone}>{ROLE[u.role].label}</StatusChip>
                </span>
                <span className="basis-[220px] text-sm font-bold text-ink-2 sm:flex-[0_1_220px]">{u.classes}</span>
                <Button variant="secondary" size="sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                  Edit
                </Button>
              </div>
            ))}
          </Card>
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
    </>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const toast = useToast();
  const [form, setForm] = useState<UserInput>({ name: user?.name ?? "", email: user?.email ?? "", role: user?.role ?? "student" });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      await adminApi.saveUser(user?.id ?? null, form);
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
        {!user && <p className="text-xs font-bold text-muted">In this prototype every new account signs in with the password &quot;password&quot;.</p>}
        {problem && <Notice variant="error">{problem}</Notice>}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" size="md" loading={saving}>{user ? "Save changes" : "Add user"}</Button>
        </div>
      </form>
    </Modal>
  );
}
