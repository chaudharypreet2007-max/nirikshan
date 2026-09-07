-- Products: remember where externally discovered data came from
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS external_data jsonb,
  ADD COLUMN IF NOT EXISTS external_last_updated timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_status text NOT NULL DEFAULT 'not_inspected';

-- External product cache / versioned reference data
ALTER TABLE public.product_external_data
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS package_quantity text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS product_image_url text,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS product_external_data_expires_idx
  ON public.product_external_data (barcode, expires_at DESC);

-- Identity matching against external reference data
ALTER TABLE public.product_identity_matches
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS external_product_name text,
  ADD COLUMN IF NOT EXISTS ocr_brand text,
  ADD COLUMN IF NOT EXISTS external_brand text;
