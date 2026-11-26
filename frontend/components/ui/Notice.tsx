import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  info: { box: "bg-secondary-soft text-secondary-dark", Icon: Info },
  success: { box: "bg-mint text-mint-deep", Icon: CircleCheck },
  warn: { box: "bg-amber text-amber-ink", Icon: TriangleAlert },
  error: { box: "bg-rose text-rose-ink", Icon: CircleAlert },
} as const;

/** Inline message. Errors are announced immediately; the rest politely. */
export function Notice({
  variant = "info",
  title,
  children,
  action,
  className,
}: {
  variant?: keyof typeof variants;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = variants[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-bold", box, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-black">{title}</p>}
        {children && <p className={cn("font-semibold", title && "mt-0.5")}>{children}</p>}
      </div>
      {action}
    </div>
  );
}
