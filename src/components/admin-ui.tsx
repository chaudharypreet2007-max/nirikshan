import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string | undefined;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "critical"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="surface-panel p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-2 font-display text-2xl font-bold tabular-nums", toneClass)}>{value ?? "—"}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status?: string | null }) {
  const s = (status ?? "unknown").toLowerCase();
  const tone =
    s === "active" || s === "verified" || s === "compliant" || s === "approved" || s === "inspected"
      ? "bg-success/10 text-success"
      : s === "suspended" || s === "non_compliant" || s === "rejected" || s === "deactivated"
        ? "bg-destructive/10 text-destructive"
        : s === "needs_review" || s === "pending_verification" || s === "pending"
          ? "bg-warning/10 text-warning"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize", tone)}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="surface-panel overflow-hidden">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="font-display text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyRow({ label = "Nothing to show yet." }: { label?: string }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{label}</p>;
}
