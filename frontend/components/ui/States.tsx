import type { ReactNode } from "react";
import { CloudOff, Inbox, LoaderCircle, SearchX, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ApiErrorCode } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-chip", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("size-5 animate-spin", className)} />;
}

/** Rotated icon tile, the design's signature accent. */
function IconTile({ Icon, tone }: { Icon: LucideIcon; tone: string }) {
  return (
    <span className={cn("grid size-14 -rotate-6 place-items-center rounded-[20px]", tone)}>
      <Icon className="size-7" aria-hidden />
    </span>
  );
}

const errorKinds: Record<ApiErrorCode | "default", { Icon: LucideIcon; title: string }> = {
  network: { Icon: CloudOff, title: "Can't reach the server" },
  unauthorized: { Icon: ShieldAlert, title: "Please sign in again" },
  forbidden: { Icon: ShieldAlert, title: "This page isn't for you" },
  not_found: { Icon: SearchX, title: "We couldn't find that" },
  conflict: { Icon: TriangleAlert, title: "That's already done" },
  expired: { Icon: TriangleAlert, title: "Time's up" },
  validation: { Icon: TriangleAlert, title: "Something isn't right" },
  default: { Icon: TriangleAlert, title: "Something went wrong" },
};

/** Full-section error with a way forward. Used for failed loads and route errors. */
export function ErrorState({
  code = "default",
  title,
  message,
  onRetry,
  backHref,
  backLabel = "Back to my exams",
  className,
}: {
  code?: ApiErrorCode | "default";
  title?: string;
  message: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const kind = errorKinds[code];
  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] border border-line bg-white p-8 text-center",
        className,
      )}
    >
      <IconTile Icon={kind.Icon} tone="bg-peach-mid text-peach-ink" />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-black">{title ?? kind.title}</h1>
        <p className="text-[15px] font-semibold leading-relaxed text-ink-2">{message}</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {onRetry && (
          <Button onClick={onRetry} size="md">
            Try again
          </Button>
        )}
        {backHref && (
          <ButtonLink href={backHref} variant="secondary" size="md">
            {backLabel}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

/** Friendly "nothing here yet" panel. */
export function EmptyState({
  title,
  children,
  Icon = Inbox,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  Icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-[#e0d9ce] bg-white p-8 text-center",
        className,
      )}
    >
      <IconTile Icon={Icon} tone="bg-brand-tint text-brand" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-black">{title}</h2>
        {children && <p className="text-sm font-semibold text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
