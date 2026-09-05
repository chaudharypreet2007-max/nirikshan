import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Upload, MapPin, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLabel } from "@/lib/compliance.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScanSearch = {
  barcode?: string;
  productName?: string;
  brand?: string;
};

export const Route = createFileRoute("/app/scan")({
  validateSearch: (search: Record<string, unknown>): ScanSearch => ({
    barcode: typeof search["barcode"] === "string" ? search["barcode"] : undefined,
    productName: typeof search["productName"] === "string" ? search["productName"] : undefined,
    brand: typeof search["brand"] === "string" ? search["brand"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scan a package — Nirikshan AI" },
      {
        name: "description",
        content: "Capture or upload a packaged commodity label and run an automated Legal Metrology compliance check.",
      },
      { property: "og:title", content: "Scan a package — Nirikshan AI" },
      { property: "og:description", content: "AI declaration extraction and rule verification from a single label photo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Scan,
});

const CATEGORIES = ["Food & beverages", "Cosmetics", "Household", "Electronics", "Apparel", "Pharmaceutical", "Other"];
const PACKAGE_TYPES = ["Retail pack", "Wholesale pack", "Multi-piece pack", "Combination pack", "E-commerce listing"];
const MAX_IMAGES = 6;


function Scan() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { isGovernment } = useAuth();
  const analyze = useServerFn(analyzeLabel);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [productName, setProductName] = useState(search.productName ?? "");
  const [brand, setBrand] = useState(search.brand ?? "");
  const [barcode, setBarcode] = useState(search.barcode ?? "");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [packageType, setPackageType] = useState(PACKAGE_TYPES[0]!);
  const [imported, setImported] = useState("false");
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);


  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setFiles((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_IMAGES} images per package.`);
        return prev;
      }
      if (picked.length > room) toast.info(`Only ${room} more image(s) added — limit is ${MAX_IMAGES}.`);
      return [...prev, ...picked.slice(0, room).map((f) => ({ file: f, preview: URL.createObjectURL(f) }))];
    });
  };

  const removeAt = (i: number) =>
    setFiles((prev) => {
      const next = [...prev];
      const [gone] = next.splice(i, 1);
      if (gone) URL.revokeObjectURL(gone.preview);
      return next;
    });

  const [locating, setLocating] = useState(false);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          );
          if (res.ok) {
            const geo = (await res.json()) as {
              display_name?: string;
              address?: Record<string, string | undefined>;
            };
            const a = geo.address ?? {};
            const parts = [
              a["amenity"] ?? a["building"] ?? a["road"] ?? a["neighbourhood"] ?? a["suburb"],
              a["city"] ?? a["town"] ?? a["village"] ?? a["county"],
              a["state"],
            ].filter(Boolean);
            const name = parts.length ? parts.join(", ") : geo.display_name;
            if (name) setLocationLabel(name);
          }
          toast.success("Location captured");
        } catch {
          toast.success("Location captured (coordinates only)");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Could not read location. You can type it instead.");
      },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) {
      toast.error("Add at least one photo of the package label first.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expired. Please sign in again.");

      const paths: string[] = [];
      for (const { file } of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("label-images").upload(path, file, {
          contentType: file.type || "image/jpeg",
        });
        if (upErr) throw new Error(upErr.message);
        paths.push(path);
      }

      const result = await analyze({
        data: {
          imagePaths: paths,
          productName: productName || undefined,
          brand: brand || undefined,
          packageType,
          productCategory: category,
          imported: imported === "true",
          inspectionType: isGovernment ? "government_enforcement" : "private_pre_compliance",
          latitude: coords?.lat,
          longitude: coords?.lng,
          locationLabel: locationLabel || undefined,
          barcode: barcode.trim() ? barcode.trim() : null,
          barcodeSource: barcode.trim() ? (search.barcode ? "scanned" : "manual") : null,
          barcodeProductName: search.productName ?? null,
          barcodeManufacturer: null,
          packageContext: packageType,

        },
      });

      toast.success(`Analysis complete — score ${result.score}`);
      navigate({ to: "/app/inspections/$inspectionId", params: { inspectionId: result.inspectionId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Scan a package</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photograph the declaration panel so all mandatory text is readable. Results include evidence and confidence.
        </p>
      </header>

      <form className="grid gap-6 lg:grid-cols-2" onSubmit={submit}>
        <section className="surface-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Label images</h2>
            <span className="text-xs text-muted-foreground">
              {files.length}/{MAX_IMAGES} attached
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Add front, back, side and close-up shots of the same package — more angles give a more accurate check.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-border bg-muted">
            {files.length ? (
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                {files.map((f, i) => (
                  <div key={f.preview} className="relative overflow-hidden rounded-lg border border-border bg-background">
                    <img src={f.preview} alt={`Package label view ${i + 1}`} className="h-28 w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() => removeAt(i)}
                      className="absolute right-1 top-1 rounded-full bg-background/85 p-1 text-foreground hover:bg-background"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Camera className="size-8" aria-hidden="true" />
                <p className="text-sm">No images selected</p>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              disabled={files.length >= MAX_IMAGES}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" /> Take photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={files.length >= MAX_IMAGES}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> Upload images
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        <section className="surface-panel space-y-4 p-5">
          <h2 className="font-display text-base font-semibold">Package details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="pname">Product name (optional)</Label>
            <Input id="pname" className="h-11" value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand (optional)</Label>
            <Input id="brand" className="h-11" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barcode">Barcode (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                className="h-11 font-mono"
                inputMode="numeric"
                placeholder="Scan or type the product barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => navigate({ to: "/app/barcode" })}>
                Scan
              </Button>
            </div>
            {search.barcode ? (
              <p className="text-xs text-muted-foreground">Product identified from a scanned barcode.</p>
            ) : null}
          </div>


          <div className="grid gap-4 sm:grid-cols-2">
            <Picker label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
            <Picker label="Package type" value={packageType} onChange={setPackageType} options={PACKAGE_TYPES} />
          </div>

          <Picker
            label="Imported commodity"
            value={imported}
            onChange={setImported}
            options={["false", "true"]}
            render={(v) => (v === "true" ? "Yes — imported" : "No — domestic")}
          />

          <div className="space-y-1.5">
            <Label htmlFor="loc">Location</Label>
            <div className="flex gap-2">
              <Input
                id="loc"
                className="h-11"
                placeholder="Market, store or facility"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
              />
              <Button type="button" variant="outline" className="h-11 shrink-0" disabled={locating} onClick={captureLocation}>
                {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />} GPS
              </Button>
            </div>
            {coords ? (
              <p className="text-xs text-muted-foreground">
                {locationLabel ? <span className="font-medium text-foreground">{locationLabel} · </span> : null}
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            ) : null}
          </div>

          <Button type="submit" className="h-12 w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analysing {files.length} image{files.length > 1 ? "s" : ""}…
              </>
            ) : (
              "Run compliance check"
            )}
          </Button>
        </section>
      </form>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {render ? render(o) : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
