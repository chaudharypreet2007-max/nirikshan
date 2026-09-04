import { ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  tone = "default",
  showTagline = false,
}: {
  className?: string;
  tone?: "default" | "invert";
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          tone === "invert" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "brand-gradient text-primary-foreground",
        )}
      >
        <ScanLine className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            "block font-display text-lg font-semibold",
            tone === "invert" ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          Nirikshan AI
        </span>
        {showTagline ? (
          <span
            className={cn(
              "block text-[11px] font-medium tracking-[0.14em] uppercase",
              tone === "invert" ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            Scan. Detect. Verify. Comply.
          </span>
        ) : null}
      </span>
    </div>
  );
}
