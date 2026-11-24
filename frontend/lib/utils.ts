import type { SchoolClass, User } from "@/lib/types";

type ClassValue = string | false | null | undefined;

/** Join class names, skipping falsy values. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** 754 seconds -> "12:34". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 754 seconds -> "12 minutes 34 seconds", for screen readers. */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${plural(m, "minute")} ${plural(s % 60, "second")}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** "Ms Aishath" for a teacher with a title, otherwise the full name. */
export function teacherLabel(user: User | undefined): string {
  if (!user) return "Your teacher";
  return user.honorific ? `${user.honorific} ${firstName(user.name)}` : user.name;
}

/** "IGCSE Economics, Batch A" -> "IGCSE Economics". */
export function subjectTitle(cls: SchoolClass): string {
  return cls.name.split(",")[0].trim();
}

/** "IGCSE Economics" -> "Economics". */
export function subjectShort(cls: SchoolClass): string {
  return subjectTitle(cls).replace(/^(IGCSE|IAL|O Level|A Level)\s+/i, "");
}
