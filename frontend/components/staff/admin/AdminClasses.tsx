"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toApiError } from "@/lib/api";
import { adminApi } from "@/lib/api-staff";
import type { AdminClass, AdminClassesData, ClassInput } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, plural } from "@/lib/utils";
import { Field, PageHeader, Select, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, Card, EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui";

const NEW = 0;

export function AdminClassesScreen() {
  const { data, error, loading, reload, refresh } = useAsync(() => adminApi.classes(), []);
  const [selected, setSelected] = useState<number | null>(null);
  const current = data ? (selected === NEW ? NEW : (data.classes.find((c) => c.id === selected)?.id ?? data.classes[0]?.id ?? NEW)) : null;

  return (
    <>
      <StaffMain>
        <PageHeader
          title="Classes"
          actions={
            <Button onClick={() => setSelected(NEW)}>
              <Plus className="size-5" strokeWidth={3} aria-hidden /> New class
            </Button>
          }
        />
        {loading && <Skeleton className="h-96 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
        {data && data.classes.length === 0 && current !== NEW && <EmptyState title="No classes yet">Create the first one.</EmptyState>}
        {data && (data.classes.length > 0 || current === NEW) && (
          <div className="flex flex-wrap items-start gap-5">
            <nav aria-label="Classes" className="flex max-w-none flex-[1_1_260px] flex-col gap-2.5 lg:max-w-[320px]">
              {current === NEW && (
                <span aria-current="true" className="rounded-3xl border-2 border-secondary bg-white p-[18px] text-base font-black">New class</span>
              )}
              {data.classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  aria-current={current === c.id ? "true" : undefined}
                  className={cn("flex flex-col gap-1 rounded-3xl bg-white p-[18px] text-left transition", current === c.id ? "border-2 border-secondary" : "border border-line hover:border-secondary/30")}
                >
                  <span className="text-base font-black">{c.name}</span>
                  <span className="text-[13px] font-bold text-muted">
                    {c.subjectCode} · Grade {c.grade} · {plural(c.students.length, "student")}
                  </span>
                </button>
              ))}
            </nav>
            <ClassForm
              key={current ?? "none"}
              data={data}
              cls={data.classes.find((c) => c.id === current) ?? null}
              onSaved={(id) => {
                setSelected(id);
                refresh();
              }}
            />
          </div>
        )}
      </StaffMain>
    </>
  );
}

function ClassForm({ data, cls, onSaved }: { data: AdminClassesData; cls: AdminClass | null; onSaved: (id: number) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<ClassInput>({
    name: cls?.name ?? "",
    subjectCode: cls?.subjectCode ?? "",
    grade: cls?.grade ?? 10,
    tutorId: cls?.tutorId ?? data.tutors[0]?.id ?? 0,
    studentIds: cls?.students.map((s) => s.id) ?? [],
  });
  const [toAdd, setToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const members = form.studentIds.map((id) => data.students.find((s) => s.id === id)).filter((s) => !!s);
  const addable = data.students.filter((s) => !form.studentIds.includes(s.id));

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const { classId } = await adminApi.saveClass(cls?.id ?? null, form);
      toast(cls ? "Class saved" : "Class created");
      onSaved(classId);
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
          {data.tutors.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-black">Students · {members.length}</h3>
        <div className="flex flex-wrap gap-2">
          {members.length === 0 && <span className="text-sm font-bold text-muted">No students yet.</span>}
          {members.map((s) => (
            <span key={s.id} className="flex h-11 items-center gap-2.5 rounded-full bg-paper pl-1.5 pr-1.5 text-sm font-extrabold">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-mint text-xs font-black text-mint-deep">{s.initials}</span>
              {s.name}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => setForm({ ...form, studentIds: form.studentIds.filter((id) => id !== s.id) })}
                className="grid size-8 place-items-center rounded-full bg-white"
              >
                <X className="size-4" strokeWidth={3} aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <label className="sr-only" htmlFor="add-student">Add a student</label>
          <Select id="add-student" className="max-w-[320px] flex-1 rounded-full border-dashed" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
            <option value="">Add a student…</option>
            {addable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.className ? ` (now in ${s.className.split(",")[1]?.trim() ?? s.className})` : ""}
              </option>
            ))}
          </Select>
          <Button
            variant="soft"
            size="md"
            disabled={!toAdd}
            onClick={() => {
              setForm({ ...form, studentIds: [...form.studentIds, Number(toAdd)] });
              setToAdd("");
            }}
          >
            Add
          </Button>
        </div>
        <p className="text-xs font-bold text-muted">A student sits in one class at a time, so adding someone moves them here.</p>
      </div>

      {problem && <Notice variant="error">{problem}</Notice>}

      <div className="flex justify-end border-t border-line-header pt-4">
        <Button onClick={() => void save()} loading={saving}>{cls ? "Save class" : "Create class"}</Button>
      </div>
    </Card>
  );
}
