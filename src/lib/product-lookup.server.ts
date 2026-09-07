/**
 * External product discovery layer.
 *
 * Barcode scanning identifies a product from EXTERNAL sources first; the
 * Nirikshan AI database is consulted afterwards, only for inspection history.
 *
 * Providers are pluggable. A primary provider is tried first, then each
 * fallback in order. Nothing returned here is compliance evidence — the
 * physical package remains the primary evidence for Legal Metrology.
 *
 * Credentials are read from server-side environment variables inside the
 * provider call; they are never shipped to the browser.
 */

export type NormalizedProduct = {
  barcode: string;
  product_name: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  description: string | null;
  package_quantity: string | null;
  unit: string | null;
  country: string | null;
  ingredients: string | null;
  image_url: string | null;
  source: string;
  external_product_id: string | null;
  fetched_at: string;
  /** Rough completeness/identity confidence of the external record, 0-100. */
  confidence: number;
};

export type ProductLookupProvider = {
  /** Human readable source name shown to the user. */
  name: string;
  /** Return null when the provider has no record for this barcode. */
  lookup: (barcode: string) => Promise<NormalizedProduct | null>;
  /** Skip the provider when its configuration is absent. */
  enabled?: () => boolean;
};

/** Legacy alias kept for existing imports. */
export type ExternalProduct = NormalizedProduct;

const nonEmpty = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

export function scoreCompleteness(p: Omit<NormalizedProduct, "confidence">): number {
  const fields = [
    p.product_name,
    p.brand,
    p.manufacturer,
    p.category,
    p.package_quantity,
    p.country,
    p.image_url,
    p.description,
  ];
  const filled = fields.filter(Boolean).length;
  // Product name present is the strongest identity signal.
  const base = p.product_name ? 60 : 20;
  return Math.min(99, Math.round(base + (filled / fields.length) * 39));
}

function splitQuantity(raw: string | null): { quantity: string | null; unit: string | null } {
  if (!raw) return { quantity: null, unit: null };
  const m = raw.match(/^\s*([\d.,]+)\s*([a-zA-Z]+)?/);
  if (!m) return { quantity: raw, unit: null };
  return { quantity: m[1] ?? raw, unit: m[2] ?? null };
}

/** Open Food Facts — keyless, open data, good coverage for Indian FMCG. */
const openFoodFacts: ProductLookupProvider = {
  name: "Open Food Facts",
  lookup: async (barcode) => {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { headers: { "User-Agent": "NirikshanAI/1.0 (legal metrology compliance)" } },
    );
    if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`);
    const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const { quantity, unit } = splitQuantity(nonEmpty(p["quantity"]));
    const draft = {
      barcode,
      product_name:
        nonEmpty(p["product_name_en"]) ?? nonEmpty(p["product_name"]) ?? nonEmpty(p["generic_name"]),
      brand: nonEmpty(p["brands"]),
      manufacturer: nonEmpty(p["manufacturing_places"]) ?? nonEmpty(p["brand_owner"]),
      category: nonEmpty(p["categories"]),
      description: nonEmpty(p["generic_name"]),
      package_quantity: quantity,
      unit,
      country: nonEmpty(p["countries"]),
      ingredients: nonEmpty(p["ingredients_text"]),
      image_url: nonEmpty(p["image_front_url"]) ?? nonEmpty(p["image_url"]),
      source: "Open Food Facts",
      external_product_id: nonEmpty(p["_id"]) ?? barcode,
      fetched_at: new Date().toISOString(),
    };
    return { ...draft, confidence: scoreCompleteness(draft) };
  },
};

/**
 * Optional commercial provider, configured entirely server-side:
 *   EXTERNAL_PRODUCT_API_URL  e.g. https://api.example.com/lookup?barcode=
 *   EXTERNAL_PRODUCT_API_KEY  sent as the x-api-key header
 * Disabled automatically when unset.
 */
const configuredProvider: ProductLookupProvider = {
  name: process.env["EXTERNAL_PRODUCT_API_NAME"] || "Configured product database",
  enabled: () => !!process.env["EXTERNAL_PRODUCT_API_URL"],
  lookup: async (barcode) => {
    const url = process.env["EXTERNAL_PRODUCT_API_URL"]!;
    const key = process.env["EXTERNAL_PRODUCT_API_KEY"];
    const res = await fetch(`${url}${encodeURIComponent(barcode)}`, {
      headers: key ? { "x-api-key": key } : {},
    });
    if (!res.ok) throw new Error(`External provider responded ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    const item = (Array.isArray(json["items"]) ? json["items"][0] : json) as Record<string, unknown> | undefined;
    if (!item) return null;
    const { quantity, unit } = splitQuantity(nonEmpty(item["size"]) ?? nonEmpty(item["package_quantity"]));
    const draft = {
      barcode,
      product_name: nonEmpty(item["title"]) ?? nonEmpty(item["product_name"]),
      brand: nonEmpty(item["brand"]),
      manufacturer: nonEmpty(item["manufacturer"]),
      category: nonEmpty(item["category"]),
      description: nonEmpty(item["description"]),
      package_quantity: quantity,
      unit,
      country: nonEmpty(item["country"]),
      ingredients: nonEmpty(item["ingredients"]),
      image_url: Array.isArray(item["images"]) ? nonEmpty(item["images"][0]) : nonEmpty(item["image"]),
      source: process.env["EXTERNAL_PRODUCT_API_NAME"] || "Configured product database",
      external_product_id: nonEmpty(item["id"]) ?? barcode,
      fetched_at: new Date().toISOString(),
    };
    if (!draft.product_name) return null;
    return { ...draft, confidence: scoreCompleteness(draft) };
  },
};

const providers: ProductLookupProvider[] = [configuredProvider, openFoodFacts];

export function registerProductLookupProvider(provider: ProductLookupProvider, position: "primary" | "fallback" = "fallback") {
  if (position === "primary") providers.unshift(provider);
  else providers.push(provider);
}

export function hasProductLookupProvider() {
  return providers.some((p) => p.enabled?.() !== false);
}

export type ExternalLookupOutcome =
  | { status: "found"; product: NormalizedProduct }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function lookupExternalProduct(barcode: string): Promise<ExternalLookupOutcome> {
  let lastError: string | null = null;
  for (const provider of providers) {
    if (provider.enabled?.() === false) continue;
    try {
      const product = await provider.lookup(barcode);
      if (product) return { status: "found", product };
    } catch (err) {
      // A failing provider must never break the inspection flow — try the next.
      lastError = err instanceof Error ? err.message : "External provider failed";
    }
  }
  return lastError ? { status: "error", message: lastError } : { status: "not_found" };
}
