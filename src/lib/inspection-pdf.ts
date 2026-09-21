// Client-side PDF generation for inspection reports. Import dynamically from the page.
import { jsPDF } from "jspdf";
import { DECLARATION_LABELS } from "@/components/compliance";

export type ReportData = {
  productName: string;
  brand: string | null;
  packageType: string | null;
  category: string | null;
  score: number;
  status: string;
  inspectionDate: string;
  location: string;
  inspectionType: string;
  summary: string | null;
  inspectorName: string;
  barcode?: string | null;
  barcodeSource?: string | null;
  matchScore?: number | null;
  declarations: {
    declaration_type: string;
    raw_text: string | null;
    normalized_value: string | null;
    validation_status: string;
    confidence_score: number | null;
    notes: string | null;
  }[];
  violations: {
    rule_code: string | null;
    violation_type: string;
    description: string | null;
    evidence: string | null;
    severity: string;
    recommendation: string | null;
  }[];
  evidenceImages?: { dataUrl: string; label: string }[];
};

const MARGIN = 16;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function statusLabel(status: string) {
  return status === "compliant"
    ? "Compliant"
    : status === "needs_review"
      ? "Needs review"
      : "Non-compliant";
}

export function buildInspectionPdf(data: ReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > 282) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 94, 89);
    doc.text(text, MARGIN, y);
    y += 2;
    doc.setDrawColor(17, 94, 89);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  };

  const para = (
    text: string,
    opts?: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number },
  ) => {
    const size = opts?.size ?? 9;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts?.color ?? [40, 40, 40]));
    const lines = doc.splitTextToSize(text, CONTENT_W - (opts?.indent ?? 0));
    ensureSpace(lines.length * (size * 0.42) + 2);
    doc.text(lines, MARGIN + (opts?.indent ?? 0), y);
    y += lines.length * (size * 0.42) + 2;
  };

  // Header
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("Nirikshan AI — Label Compliance Report", MARGIN, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Legal Metrology (Packaged Commodities) Rules, 2011 · Decision-support assessment",
    MARGIN,
    19,
  );
  y = 34;

  // Verdict summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(`${data.score}/100`, MARGIN, y + 6);
  doc.setFontSize(11);
  const statusColor: [number, number, number] =
    data.status === "compliant"
      ? [22, 122, 66]
      : data.status === "needs_review"
        ? [161, 98, 7]
        : [185, 28, 28];
  doc.setTextColor(...statusColor);
  doc.text(statusLabel(data.status), MARGIN + 34, y + 6);
  y += 14;

  para(`Product: ${data.productName}`, { bold: true, size: 10 });
  para(
    [
      data.brand ? `Brand: ${data.brand}` : null,
      data.packageType ? `Package: ${data.packageType}` : null,
      data.category ? `Category: ${data.category}` : null,
    ]
      .filter(Boolean)
      .join("   ·   ") || "Product details not declared",
  );
  para(`Inspection date: ${data.inspectionDate}`);
  para(`Location: ${data.location}`);
  para(
    `Inspection type: ${data.inspectionType === "government_enforcement" ? "Government enforcement" : "Private pre-compliance"}`,
  );
  para(`Inspector: ${data.inspectorName}`);
  if (data.matchScore != null) para(`Product identity match: ${data.matchScore}%`);
  y += 3;

  if (data.summary) {
    heading("Assessment summary");
    para(data.summary);
    y += 2;
  }

  heading("Mandatory declarations");
  data.declarations.forEach((d) => {
    ensureSpace(16);
    const label = DECLARATION_LABELS[d.declaration_type] ?? d.declaration_type;
    const status = d.validation_status.charAt(0).toUpperCase() + d.validation_status.slice(1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(`${label}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const statusColor: [number, number, number] =
      d.validation_status === "present"
        ? [22, 122, 66]
        : d.validation_status === "missing"
          ? [185, 28, 28]
          : [161, 98, 7];
    doc.setTextColor(...statusColor);
    doc.text(status, PAGE_W - MARGIN, y, { align: "right" });
    y += 5;
    const value =
      d.normalized_value ||
      d.raw_text ||
      (d.validation_status === "missing" ? "Not detected on the label" : null);
    if (value) para(value);
    if (d.notes) para(`Note: ${d.notes}`, { size: 8, color: [100, 100, 100] });
    if (d.confidence_score != null)
      para(`Confidence ${Math.round(d.confidence_score * 100)}%`, {
        size: 8,
        color: [100, 100, 100],
      });
    y += 2;
  });
  if (data.declarations.length === 0) para("No declarations were extracted.");

  heading(`Violations (${data.violations.length})`);
  data.violations.forEach((v) => {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`[${v.severity.toUpperCase()}]`, MARGIN, y);
    if (v.rule_code) {
      doc.setTextColor(90, 90, 90);
      doc.text(v.rule_code, PAGE_W - MARGIN, y, { align: "right" });
    }
    y += 5;
    para(v.violation_type, { bold: true });
    if (v.description) para(v.description);
    if (v.evidence) para(`Evidence: ${v.evidence}`, { size: 8, color: [100, 100, 100] });
    if (v.recommendation)
      para(`Corrective action: ${v.recommendation}`, { size: 8.5, color: [17, 94, 89] });
    y += 3;
  });
  if (data.violations.length === 0)
    para("No violations were detected against the active rule set.");

  if (data.evidenceImages && data.evidenceImages.length > 0) {
    heading(`Evidence images (${data.evidenceImages.length})`);
    for (let i = 0; i < data.evidenceImages.length; i++) {
      const img = data.evidenceImages[i]!;
      const maxW = CONTENT_W;
      const maxH = 110;
      let w = maxW;
      let h = maxH;
      try {
        const props = doc.getImageProperties(img.dataUrl);
        const scale = Math.min(maxW / props.width, maxH / props.height);
        w = props.width * scale;
        h = props.height * scale;
      } catch {
        // fall back to full-width box
      }
      ensureSpace(h + 8);
      try {
        doc.addImage(img.dataUrl, MARGIN, y, w, h);
      } catch {
        para(`Image ${i + 1} could not be embedded.`, { size: 8, color: [150, 150, 150] });
        continue;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(img.label, MARGIN, y + h + 4);
      y += h + 8;
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Generated by Nirikshan AI — decision support only; low-confidence items require human review.",
      MARGIN,
      292,
    );
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, 292, { align: "right" });
  }

  return doc;
}
