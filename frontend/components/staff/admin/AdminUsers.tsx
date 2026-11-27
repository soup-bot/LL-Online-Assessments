"use client";

import { useId, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { toApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-staff";
import type { UserInput, UserRole, UserRow } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useClampPage, useQueryState, useSearchText } from "@/lib/hooks/useQueryState";
import { cn } from "@/lib/utils";
import { Field, FilterPill, FilterTabs, PageHeader, Pagination, Select, StatusChip, inputClass } from "@/components/staff/bits";
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
  const [p, update] = useQueryState({ role: "all", q: "", page: 1, size: 25 });
  const [text, setText] = useSearchText(p.q, (q) => update({ q }, "replace"));
  const filter = p.role as Filter;
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  // The server searches, filters and pages, so a school with hundreds of students sends one page at a time.
  const { data, error, loading, reload, refresh } = useAsync(
    () => adminApi.users({ role: filter === "all" ? undefined : filter, q: p.q, page: p.page, perPage: p.size }),
    [filter, p.q, p.page, p.size],
  );
  useClampPage(data?.meta.total, p.page, p.size, () => update({ page: 1 }, "replace"));

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
        <div className="relative min-w-0 flex-1 basis-56 sm:w-72 sm:flex-none">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
          <input
            id="user-search"
            type="search"
            placeholder="Search by name or email"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={cn(inputClass, "h-11 rounded-full pl-10 pr-4 text-sm")}
          />
        </div>
        <FilterTabs label="Filter by role">
          {(["all", "tutor", "student", "admin"] as const).map((f) => (
            <FilterPill key={f} active={filter === f} onClick={() => update({ role: f })}>
              {f === "all" ? "Everyone" : `${ROLE[f].label}s`}
            </FilterPill>
          ))}
        </FilterTabs>
      </div>

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <Skeleton className="h-96 rounded-[28px]" />}
      {!error && data && data.meta.total === 0 && <EmptyState title="No one matches">Try a different search or filter.</EmptyState>}
      {!error && data && data.meta.total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <Card className="flex flex-col p-2.5 md:hidden">
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
          <UserTable users={data.users} onEdit={setEditing} />
          <Pagination
            total={data.meta.total}
            page={p.page - 1}
            pageSize={p.size}
            sizes={[10, 25, 50, 100]}
            onPage={(n) => update({ page: n + 1 })}
            onPageSize={(n) => update({ size: n })}
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

/** Desktop view: one row per person. Phones get the cards above instead. */
function UserTable({ users, onEdit }: { users: UserRow[]; onEdit: (u: UserRow) => void }) {
  return (
    <Card className="hidden rounded-[26px] md:block">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-canvas/60">
          <tr>
            <th scope="col" className="pl-5 pr-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >User</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Role</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Classes</th>
            <th scope="col" className="w-px px-5 py-3"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line transition-colors first:border-t-0 hover:bg-canvas/70">
              <td className="py-3 pl-5 pr-4">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-black", ROLE[u.role].avatar, !u.isActive && "opacity-50")}>
                    {u.initials}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className={cn("text-[15px] font-black", !u.isActive && "text-muted")}>{u.name}</span>
                    <span className="truncate text-[13px] font-bold text-muted">{u.email}</span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip tone={ROLE[u.role].tone}>{ROLE[u.role].label}</StatusChip>
                  {!u.isActive && <StatusChip tone="neutral">Inactive</StatusChip>}
                </div>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-ink-2">{u.classes || <span className="text-subtle">—</span>}</td>
              <td className="py-3 pl-4 pr-5">
                <button
                  type="button"
                  onClick={() => onEdit(u)}
                  aria-label={`Edit ${u.name}`}
                  title="Edit"
                  className="grid size-9 place-items-center rounded-full text-secondary-dark transition hover:bg-secondary-soft"
                >
                  <Pencil className="size-[18px]" strokeWidth={2.3} aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
