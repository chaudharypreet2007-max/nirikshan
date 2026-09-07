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

/** Open*Facts family — keyless open data (food, beauty, general products). */
function offProvider(name: string, host: string): ProductLookupProvider {
  return {
    name,
    lookup: async (barcode) => {
      const res = await fetch(
        `https://${host}/api/v2/product/${encodeURIComponent(barcode)}.json`,
        { headers: { "User-Agent": "NirikshanAI/1.0 (legal metrology compliance)" } },
      );
      if (!res.ok) throw new Error(`${name} responded ${res.status}`);
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
        source: name,
        external_product_id: nonEmpty(p["_id"]) ?? barcode,
        fetched_at: new Date().toISOString(),
      };
      if (!draft.product_name && !draft.brand) return null;
      return { ...draft, confidence: scoreCompleteness(draft) };
    },
  };
}

const openFoodFacts = offProvider("Open Food Facts", "world.openfoodfacts.org");
const openProductsFacts = offProvider("Open Products Facts", "world.openproductsfacts.org");
const openBeautyFacts = offProvider("Open Beauty Facts", "world.openbeautyfacts.org");

/** UPCitemdb trial tier — keyless, broad retail coverage (rate limited). */
const upcItemDb: ProductLookupProvider = {
  name: "UPCitemdb",
  lookup: async (barcode) => {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
    );
    if (!res.ok) throw new Error(`UPCitemdb responded ${res.status}`);
    const json = (await res.json()) as { code?: string; items?: Record<string, unknown>[] };
    if (json.code !== "OK") throw new Error(`UPCitemdb: ${json.code ?? "error"}`);
    const item = json.items?.[0];
    if (!item) return null;
    const { quantity, unit } = splitQuantity(nonEmpty(item["size"]));
    const images = Array.isArray(item["images"]) ? (item["images"] as unknown[]) : [];
    const draft = {
      barcode,
      product_name: nonEmpty(item["title"]),
      brand: nonEmpty(item["brand"]),
      manufacturer: nonEmpty(item["manufacturer"]) ?? nonEmpty(item["brand"]),
      category: nonEmpty(item["category"]),
      description: nonEmpty(item["description"]),
      package_quantity: quantity,
      unit,
      country: null,
      ingredients: null,
      image_url: nonEmpty(images[0]),
      source: "UPCitemdb",
      external_product_id: nonEmpty(item["ean"]) ?? barcode,
      fetched_at: new Date().toISOString(),
    };
    if (!draft.product_name) return null;
    return { ...draft, confidence: scoreCompleteness(draft) };
  },
};

/** GS1 prefix table (subset) — country of registration for the barcode. */
function gs1Country(barcode: string): string | null {
  const digits = barcode.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const p = Number(digits.slice(0, 3));
  const ranges: [number, number, string][] = [
    [0, 19, "United States / Canada"],
    [30, 39, "United States"],
    [50, 59, "Coupons"],
    [300, 379, "France"],
    [380, 380, "Bulgaria"],
    [400, 440, "Germany"],
    [450, 459, "Japan"],
    [460, 469, "Russia"],
    [471, 471, "Taiwan"],
    [489, 489, "Hong Kong"],
    [490, 499, "Japan"],
    [500, 509, "United Kingdom"],
    [520, 521, "Greece"],
    [539, 539, "Ireland"],
    [560, 560, "Portugal"],
    [569, 569, "Iceland"],
    [570, 579, "Denmark"],
    [590, 590, "Poland"],
    [600, 601, "South Africa"],
    [619, 619, "Tunisia"],
    [621, 621, "Syria"],
    [625, 625, "Jordan"],
    [626, 626, "Iran"],
    [628, 628, "Saudi Arabia"],
    [629, 629, "United Arab Emirates"],
    [640, 649, "Finland"],
    [690, 699, "China"],
    [700, 709, "Norway"],
    [729, 729, "Israel"],
    [730, 739, "Sweden"],
    [750, 750, "Mexico"],
    [754, 755, "Canada"],
    [759, 759, "Venezuela"],
    [760, 769, "Switzerland"],
    [770, 771, "Colombia"],
    [773, 773, "Uruguay"],
    [775, 775, "Peru"],
    [777, 777, "Bolivia"],
    [779, 779, "Argentina"],
    [780, 780, "Chile"],
    [784, 784, "Paraguay"],
    [786, 786, "Ecuador"],
    [789, 790, "Brazil"],
    [800, 839, "Italy"],
    [840, 849, "Spain"],
    [850, 850, "Cuba"],
    [858, 858, "Slovakia"],
    [859, 859, "Czech Republic"],
    [860, 860, "Serbia"],
    [865, 865, "Mongolia"],
    [867, 867, "North Korea"],
    [868, 869, "Turkey"],
    [870, 879, "Netherlands"],
    [880, 880, "South Korea"],
    [884, 884, "Cambodia"],
    [885, 885, "Thailand"],
    [888, 888, "Singapore"],
    [890, 890, "India"],
    [893, 893, "Vietnam"],
    [896, 896, "Pakistan"],
    [899, 899, "Indonesia"],
    [900, 919, "Austria"],
    [930, 939, "Australia"],
    [940, 949, "New Zealand"],
    [955, 955, "Malaysia"],
    [958, 958, "Macau"],
  ];
  for (const [lo, hi, country] of ranges) if (p >= lo && p <= hi) return country;
  return null;
}

/**
 * Last-resort fallback: no commercial record exists, but the barcode itself
 * still carries the GS1 registration country and company prefix. This is
 * reference information only — never product verification.
 */
const gs1Registry: ProductLookupProvider = {
  name: "GS1 barcode registry (basic)",
  lookup: async (barcode) => {
    const country = gs1Country(barcode);
    if (!country) return null;
    const digits = barcode.replace(/\D/g, "");
    return {
      barcode,
      product_name: null,
      brand: null,
      manufacturer: null,
      category: null,
      description: `No commercial record found. Barcode registered in ${country}; company prefix ${digits.slice(0, 7)}.`,
      package_quantity: null,
      unit: null,
      country,
      ingredients: null,
      image_url: null,
      source: "GS1 barcode registry (basic)",
      external_product_id: digits,
      fetched_at: new Date().toISOString(),
      confidence: 20,
    };
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

const providers: ProductLookupProvider[] = [
  configuredProvider,
  openFoodFacts,
  openProductsFacts,
  openBeautyFacts,
  upcItemDb,
  // Always last: basic barcode registry information when nothing else matches.
  gs1Registry,
];

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
