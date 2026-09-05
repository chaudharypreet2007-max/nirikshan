import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Barcode, Keyboard, Loader2, PackageSearch, ScanLine, ShieldCheck, History } from "lucide-react";
import { lookupBarcode, type BarcodeLookupResult } from "@/lib/barcode.functions";
import { StatusChip, type ComplianceStatus } from "@/components/compliance";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/barcode")({
  head: () => ({
    meta: [
      { title: "Barcode scanner — Nirikshan AI" },
      {
        name: "description",
        content: "Scan an EAN, UPC, Code 128 or QR barcode to pull up the product passport and start a compliance inspection.",
      },
      { property: "og:title", content: "Barcode scanner — Nirikshan AI" },
      { property: "og:description", content: "Barcode-driven product lookup and Legal Metrology inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BarcodePage,
});

function BarcodePage() {
  const navigate = useNavigate();
  const lookup = useServerFn(lookupBarcode);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<{ value: string; format: string } | null>(null);
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);

  const run = useCallback(
    async (value: string, format: string) => {
      setDetected({ value, format });
      setBusy(true);
      setResult(null);
      try {
        const res = await lookup({ data: { barcode: value, format } });
        setResult(res);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Barcode lookup failed.");
      } finally {
        setBusy(false);
      }
    },
    [lookup],
  );

  const onDetected = useCallback(
    (value: string, format: string) => {
      setMode("manual");
      void run(value, format);
    },
    [run],
  );

  const startInspection = () => {
    navigate({
      to: "/app/scan",
      search: {
        barcode: detected?.value,
        productName: result?.product?.productName ?? undefined,
        brand: result?.product?.brand ?? undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Barcode scanner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          EAN-13, EAN-8, UPC-A, UPC-E, Code 128 and QR. A barcode identifies the product — it never grants access to
          another officer&apos;s records.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-panel space-y-4 p-5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "camera" ? "default" : "outline"}
              className="h-10 flex-1"
              onClick={() => setMode("camera")}
            >
              <Barcode className="size-4" /> Camera
            </Button>
            <Button
              type="button"
              variant={mode === "manual" ? "default" : "outline"}
              className="h-10 flex-1"
              onClick={() => setMode("manual")}
            >
              <Keyboard className="size-4" /> Enter code
            </Button>
          </div>

          {mode === "camera" ? (
            <BarcodeScanner onDetected={onDetected} />
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim().length < 4) {
                  toast.error("Enter a valid barcode number.");
                  return;
                }
                void run(manual.trim(), "manual");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="code">Barcode number</Label>
                <Input
                  id="code"
                  className="h-11 font-mono"
                  inputMode="numeric"
                  placeholder="8901234567890"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageSearch className="size-4" />} Search product
              </Button>
            </form>
          )}

          {detected ? (
            <div className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
              <p className="font-semibold">Barcode detected</p>
              <p className="text-xs uppercase tracking-wide">{detected.format}</p>
              <p className="font-mono text-base">{detected.value}</p>
              {busy ? <p className="mt-1 text-xs">Searching product…</p> : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {busy ? (
            <div className="surface-panel flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching the product repository…
            </div>
          ) : null}

          {result && !busy ? (
            result.found ? (
              <>
                <div className="surface-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-compliant">Product found</p>
                  <h2 className="mt-1 font-display text-xl font-bold">
                    {result.product?.productName ?? "Unnamed product"}
                  </h2>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Field label="Brand" value={result.product?.brand} />
                    <Field label="Manufacturer" value={result.product?.manufacturer} />
                    <Field label="Package type" value={result.product?.packageType} />
                    <Field label="Net quantity" value={result.product?.netQuantity} />
                    <Field label="Variant" value={result.product?.variantName} />
                    <Field label="Barcode" value={result.barcode} mono />
                  </dl>

                  <div className="mt-4 rounded-lg border border-border px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Product information source
                    </p>
                    <p className="mt-1 flex items-center gap-2 font-medium">
                      {result.source === "internal" ? <ShieldCheck className="size-4 text-compliant" /> : null}
                      {result.sourceLabel}
                    </p>
                    {result.source === "external" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reference data only — not officially verified. The physical package remains the primary
                        evidence.
                        {result.sourceUpdatedAt
                          ? ` Last updated ${new Date(result.sourceUpdatedAt).toLocaleDateString()}.`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="surface-panel p-5">
                  <h3 className="font-display text-base font-semibold">Digital compliance passport</h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label="Total inspections" value={String(result.passport.totalInspections)} />
                    <Stat label="Latest score" value={result.passport.latestScore != null ? `${result.passport.latestScore}%` : "—"} />
                    <Stat
                      label="Last inspection"
                      value={
                        result.passport.latestInspectionDate
                          ? new Date(result.passport.latestInspectionDate).toLocaleDateString()
                          : "—"
                      }
                    />
                    <Stat label="Current risk" value={result.passport.risk.toUpperCase()} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Historic scores are reference only — a fresh physical inspection always runs a new analysis.
                  </p>
                  <Button className="mt-4 h-11 w-full" onClick={startInspection}>
                    <ScanLine className="size-4" /> Start new inspection
                  </Button>
                </div>
              </>
            ) : (
              <div className="surface-panel p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-review">Product not found</p>
                <p className="mt-1 font-mono text-lg">{result.barcode}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We could not find this product in the Nirikshan AI repository. You can still inspect the package —
                  barcodes are never required.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button className="h-11" onClick={startInspection}>
                    <ScanLine className="size-4" /> Scan package
                  </Button>
                  <Button variant="outline" className="h-11" onClick={startInspection}>
                    Add product manually
                  </Button>
                </div>
              </div>
            )
          ) : null}

          {result?.myHistory.length ? (
            <div className="surface-panel overflow-hidden">
              <h3 className="flex items-center gap-2 border-b border-border px-5 py-4 font-display text-base font-semibold">
                <History className="size-4" /> My inspections for this barcode
              </h3>
              <ul className="divide-y divide-border">
                {result.myHistory.map((h) => (
                  <li key={h.id}>
                    <Link
                      to="/app/inspections/$inspectionId"
                      params={{ inspectionId: h.id }}
                      className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-muted"
                    >
                      <span className="flex-1 truncate">
                        {h.productName ?? "Unidentified product"} ·{" "}
                        <span className="text-muted-foreground">{new Date(h.inspectionDate).toLocaleDateString()}</span>
                      </span>
                      <span className="font-semibold">{h.score ?? "—"}</span>
                      <StatusChip status={h.status as ComplianceStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="px-5 py-3 text-xs text-muted-foreground">
                Other officers&apos; inspection records for this barcode are never shown.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : "font-medium"}>{value ?? "Not recorded"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold">{value}</p>
    </div>
  );
}
