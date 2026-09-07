DROP INDEX IF EXISTS public.product_external_data_barcode_source_idx;
CREATE INDEX IF NOT EXISTS product_external_data_barcode_fetched_idx
  ON public.product_external_data (barcode, fetched_at DESC);
