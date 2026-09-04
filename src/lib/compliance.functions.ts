import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AnalyzeInput = z.object({
  imagePaths: z.array(z.string().min(1)).min(1).max(6),
  productName: z.string().optional(),
  brand: z.string().optional(),
  packageType: z.string().optional(),
  productCategory: z.string().optional(),
  imported: z.boolean().optional(),
  inspectionType: z.enum(["government_enforcement", "private_pre_compliance"]),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  locationLabel: z.string().nullable().optional(),
});

type Declaration = {
  declaration_type: string;
  raw_text: string | null;
  normalized_value: string | null;
  language: string | null;
  confidence: number;
  status: "present" | "missing" | "unclear" | "invalid";
  notes: string | null;
};

type AiResult = {
  image_quality_score: number;
  product_name: string | null;
  brand: string | null;
  package_type: string | null;
  product_category: string | null;
  declarations: Declaration[];
  subscores: {
    declaration_correctness: number;
    font_and_visibility: number;
    readability: number;
    misleading_practices: number;
    package_specific: number;
  };
  findings: {
    rule_code: string;
    declaration_key: string | null;
    title: string;
    description: string;
    evidence: string;
    recommendation: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
  }[];
  summary: string;
};

const DECLARATION_KEYS = [
  "manufacturer_details",
  "commodity_name",
  "net_quantity",
  "manufacture_date",
  "mrp",
  "consumer_care",
  "country_of_origin",
  "best_before",
  "legibility",
  "misleading",
];

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const analyzeLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const dataUrls: string[] = [];
    for (const path of data.imagePaths) {
      const { data: signed, error: signError } = await supabase.storage
        .from("label-images")
        .createSignedUrl(path, 600);
      if (signError || !signed?.signedUrl) {
        throw new Error("Could not read one of the uploaded label images.");
      }
      const imageResponse = await fetch(signed.signedUrl);
      if (!imageResponse.ok) throw new Error("Could not download one of the uploaded label images.");
      const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
      const bytes = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
      dataUrls.push(`data:${contentType};base64,${bytes}`);
    }

    const { data: rules } = await supabase
      .from("compliance_rules")
      .select("rule_code, rule_name, description, declaration_key, severity")
      .eq("status", "active");

    const rulesText = (rules ?? [])
      .map((r) => `${r.rule_code} | key=${r.declaration_key} | ${r.rule_name} | severity=${r.severity} | ${r.description ?? ""}`)
      .join("\n");

    const systemPrompt = `You are Nirikshan AI, a Legal Metrology (Packaged Commodities) Rules, 2011 compliance analyst for India.
Analyse the packaged commodity label image and report ONLY what is visually verifiable. Never invent text you cannot read.
Applicable rules:
${rulesText}

Declaration keys you must report on (one entry each, even if missing): ${DECLARATION_KEYS.join(", ")}.
Rules for status: "present" when clearly readable and valid, "unclear" when detected but low confidence or partially legible, "invalid" when present but incorrectly formatted, "missing" when absent.
country_of_origin and best_before may be "not_applicable" — report them as status "present" with notes explaining non-applicability when the package type does not require them.
Return findings only for genuine issues, each mapped to a rule_code from the list.
Respond with strict JSON only, no markdown.`;

    const userPrompt = `Context provided by the user (may be empty, verify against the image):
product_name: ${data.productName ?? "unknown"}
brand: ${data.brand ?? "unknown"}
package_type: ${data.packageType ?? "unknown"}
product_category: ${data.productCategory ?? "unknown"}
imported: ${data.imported ? "yes" : "no"}

Return JSON with this exact shape:
{
  "image_quality_score": 0-100,
  "product_name": string|null,
  "brand": string|null,
  "package_type": string|null,
  "product_category": string|null,
  "declarations": [{"declaration_type": string, "raw_text": string|null, "normalized_value": string|null, "language": string|null, "confidence": 0-1, "status": "present"|"missing"|"unclear"|"invalid", "notes": string|null}],
  "subscores": {"declaration_correctness": 0-100, "font_and_visibility": 0-100, "readability": 0-100, "misleading_practices": 0-100, "package_specific": 0-100},
  "findings": [{"rule_code": string, "declaration_key": string|null, "title": string, "description": string, "evidence": string, "recommendation": string, "severity": "low"|"medium"|"high"|"critical", "confidence": 0-1}],
  "summary": string
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("AI is rate limited right now. Please retry in a moment.");
      if (response.status === 402) throw new Error("AI credits are exhausted for this workspace. Add credits to continue scanning.");
      throw new Error(`AI analysis failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    let ai: AiResult;
    try {
      ai = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as AiResult;
    } catch {
      throw new Error("AI returned an unreadable result. Please rescan with a clearer photo.");
    }

    const declarations = Array.isArray(ai.declarations) ? ai.declarations : [];
    const mandatoryKeys = ["manufacturer_details", "commodity_name", "net_quantity", "manufacture_date", "mrp", "consumer_care"];
    const mandatory = mandatoryKeys.map((key) => declarations.find((d) => d.declaration_type === key));
    const mandatoryPoints =
      mandatory.reduce((acc, d) => {
        if (!d) return acc;
        if (d.status === "present") return acc + 1;
        if (d.status === "unclear") return acc + 0.5;
        if (d.status === "invalid") return acc + 0.35;
        return acc;
      }, 0) / mandatoryKeys.length;

    const s = ai.subscores ?? ({} as AiResult["subscores"]);
    const score = clamp(
      mandatoryPoints * 35 +
        (clamp(s.declaration_correctness ?? 0) / 100) * 20 +
        (clamp(s.font_and_visibility ?? 0) / 100) * 15 +
        (clamp(s.readability ?? 0) / 100) * 10 +
        (clamp(s.misleading_practices ?? 0) / 100) * 10 +
        (clamp(s.package_specific ?? 0) / 100) * 10,
    );

    const findings = Array.isArray(ai.findings) ? ai.findings : [];
    const hasCritical = findings.some((f) => f.severity === "critical");
    const status: "compliant" | "needs_review" | "non_compliant" =
      score >= 85 && !hasCritical ? "compliant" : score >= 60 && !hasCritical ? "needs_review" : "non_compliant";

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        product_name: data.productName || ai.product_name || "Unidentified product",
        brand: data.brand || ai.brand,
        package_type: data.packageType || ai.package_type,
        product_category: data.productCategory || ai.product_category,
        organization_id: profile?.organization_id ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (productError) throw new Error(productError.message);

    const { data: inspection, error: inspectionError } = await supabase
      .from("inspections")
      .insert({
        product_id: product.id,
        inspector_id: userId,
        organization_id: profile?.organization_id ?? null,
        inspection_type: data.inspectionType,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        location_label: data.locationLabel ?? null,
        image_path: data.imagePath,
        image_quality_score: clamp(ai.image_quality_score ?? 0),
        compliance_score: score,
        status,
        summary: ai.summary ?? null,
        ai_raw: JSON.parse(JSON.stringify(ai)),
      })
      .select("id")
      .single();
    if (inspectionError) throw new Error(inspectionError.message);

    if (declarations.length) {
      await supabase.from("extracted_declarations").insert(
        declarations.map((d) => ({
          inspection_id: inspection.id,
          declaration_type: d.declaration_type,
          raw_text: d.raw_text,
          normalized_value: d.normalized_value,
          language: d.language,
          confidence_score: typeof d.confidence === "number" ? d.confidence : null,
          validation_status: d.status,
          notes: d.notes,
        })),
      );
    }

    if (findings.length) {
      await supabase.from("violations").insert(
        findings.map((f) => ({
          inspection_id: inspection.id,
          rule_code: f.rule_code,
          violation_type: f.title,
          description: f.description,
          evidence: f.evidence,
          recommendation: f.recommendation,
          severity: f.severity,
          confidence_score: typeof f.confidence === "number" ? f.confidence : null,
        })),
      );
    }

    return { inspectionId: inspection.id as string, score, status };
  });
