import { Skeleton } from "@/components/ui";

/** Shown while a student route is being fetched, before the screen's own skeleton takes over. */
export default function StudentLoading() {
  return (
    <div className="bg-dotgrid min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-4 px-4 pt-8 md:px-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-60 rounded-[28px]" />
      </div>
    </div>
  );
}
