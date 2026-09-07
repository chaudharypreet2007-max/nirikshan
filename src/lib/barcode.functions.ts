import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LookupInput = z.object({
  barcode: z.string().trim().min(4).max(64),
  format: z.string().max(32).optional(),
  /** Skip the cache and re-query the external provider. */
  refresh: z.boolean().optional(),
});

export type ExternalProductInfo = {
  barcode: string;
  productName: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  description: string | null;
  packageQuantity: string | null;
  unit: string | null;
  country: string | null;
  ingredients: string | null;
  imageUrl: string | null;
  source: string;
  externalProductId: string | null;
  fetchedAt: string;
  /** Product identity confidence — never a compliance confidence. */
  confidence: number;
  /** True when served from the secure server-side cache. */
  cached: boolean;
};

export type BarcodeLookupResult = {
  barcode: string;
  /** Stage 1 — external product discovery. */
  external: {
    status: "found" | "not_found" | "error";
    message: string | null;
    product: ExternalProductInfo | null;
  };
  /** Stage 2 — Nirikshan AI inspection history (de-identified aggregate). */
  nirikshan: {
    inspected: boolean;
    productId: string | null;
    productName: string | null;
    totalInspections: number;
    latestScore: number | null;
    latestStatus: string | null;
    latestInspectionDate: string | null;
    risk: "low" | "medium" | "high" | "unknown";
  };
  /** Only the signed-in user's own inspections for this barcode. */
  myHistory: {
    id: string;
    inspectionDate: string;
    score: number | null;
    status: string;
    productName: string | null;
  }[];
};

function cacheHours(): number {
  const raw = Number(process.env["PRODUCT_CACHE_HOURS"]);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LookupInput.parse(input))
  .handler(async ({ data, context }): Promise<BarcodeLookupResult> => {
    const { supabase, userId } = context;
    const barcode = data.barcode.trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ── STAGE 1: external product discovery (primary source) ───────────────
    let external: BarcodeLookupResult["external"] = { status: "not_found", message: null, product: null };

    const nowIso = new Date().toISOString();
    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("product_external_data")
        .select("*")
        .eq("barcode", barcode)
        .gt("expires_at", nowIso)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const raw = (cached.raw_data ?? {}) as Record<string, unknown>;
        external = {
          status: "found",
          message: null,
          product: {
            barcode,
            productName: cached.product_name,
            brand: cached.brand,
            manufacturer: cached.manufacturer,
            category: cached.category,
            description: (raw["description"] as string | null) ?? null,
            packageQuantity: cached.package_quantity,
            unit: cached.unit,
            country: cached.country,
            ingredients: (raw["ingredients"] as string | null) ?? null,
            imageUrl: cached.product_image_url,
            source: cached.source_name,
            externalProductId: cached.external_product_id,
            fetchedAt: cached.fetched_at,
            confidence: Number(raw["confidence"] ?? 80),
            cached: true,
          },
        };
      }
    }

    if (!external.product) {
      const { lookupExternalProduct } = await import("./product-lookup.server");
      const outcome = await lookupExternalProduct(barcode);

      if (outcome.status === "found") {
        const p = outcome.product;
        external = {
          status: "found",
          message: null,
          product: {
            barcode,
            productName: p.product_name,
            brand: p.brand,
            manufacturer: p.manufacturer,
            category: p.category,
            description: p.description,
            packageQuantity: p.package_quantity,
            unit: p.unit,
            country: p.country,
            ingredients: p.ingredients,
            imageUrl: p.image_url,
            source: p.source,
            externalProductId: p.external_product_id,
            fetchedAt: p.fetched_at,
            confidence: p.confidence,
            cached: false,
          },
        };

        // Versioned cache row — history is preserved, never overwritten.
        await supabaseAdmin.from("product_external_data").insert({
          barcode,
          source_name: p.source,
          external_reference: p.external_product_id,
          external_product_id: p.external_product_id,
          product_name: p.product_name,
          brand: p.brand,
          manufacturer: p.manufacturer,
          category: p.category,
          package_quantity: p.package_quantity,
          unit: p.unit,
          country: p.country,
          product_image_url: p.image_url,
          raw_data: JSON.parse(JSON.stringify(p)),
          fetched_at: p.fetched_at,
          expires_at: new Date(Date.now() + cacheHours() * 3600_000).toISOString(),
          last_updated: p.fetched_at,
        });
      } else if (outcome.status === "error") {
        external = {
          status: "error",
          message: "The external product database is unavailable right now.",
          product: null,
        };
      }
    }

    // ── STAGE 2: Nirikshan AI history (matching only, never discovery) ─────
    const { data: internal } = await supabaseAdmin
      .from("products")
      .select("id, product_name, brand, manufacturer")
      .eq("barcode", barcode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nirikshan: BarcodeLookupResult["nirikshan"] = {
      inspected: false,
      productId: internal?.id ?? null,
      productName: internal?.product_name ?? null,
      totalInspections: 0,
      latestScore: null,
      latestStatus: null,
      latestInspectionDate: null,
      risk: "unknown",
    };

    const { data: agg } = await supabaseAdmin
      .from("inspections")
      .select("compliance_score, inspection_date, status")
      .eq("barcode", barcode)
      .is("deleted_at", null)
      .order("inspection_date", { ascending: false })
      .limit(50);

    if (agg && agg.length) {
      const latest = agg[0]!;
      const avg = agg.reduce((a, r) => a + (r.compliance_score ?? 0), 0) / agg.length;
      nirikshan = {
        ...nirikshan,
        inspected: true,
        totalInspections: agg.length,
        latestScore: latest.compliance_score,
        latestStatus: latest.status as string,
        latestInspectionDate: latest.inspection_date,
        risk: avg >= 85 ? "low" : avg >= 60 ? "medium" : "high",
      };
    }

    // The caller's OWN records only — RLS-scoped client.
    const { data: mine } = await supabase
      .from("inspections")
      .select("id, inspection_date, compliance_score, status, products(product_name)")
      .eq("barcode", barcode)
      .order("inspection_date", { ascending: false })
      .limit(20);

    const myHistory = (mine ?? []).map((r) => ({
      id: r.id,
      inspectionDate: r.inspection_date,
      score: r.compliance_score,
      status: r.status as string,
      productName: (r.products as { product_name: string } | null)?.product_name ?? null,
    }));

    const lookupStatus =
      external.status === "error"
        ? "api_error"
        : external.status === "not_found"
          ? "not_found"
          : nirikshan.inspected
            ? "found_and_inspected"
            : "found_not_inspected";

    await supabase.from("barcode_lookup_logs").insert({
      user_id: userId,
      barcode,
      barcode_format: data.format ?? null,
      product_id: nirikshan.productId,
      lookup_source: external.product ? (external.product.cached ? "cache" : "external") : "none",
      lookup_status: lookupStatus,
    });

    return { barcode, external, nirikshan, myHistory };
  });

const RegisterInput = z.object({
  barcode: z.string().trim().min(4).max(64),
});

/**
 * Creates a Nirikshan product profile from the externally discovered data so a
 * never-before-seen product can be inspected. inspection_status stays
 * "not_inspected" until an actual physical inspection is recorded.
 */
export const createProductFromExternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RegisterInput.parse(input))
  .handler(async ({ data, context }): Promise<{ productId: string | null }> => {
    const { userId } = context;
    const barcode = data.barcode.trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("barcode", barcode)
      .limit(1)
      .maybeSingle();
    if (existing) return { productId: existing.id };

    const { data: cached } = await supabaseAdmin
      .from("product_external_data")
      .select("*")
      .eq("barcode", barcode)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cached?.product_name) return { productId: null };

    const { data: created } = await supabaseAdmin
      .from("products")
      .insert({
        product_name: cached.product_name,
        brand: cached.brand,
        manufacturer: cached.manufacturer,
        product_category: cached.category,
        net_quantity: [cached.package_quantity, cached.unit].filter(Boolean).join(" ") || null,
        barcode,
        created_by: userId,
        external_source: cached.source_name,
        external_product_id: cached.external_product_id,
        external_data: cached.raw_data,
        external_last_updated: cached.fetched_at,
        inspection_status: "not_inspected",
      })
      .select("id")
      .maybeSingle();

    return { productId: created?.id ?? null };
  });
