import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full border-2 border-line-input bg-white font-semibold outline-none transition placeholder:font-medium placeholder:text-subtle focus:border-secondary focus:ring-4 focus:ring-secondary-ring aria-[invalid=true]:border-rose-ink";

/** Pill-shaped text input from the design. */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(field, "h-[52px] rounded-full px-[18px] text-base", className)} {...rest} />;
});

/** Roomier rounded box for written answers. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(field, "min-h-56 resize-y rounded-[22px] px-[18px] py-3.5 text-base leading-relaxed", className)}
      {...rest}
    />
  );
});

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-extrabold", className)}>
      {children}
    </label>
  );
}
