import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "dark" | "soft" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-black no-underline transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark hover:text-white",
  secondary: "border-2 border-line-input bg-white font-extrabold text-ink hover:bg-paper hover:text-ink",
  dark: "bg-ink text-white hover:bg-black hover:text-white",
  soft: "bg-brand-tint text-brand-dark hover:bg-brand-ring/60 hover:text-brand-dark",
  ghost: "font-extrabold text-ink-2 hover:bg-chip hover:text-ink",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-6 text-[15px]",
  lg: "h-[52px] px-7 text-base md:h-[54px] md:text-[17px]",
};

export function buttonClass({
  variant = "primary",
  size = "lg",
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string {
  return cn(base, variants[variant], sizes[size], block && "w-full");
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & CommonProps & { loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass({ variant, size, block }), className)}
      {...rest}
    >
      {loading && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** A Next.js link that looks like a button. */
export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...rest
}: ComponentProps<typeof Link> & AnchorHTMLAttributes<HTMLAnchorElement> & CommonProps) {
  return <Link className={cn(buttonClass({ variant, size, block }), className)} {...rest} />;
}
