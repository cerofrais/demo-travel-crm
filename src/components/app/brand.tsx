import { cn } from "@/lib/utils";

/** wishtrip wordmark: pin-on-map mark + "wish" (ink/white) and "trip" (teal). */
export function BrandMark({ className, light = true }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect x="4" y="8" width="32" height="26" rx="6" fill={light ? "rgba(255,255,255,0.12)" : "#e9f3f0"} />
      <path d="M8 30 L16 24 L24 28 L32 20" stroke={light ? "#57b8a3" : "#147a6b"} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 6c-3.3 0-6 2.6-6 5.9 0 4.4 6 10.1 6 10.1s6-5.7 6-10.1C32 8.6 29.3 6 26 6z" fill="#e8663d" />
      <circle cx="26" cy="12" r="2.3" fill="#fff" />
    </svg>
  );
}

export function BrandWordmark({ className, light = true, size = "md" }: { className?: string; light?: boolean; size?: "md" | "lg" }) {
  return (
    <span className={cn("font-display font-semibold tracking-tight", size === "lg" ? "text-3xl" : "text-lg", className)}>
      <span className={light ? "text-white" : "text-ink-900"}>wish</span>
      <span className="text-brand-300">trip</span>
    </span>
  );
}
