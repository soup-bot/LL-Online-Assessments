"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { toApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-staff";
import type { AdminClass, ClassInput, PersonLite, StudentChoice } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useClampPage, useQueryState, useSearchText } from "@/lib/hooks/useQueryState";
import { cn, plural } from "@/lib/utils";
import { Field, PageHeader, Pagination, Select, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, Card, EmptyState, ErrorState, Notice, Skeleton, Spinner } from "@/components/ui";

const batchOf = (name: string) => name.split(",")[1]?.trim() ?? name;

export function AdminClassesScreen() {
  const [p, update] = useQueryState({ q: "", page: 1, size: 10 });
  const [text, setText] = useSearchText(p.q, (q) => update({ q }, "replace"));
  const q = p.q;
  // The class on the right: kept here (not looked up in the list) so it survives paging and searching.
  const [selected, setSelected] = useState<AdminClass | "new" | null>(null);

  const { data, error, loading, reload, refresh } = useAsync(() => adminApi.classes({ q, page: p.page, perPage: p.size }), [q, p.page, p.size]);
  useClampPage(data?.meta.total, p.page, p.size, () => update({ page: 1 }, "replace"));

  // First time in, open the first class.
  useEffect(() => {
    if (selected === null && data && data.classes.length > 0) setSelected(data.classes[0]);
  }, [selected, data]);

  const selectedId = selected && selected !== "new" ? selected.id : null;

  return (
    <StaffMain>
      <PageHeader
        title="Classes"
        actions={
          <Button onClick={() => setSelected("new")}>
            <Plus className="size-5" strokeWidth={3} aria-hidden /> New class
          </Button>
        }
      />
      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <Skeleton className="h-96 rounded-[28px]" />}
      {!error && data && (
        <div className="flex flex-wrap items-start gap-5">
          <nav aria-label="Classes" className={cn("flex max-w-none flex-[1_1_260px] flex-col gap-2.5 transition-opacity lg:max-w-[320px]", loading && "opacity-60")}>
            <div className="relative">
              <label className="sr-only" htmlFor="class-search">Search classes</label>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
              <input
                id="class-search"
                type="search"
                value={text}
                placeholder="Search classes"
                onChange={(e) => setText(e.target.value)}
                className={cn(inputClass, "h-11 rounded-full pl-10 pr-4 text-sm")}
              />
            </div>
            {selected === "new" && <span aria-current="true" className="rounded-3xl border-2 border-secondary bg-white p-[18px] text-base font-black">New class</span>}
            {data.classes.length === 0 && <p className="px-2 text-sm font-bold text-muted">{q ? "No classes match." : "No classes yet."}</p>}
            {data.classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                aria-current={selectedId === c.id ? "true" : undefined}
                className={cn("flex flex-col gap-1 rounded-3xl bg-white p-[18px] text-left transition", selectedId === c.id ? "border-2 border-secondary" : "border border-line hover:border-secondary/30")}
              >
                <span className="text-base font-black">{c.name}</span>
                <span className="text-[13px] font-bold text-muted">
                  {c.subjectCode} · Grade {c.grade} · {plural(c.students.length, "student")}
                </span>
              </button>
            ))}
            <Pagination
              total={data.meta.total}
              page={p.page - 1}
              pageSize={p.size}
              sizes={[10, 25, 50]}
              onPage={(n) => update({ page: n + 1 })}
              onPageSize={(n) => update({ size: n })}
            />
          </nav>

          {selected ? (
            <ClassForm
              key={selected === "new" ? "new" : selected.id}
              tutors={data.tutors}
              cls={selected === "new" ? null : selected}
              onSaved={(saved) => {
                setSelected(saved);
                refresh();
              }}
            />
          ) : (
            <EmptyState title="No class selected" className="flex-[999_1_560px]">
              Pick a class, or create the first one.
            </EmptyState>
          )}
        </div>
      )}
    </StaffMain>
  );
}

function ClassForm({ tutors, cls, onSaved }: { tutors: PersonLite[]; cls: AdminClass | null; onSaved: (saved: AdminClass) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<ClassInput>({
    name: cls?.name ?? "",
    subjectCode: cls?.subjectCode ?? "",
    grade: cls?.grade ?? 10,
    tutorId: cls?.tutorId ?? tutors[0]?.id ?? 0,
    studentIds: cls?.students.map((s) => s.id) ?? [],
  });
  // Names for the roster chips: the class's current students, plus anyone added in this form.
  const [members, setMembers] = useState<PersonLite[]>(cls?.students ?? []);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const code = form.subjectCode.trim();

  function add(s: StudentChoice) {
    setForm((f) => ({ ...f, studentIds: [...f.studentIds, s.id] }));
    setMembers((m) => [...m, { id: s.id, name: s.name, initials: s.initials }]);
  }

  function remove(id: number) {
    setForm((f) => ({ ...f, studentIds: f.studentIds.filter((x) => x !== id) }));
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const saved = await adminApi.saveClass(cls?.id ?? null, form);
      toast(cls ? "Class saved" : "Class created");
      onSaved(saved);
    } catch (e) {
      setProblem(toApiError(e).message);
    }
    setSaving(false);
  }

  return (
    <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 p-6 md:p-[26px]">
      <h2 className="text-[22px] font-black">{cls?.name ?? "New class"}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Name" className="col-span-2">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IGCSE Economics, Batch C" />
        </Field>
        <Field label="Subject code">
          <input className={inputClass} value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })} />
        </Field>
        <Field label="Grade">
          <input className={inputClass} type="number" min={1} max={13} value={Number.isFinite(form.grade) ? form.grade : ""} onChange={(e) => setForm({ ...form, grade: e.target.value === "" ? NaN : Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Teacher" className="max-w-[360px]">
        <Select value={form.tutorId} onChange={(e) => setForm({ ...form, tutorId: Number(e.target.value) })}>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-black">Students · {members.length}</h3>
        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {members.length === 0 && <span className="text-sm font-bold text-muted">No students yet.</span>}
          {members.map((s) => (
            <span key={s.id} className="flex h-11 items-center gap-2.5 rounded-full bg-paper pl-1.5 pr-1.5 text-sm font-extrabold">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-mint text-xs font-black text-mint-deep">{s.initials}</span>
              {s.name}
              <button type="button" aria-label={`Remove ${s.name}`} onClick={() => remove(s.id)} className="grid size-8 place-items-center rounded-full bg-white">
                <X className="size-4" strokeWidth={3} aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <StudentPicker taken={form.studentIds} code={code} classId={cls?.id ?? null} onAdd={add} />
        <p className="text-xs font-bold text-muted">A student can take several subjects, but only one class in each subject.</p>
      </div>

      {problem && <Notice variant="error">{problem}</Notice>}

      <div className="flex justify-end border-t border-line-header pt-4">
        <Button onClick={() => void save()} loading={saving}>{cls ? "Save class" : "Create class"}</Button>
      </div>
    </Card>
  );
}

/** Search the school's students by name and add them. A student already in another class for this subject is greyed out. */
function StudentPicker({ taken, code, classId, onAdd }: { taken: number[]; code: string; classId: number | null; onAdd: (s: StudentChoice) => void }) {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 250);
  const { data, loading } = useAsync(() => (q ? adminApi.students({ q, perPage: 8 }) : Promise.resolve(null)), [q]);
  const results = (data?.students ?? []).filter((s) => !taken.includes(s.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative max-w-[360px]">
        <label className="sr-only" htmlFor="add-student">Search students to add</label>
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
        <input
          id="add-student"
          type="search"
          value={text}
          placeholder="Search students to add"
          onChange={(e) => setText(e.target.value)}
          className={cn(inputClass, "h-11 rounded-full border-dashed pl-10 pr-4 text-sm")}
        />
        {loading && <Spinner className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />}
      </div>
      {q && data && results.length === 0 && <p className="px-1 text-sm font-bold text-muted">No other students match.</p>}
      {results.length > 0 && (
        <ul className="flex max-w-[460px] flex-col gap-1.5">
          {results.map((s) => {
            const clash = code ? s.classes.find((c) => c.id !== classId && c.subjectCode === code) : undefined;
            const others = s.classes.filter((c) => c.id !== classId);
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-canvas px-3 py-2">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-xs font-black text-mint-deep">{s.initials}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-black">{s.name}</span>
                  <span className="truncate text-xs font-bold text-muted">
                    {clash ? `Already in ${batchOf(clash.name)} for this subject` : others.length ? `Also in ${others.map((c) => batchOf(c.name)).join(", ")}` : "Not in a class"}
                  </span>
                </span>
                <Button variant="soft" size="sm" disabled={!!clash} onClick={() => onAdd(s)}>
                  Add
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
