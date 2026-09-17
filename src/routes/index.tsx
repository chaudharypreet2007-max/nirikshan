import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Building2, ScanLine, Gavel, FileCheck2, MapPin, Languages, Brain } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nirikshan AI — Legal Metrology compliance scanning" },
      {
        name: "description",
        content:
          "Scan packaged commodity labels and verify mandatory declarations under the Legal Metrology (Packaged Commodities) Rules, 2011.",
      },
      { property: "og:title", content: "Nirikshan AI — Scan. Detect. Verify. Comply." },
      {
        property: "og:description",
        content:
          "AI compliance verification for packaged commodities: declaration extraction, rule checks, evidence and audit-ready reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  { icon: ScanLine, title: "Label scanning", body: "Capture or upload a package photo and get a structured read of every declaration." },
  { icon: Languages, title: "Multilingual OCR", body: "Declarations in English and Indian languages are extracted and normalised." },
  { icon: Gavel, title: "Rule engine", body: "Configurable Legal Metrology rules — no logic frozen inside the interface." },
  { icon: Brain, title: "Explainable results", body: "Every violation carries evidence, confidence and a corrective recommendation." },
  { icon: MapPin, title: "Field audit trail", body: "Location, timestamp and inspector identity recorded with each inspection." },
  { icon: FileCheck2, title: "Compliance scoring", body: "A 0-100 score with a transparent breakdown of where points were lost." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="safe-px mx-auto flex max-w-6xl items-center justify-between py-5">
        <Wordmark showTagline />
      </header>

      <main>
        <section className="safe-px mx-auto max-w-6xl pt-6 pb-14 sm:pt-12">
          <p className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
            Legal Metrology (Packaged Commodities) Rules, 2011
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-bold text-balance sm:text-5xl lg:text-6xl">
            Packaged commodity compliance, verified in one scan.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Nirikshan AI reads mandatory declarations on a package, checks them against configurable rules, and returns an
            explainable compliance verdict with evidence — for enforcement officers in the field and for compliance teams
            before dispatch.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <PortalCard
              to="/auth/government"
              icon={ShieldCheck}
              eyebrow="Enforcement"
              title="Government portal"
              body="Legal Metrology officers and inspectors. Field scanning, violation management, jurisdiction analytics."
              cta="Enter enforcement portal"
              variant="gov"
            />
            <PortalCard
              to="/auth/company"
              icon={Building2}
              eyebrow="Business compliance"
              title="Organisation portal"
              body="Manufacturers, packers, importers, retailers and e-commerce teams. Pre-dispatch checks and corrective actions."
              cta="Enter business portal"
              variant="enterprise"
            />
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Platform administrator?{" "}
            <Link to="/admin/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              Main Administration Portal
            </Link>
          </p>
        </section>

        <section className="border-y border-border bg-card">
          <div className="safe-px mx-auto grid max-w-6xl gap-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <c.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="safe-px safe-pb mx-auto max-w-6xl py-8 text-sm text-muted-foreground">
        Nirikshan AI is a decision-support system. Low-confidence results are flagged for human review and do not replace
        an officer's determination.
      </footer>
    </div>
  );
}

function PortalCard({
  to,
  icon: Icon,
  eyebrow,
  title,
  body,
  cta,
  variant,
}: {
  to: string;
  icon: typeof ShieldCheck;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  variant: "gov" | "enterprise";
}) {
  return (
    <div className="surface-panel flex flex-col p-6 transition-shadow hover:shadow-lift">
      <span
        className={
          variant === "gov"
            ? "flex size-11 items-center justify-center rounded-xl bg-gov text-gov-foreground"
            : "flex size-11 items-center justify-center rounded-xl bg-enterprise text-enterprise-foreground"
        }
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p>
      <h2 className="mt-1 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-6 w-full sm:w-auto">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
