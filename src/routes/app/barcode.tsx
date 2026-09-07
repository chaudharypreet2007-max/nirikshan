import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  Barcode,
  Keyboard,
  Loader2,
  PackageSearch,
  ScanLine,
  History,
  Globe,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  lookupBarcode,
  createProductFromExternal,
  type BarcodeLookupResult,
} from "@/lib/barcode.functions";
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
        content:
          "Scan an EAN, UPC, Code 128 or QR barcode to discover the product from an external product database, then start a Legal Metrology inspection.",
      },
      { property: "og:title", content: "Barcode scanner — Nirikshan AI" },
      {
        property: "og:description",
        content: "External product discovery followed by Nirikshan AI compliance inspection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BarcodePage,
});

type Stage = "idle" | "detected" | "external" | "history" | "done";

function BarcodePage() {
  const navigate = useNavigate();
  const lookup = useServerFn(lookupBarcode);
  const registerProduct = useServerFn(createProductFromExternal);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manual, setManual] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [starting, setStarting] = useState(false);
  const [detected, setDetected] = useState<{ value: string; format: string } | null>(null);
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);

  const busy = stage === "detected" || stage === "external" || stage === "history";

  const run = useCallback(
    async (value: string, format: string, refresh = false) => {
      setDetected({ value, format });
      setResult(null);
      setStage("external");
      try {
        const res = await lookup({ data: { barcode: value, format, refresh } });
        setStage("history");
        setResult(res);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Barcode lookup failed.");
      } finally {
        setStage("done");
      }
    },
    [lookup],
  );

  const onDetected = useCallback(
    (value: string, format: string) => {
      setMode("manual");
      setManual(value);
      void run(value, format);
    },
    [run],
  );

  const goToScan = () => {
    const ext = result?.external.product;
    navigate({
      to: "/app/scan",
      search: {
        barcode: detected?.value,
        productName: ext?.productName ?? result?.nirikshan.productName ?? undefined,
        brand: ext?.brand ?? undefined,
      },
    });
  };

  const startInspection = async () => {
    if (result?.external.product) {
      setStarting(true);
      try {
        await registerProduct({ data: { barcode: result.barcode } });
      } catch {
        // Product profile creation is best-effort — inspection must never be blocked.
      } finally {
        setStarting(false);
      }
    }
    goToScan();
  };

  const ext = result?.external;
  const nir = result?.nirikshan;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Barcode scanner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A barcode discovers the product from an external product database. The physical package remains the only
          evidence of compliance, and a barcode never grants access to another officer&apos;s records.
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
              <Keyboard className="size-4" /> Enter barcode manually
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
                {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageSearch className="size-4" />} Search
                product
              </Button>
            </form>
          )}

          {detected ? (
            <div className="space-y-1 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
              <p className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="size-4" /> Barcode detected
              </p>
              <p className="text-xs uppercase tracking-wide">{detected.format}</p>
              <p className="font-mono text-base">{detected.value}</p>
              {stage === "external" ? <p className="text-xs">Finding product information…</p> : null}
              {stage === "history" ? <p className="text-xs">Checking Nirikshan AI history…</p> : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {busy ? (
            <div className="surface-panel flex items-center gap-2 p-5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {stage === "history" ? "Checking Nirikshan AI history…" : "Searching the external product database…"}
            </div>
          ) : null}

          {ext && !busy ? (
            <>
              {/* ── Product information (external, reference only) ── */}
              <div className="surface-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Product information
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold">
                      {ext.product?.productName ??
                        (ext.product
                          ? "Product name not listed"
                          : ext.status === "error"
                            ? "Product database unavailable"
                            : "Product not found")}
                    </h2>

                  </div>
                  {ext.product ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Externally fetched
                    </span>
                  ) : null}
                </div>

                {ext.status === "found" && ext.product ? (
                  <>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <Field label="Brand" value={ext.product.brand} />
                      <Field label="Manufacturer" value={ext.product.manufacturer} />
                      <Field label="Category" value={ext.product.category} />
                      <Field
                        label="Package quantity"
                        value={[ext.product.packageQuantity, ext.product.unit].filter(Boolean).join(" ") || null}
                      />
                      <Field label="Country" value={ext.product.country} />
                      <Field label="Barcode" value={result?.barcode} mono />
                    </dl>

                    <div className="mt-4 rounded-lg border border-border px-4 py-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <Globe className="size-4 text-muted-foreground" /> Source: {ext.product.source}
                        {ext.product.cached ? " (cached)" : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last updated {new Date(ext.product.fetchedAt).toLocaleString()} · Product identity confidence{" "}
                        {ext.product.confidence}%. Reference information only — it is not verified by Nirikshan AI or
                        any government authority, and it is never proof of compliance.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-8 px-2 text-xs"
                        onClick={() => detected && void run(detected.value, detected.format, true)}
                      >
                        <RefreshCw className="size-3.5" /> Refresh from source
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-4 text-review" />
                      {ext.status === "error"
                        ? "We could not reach the external product database. You can continue with an image-based inspection."
                        : `No product information was found for ${result?.barcode}. You can still inspect the package using AI.`}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button className="h-11" onClick={goToScan}>
                        <ScanLine className="size-4" /> Scan package instead
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => detected && void run(detected.value, detected.format, true)}
                      >
                        <RefreshCw className="size-4" /> Try again
                      </Button>
                    </div>
                    <Button variant="outline" className="h-11 w-full" onClick={goToScan}>
                      Enter product manually
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Nirikshan AI inspection status (separate from discovery) ── */}
              {nir ? (
                <div className="surface-panel p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nirikshan AI inspection
                  </p>
                  {nir.inspected ? (
                    <>
                      <h3 className="mt-1 font-display text-lg font-semibold">Previously inspected</h3>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <Stat label="Total inspections" value={String(nir.totalInspections)} />
                        <Stat label="Latest score" value={nir.latestScore != null ? `${nir.latestScore}%` : "—"} />
                        <Stat
                          label="Last inspected"
                          value={
                            nir.latestInspectionDate
                              ? new Date(nir.latestInspectionDate).toLocaleDateString()
                              : "—"
                          }
                        />
                        <Stat label="Current risk" value={nir.risk.toUpperCase()} />
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Past results are reference only — they never become the current compliance result. Every new
                        inspection analyses the physical package afresh.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="mt-1 font-display text-lg font-semibold">
                        {ext.status === "found" ? "New product discovered" : "Not yet inspected"}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This product has not been inspected by Nirikshan AI before. Previous inspections: 0.
                      </p>
                    </>
                  )}
                  <Button className="mt-4 h-11 w-full" onClick={() => void startInspection()} disabled={starting}>
                    {starting ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                    {nir.inspected ? "Start new inspection" : "Start first inspection"}
                  </Button>
                </div>
              ) : null}
            </>
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

function Field({ label, value, mono }: { label: string; value?: string | null | undefined; mono?: boolean | undefined }) {
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
