import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComplianceStatus = "compliant" | "needs_review" | "non_compliant" | "processing";

const STATUS_META: Record<
  ComplianceStatus,
  { label: string; icon: typeof CheckCircle2; chip: string; text: string; ring: string }
> = {
  compliant: {
    label: "Compliant",
    icon: CheckCircle2,
    chip: "bg-compliant-soft text-compliant",
    text: "text-compliant",
    ring: "stroke-compliant",
  },
  needs_review: {
    label: "Needs review",
    icon: AlertTriangle,
    chip: "bg-review-soft text-review",
    text: "text-review",
    ring: "stroke-review",
  },
  non_compliant: {
    label: "Non-compliant",
    icon: XCircle,
    chip: "bg-violation-soft text-violation",
    text: "text-violation",
    ring: "stroke-violation",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    chip: "bg-info-soft text-info",
    text: "text-info",
    ring: "stroke-info",
  },
};

export function StatusChip({ status, className }: { status: ComplianceStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.processing;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.chip,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-violation-soft text-violation",
    high: "bg-violation-soft text-violation",
    medium: "bg-review-soft text-review",
    low: "bg-info-soft text-info",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", map[severity] ?? map["low"])}>
      {severity}
    </span>
  );
}

export function ScoreDial({
  score,
  status,
  size = 132,
}: {
  score: number;
  status: ComplianceStatus;
  size?: number;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.processing;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 128 128" className="size-full -rotate-90" role="img" aria-label={`Compliance score ${score} of 100`}>
          <circle cx="64" cy="64" r={radius} className="fill-none stroke-muted" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            className={cn("fill-none transition-[stroke-dashoffset] duration-700", meta.ring)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display text-3xl font-bold", meta.text)}>{score}</span>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">score</span>
        </div>
      </div>
      <StatusChip status={status} />
    </div>
  );
}

export const DECLARATION_LABELS: Record<string, string> = {
  manufacturer_details: "Manufacturer / packer / importer",
  commodity_name: "Common or generic name",
  net_quantity: "Net quantity",
  manufacture_date: "Month & year of manufacture",
  mrp: "Maximum retail price (MRP)",
  consumer_care: "Consumer care details",
  country_of_origin: "Country of origin",
  best_before: "Best before / use by",
  legibility: "Font size & legibility",
  misleading: "Misleading practice check",
};
