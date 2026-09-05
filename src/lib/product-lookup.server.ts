/**
 * External product database abstraction.
 *
 * No third-party API is hard-coded. Register a provider here (or from an
 * environment-configured module) to enable external barcode lookups.
 * Anything returned by a provider is REFERENCE data only — the physical
 * package remains the primary evidence for Legal Metrology compliance.
 */

export type ExternalProduct = {
  productName: string | null;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  packageType: string | null;
  netQuantity: string | null;
  country: string | null;
  imageUrl: string | null;
  externalReference: string | null;
  raw: Record<string, unknown>;
};

export type ProductLookupProvider = {
  /** Human readable source name shown to the user. */
  name: string;
  /** Return null when the provider has no record for this barcode. */
  lookup: (barcode: string) => Promise<ExternalProduct | null>;
};

const providers: ProductLookupProvider[] = [];

export function registerProductLookupProvider(provider: ProductLookupProvider) {
  providers.push(provider);
}

export function hasProductLookupProvider() {
  return providers.length > 0;
}

export async function lookupExternalProduct(
  barcode: string,
): Promise<{ source: string; product: ExternalProduct } | null> {
  for (const provider of providers) {
    try {
      const product = await provider.lookup(barcode);
      if (product) return { source: provider.name, product };
    } catch {
      // A failing provider must never break the inspection flow.
    }
  }
  return null;
}
