import { cn } from "@/lib/utils";

export type SummaryCardBlockProps = {
  subTitle: string;
  title: string;
  /** Matches focused CardBlock border in the app */
  isFocused?: boolean;
  className?: string;
};

/**
 * Web analogue of jar `CardBlock`: bordered card, muted subtitle, body text.
 */
export function SummaryCardBlock({
  subTitle,
  title,
  isFocused = true,
  className,
}: SummaryCardBlockProps) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card px-5 py-4 text-card-foreground shadow-sm",
        isFocused ? "border-primary" : "border-border",
        className
      )}
    >
      <p className="mb-2 text-sm text-muted-foreground">{subTitle}</p>
      <p className="whitespace-pre-wrap text-base leading-relaxed">{title}</p>
    </div>
  );
}

export function pickSummaryFieldText(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === "string" && val.trim()) return val.trim();
  if (typeof val === "object" && val !== null && "text" in val) {
    const t = (val as { text: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}
