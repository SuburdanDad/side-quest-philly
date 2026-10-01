import Link from "next/link";
import { Star } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type Tone = "mat" | "bow" | "gold" | "go" | "late" | "muted";

const CHIP: Record<Tone, string> = {
  mat: "bg-mat/15 text-mat",
  bow: "bg-bow/15 text-bow",
  gold: "bg-gold/15 text-gold",
  go: "bg-go/15 text-go",
  late: "bg-late/15 text-late",
  muted: "bg-surface-2 text-muted",
};

export function Chip({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-3xl border border-line bg-surface p-5 ${className}`} {...props} />;
}

const BUTTON = {
  bow: "bg-bow text-ink",
  mat: "bg-mat text-ink",
  ghost: "border border-line bg-surface-2 text-text",
} as const;

const buttonClass = (variant: keyof typeof BUTTON, className: string) =>
  `inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${BUTTON[variant]} ${className}`;

export function Button({
  variant = "bow",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "bow",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof BUTTON }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? "fill-gold text-gold" : "text-line"}
        />
      ))}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-3 text-xs font-bold tracking-[0.18em] text-muted uppercase">{children}</h2>;
}
