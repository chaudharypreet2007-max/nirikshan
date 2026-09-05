import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LookupInput = z.object({
  barcode: z.string().trim().min(4).max(64),
  format: z.string().max(32).optional(),
});

export type BarcodeLookupResult = {
  barcode: string;
  found: boolean;
  source: "internal" | "external" | "none";
  sourceLabel: string;
  sourceUpdatedAt: string | null;
  product: {
    id: string | null;
    productName: string | null;
    brand: string | null;
    manufacturer: string | null;
    category: string | null;
    packageType: string | null;
    netQuantity: string | null;
    variantName: string | null;
  } | null;
  /** Product-level, de-identified aggregate — never other officers' records. */
  passport: {
    totalInspections: number;
    latestScore: number | null;
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

export const lookupBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LookupInput.parse(input))
  .handler(async ({ data, context }): Promise<BarcodeLookupResult> => {
    const { supabase, userId } = context;
    const barcode = data.barcode.trim();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Internal repository — product-level identity only.
    const { data: internal } = await supabaseAdmin
      .from("products")
      .select("id, product_name, brand, manufacturer, product_category, package_type, net_quantity, variant_name")
      .eq("barcode", barcode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let source: BarcodeLookupResult["source"] = internal ? "internal" : "none";
    let sourceLabel = internal ? "Nirikshan AI Repository" : "No source";
    let sourceUpdatedAt: string | null = null;
    let product: BarcodeLookupResult["product"] = internal
      ? {
          id: internal.id,
          productName: internal.product_name,
          brand: internal.brand,
          manufacturer: internal.manufacturer,
          category: internal.product_category,
          packageType: internal.package_type,
          netQuantity: internal.net_quantity,
          variantName: internal.variant_name,
        }
      : null;

    // 2) Cached external reference data, then any registered external provider.
    if (!product) {
      const { data: cached } = await supabaseAdmin
        .from("product_external_data")
        .select("source_name, raw_data, last_updated")
        .eq("barcode", barcode)
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const raw = (cached.raw_data ?? {}) as Record<string, string | null>;
        source = "external";
        sourceLabel = cached.source_name;
        sourceUpdatedAt = cached.last_updated;
        product = {
          id: null,
          productName: raw["productName"] ?? null,
          brand: raw["brand"] ?? null,
          manufacturer: raw["manufacturer"] ?? null,
          category: raw["category"] ?? null,
          packageType: raw["packageType"] ?? null,
          netQuantity: raw["netQuantity"] ?? null,
          variantName: null,
        };
      } else {
        const { lookupExternalProduct } = await import("./product-lookup.server");
        const external = await lookupExternalProduct(barcode);
        if (external) {
          source = "external";
          sourceLabel = external.source;
          sourceUpdatedAt = new Date().toISOString();
          product = {
            id: null,
            productName: external.product.productName,
            brand: external.product.brand,
            manufacturer: external.product.manufacturer,
            category: external.product.category,
            packageType: external.product.packageType,
            netQuantity: external.product.netQuantity,
            variantName: null,
          };
          await supabaseAdmin.from("product_external_data").upsert(
            {
              barcode,
              source_name: external.source,
              external_reference: external.product.externalReference,
              raw_data: JSON.parse(JSON.stringify({ ...external.product, raw: undefined })),
              last_updated: new Date().toISOString(),
            },
            { onConflict: "barcode,source_name" },
          );
        }
      }
    }

    // 3) De-identified product-level aggregate (no inspector identities, no records).
    let passport: BarcodeLookupResult["passport"] = {
      totalInspections: 0,
      latestScore: null,
      latestInspectionDate: null,
      risk: "unknown",
    };

    const { data: agg } = await supabaseAdmin
      .from("inspections")
      .select("compliance_score, inspection_date")
      .eq("barcode", barcode)
      .is("deleted_at", null)
      .order("inspection_date", { ascending: false })
      .limit(50);

    if (agg && agg.length) {
      const latest = agg[0]!;
      const avg = agg.reduce((a, r) => a + (r.compliance_score ?? 0), 0) / agg.length;
      passport = {
        totalInspections: agg.length,
        latestScore: latest.compliance_score,
        latestInspectionDate: latest.inspection_date,
        risk: avg >= 85 ? "low" : avg >= 60 ? "medium" : "high",
      };
    }

    // 4) The caller's OWN history only — RLS-scoped client.
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

    await supabase.from("barcode_lookup_logs").insert({
      user_id: userId,
      barcode,
      barcode_format: data.format ?? null,
      product_id: product?.id ?? null,
      lookup_source: source,
      lookup_status: product ? "found" : "not_found",
    });

    return {
      barcode,
      found: !!product,
      source,
      sourceLabel,
      sourceUpdatedAt,
      product,
      passport,
      myHistory,
    };
  });
