-- ENUMS
CREATE TYPE public.app_role AS ENUM ('super_admin','gov_admin','inspector','org_admin','org_user');
CREATE TYPE public.portal_type AS ENUM ('government','private','admin');
CREATE TYPE public.org_type AS ENUM ('government','private','manufacturer','retailer','inspection_agency');
CREATE TYPE public.compliance_status AS ENUM ('compliant','needs_review','non_compliant','processing');
CREATE TYPE public.severity_level AS ENUM ('low','medium','high','critical');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_type public.org_type NOT NULL DEFAULT 'private',
  jurisdiction text,
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  portal_type public.portal_type NOT NULL DEFAULT 'private',
  official_id text,
  designation text,
  jurisdiction text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_gov(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','gov_admin','inspector'));
$$;

CREATE OR REPLACE FUNCTION public.my_org(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  brand text,
  manufacturer text,
  barcode text,
  package_type text,
  product_category text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  inspector_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  inspection_type text NOT NULL DEFAULT 'private_pre_compliance',
  inspection_date timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  location_label text,
  image_path text,
  image_quality_score int,
  compliance_score int,
  status public.compliance_status NOT NULL DEFAULT 'processing',
  summary text,
  ai_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_inspection(_user_id uuid, _inspection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inspections i
    WHERE i.id = _inspection_id
      AND (public.is_gov(_user_id)
        OR i.inspector_id = _user_id
        OR (i.organization_id IS NOT NULL AND i.organization_id = public.my_org(_user_id)))
  );
$$;

CREATE TABLE public.extracted_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  declaration_type text NOT NULL,
  raw_text text,
  normalized_value text,
  language text,
  confidence_score numeric,
  validation_status text NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_declarations TO authenticated;
GRANT ALL ON public.extracted_declarations TO service_role;
ALTER TABLE public.extracted_declarations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code text NOT NULL UNIQUE,
  rule_name text NOT NULL,
  description text,
  applicable_package_type text NOT NULL DEFAULT 'all',
  declaration_key text,
  severity public.severity_level NOT NULL DEFAULT 'high',
  version int NOT NULL DEFAULT 1,
  effective_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rules TO authenticated;
GRANT ALL ON public.compliance_rules TO service_role;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  rule_code text,
  violation_type text NOT NULL,
  description text,
  evidence text,
  recommendation text,
  severity public.severity_level NOT NULL DEFAULT 'high',
  confidence_score numeric,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.violations TO authenticated;
GRANT ALL ON public.violations TO service_role;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_gov(auth.uid()) OR organization_id = public.my_org(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'gov_admin'));

CREATE POLICY "orgs read" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_gov(auth.uid()) OR id = public.my_org(auth.uid()));
CREATE POLICY "orgs insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orgs update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'gov_admin') OR (id = public.my_org(auth.uid()) AND public.has_role(auth.uid(),'org_admin')));

CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated
  USING (public.is_gov(auth.uid()) OR organization_id = public.my_org(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "products insert" ON public.products FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "products update" ON public.products FOR UPDATE TO authenticated
  USING (public.is_gov(auth.uid()) OR organization_id = public.my_org(auth.uid()));

CREATE POLICY "inspections read" ON public.inspections FOR SELECT TO authenticated
  USING (public.is_gov(auth.uid()) OR inspector_id = auth.uid() OR organization_id = public.my_org(auth.uid()));
CREATE POLICY "inspections insert" ON public.inspections FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());
CREATE POLICY "inspections update" ON public.inspections FOR UPDATE TO authenticated
  USING (public.is_gov(auth.uid()) OR inspector_id = auth.uid() OR organization_id = public.my_org(auth.uid()));

CREATE POLICY "declarations read" ON public.extracted_declarations FOR SELECT TO authenticated
  USING (public.can_access_inspection(auth.uid(), inspection_id));
CREATE POLICY "declarations write" ON public.extracted_declarations FOR INSERT TO authenticated
  WITH CHECK (public.can_access_inspection(auth.uid(), inspection_id));

CREATE POLICY "violations read" ON public.violations FOR SELECT TO authenticated
  USING (public.can_access_inspection(auth.uid(), inspection_id));
CREATE POLICY "violations write" ON public.violations FOR INSERT TO authenticated
  WITH CHECK (public.can_access_inspection(auth.uid(), inspection_id));
CREATE POLICY "violations update" ON public.violations FOR UPDATE TO authenticated
  USING (public.can_access_inspection(auth.uid(), inspection_id));

CREATE POLICY "rules read" ON public.compliance_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules insert" ON public.compliance_rules FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'gov_admin'));
CREATE POLICY "rules update" ON public.compliance_rules FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'gov_admin'));
CREATE POLICY "rules delete" ON public.compliance_rules FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'gov_admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _portal public.portal_type := COALESCE((NEW.raw_user_meta_data->>'portal_type')::public.portal_type, 'private');
  _org_id uuid;
  _org_name text := NULLIF(NEW.raw_user_meta_data->>'organization_name','');
BEGIN
  IF _portal = 'private' AND _org_name IS NOT NULL THEN
    INSERT INTO public.organizations (name, organization_type)
    VALUES (_org_name, 'private') RETURNING id INTO _org_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, portal_type, organization_id, official_id, jurisdiction)
  VALUES (NEW.id,
          NEW.raw_user_meta_data->>'full_name',
          NEW.email,
          _portal,
          _org_id,
          NULLIF(NEW.raw_user_meta_data->>'official_id',''),
          NULLIF(NEW.raw_user_meta_data->>'jurisdiction',''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _portal = 'government' THEN 'inspector'::public.app_role ELSE 'org_admin'::public.app_role END);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.compliance_rules (rule_code, rule_name, description, declaration_key, severity) VALUES
('LM-001','Name and address of manufacturer/packer/importer','Full name and complete address must be declared on the principal display panel.','manufacturer_details','high'),
('LM-002','Common or generic name of commodity','The commodity name must be clearly declared.','commodity_name','high'),
('LM-003','Net quantity declaration','Net quantity in standard units (g, kg, ml, l, N) must be declared.','net_quantity','critical'),
('LM-004','Month and year of manufacture/pack/import','Date of manufacture, packing or import must be declared.','manufacture_date','high'),
('LM-005','Retail sale price (MRP)','MRP must be declared as "Maximum Retail Price Rs. ... inclusive of all taxes".','mrp','critical'),
('LM-006','Consumer care details','Name, phone number and email of the consumer care executive must be declared.','consumer_care','high'),
('LM-007','Country of origin','Country of origin is required for imported packages.','country_of_origin','medium'),
('LM-008','Best before / use by date','Required for food and other perishable commodities.','best_before','medium'),
('LM-009','Font size and legibility','Declarations must meet minimum height requirements and remain legible.','legibility','medium'),
('LM-010','No misleading declarations','No sticker overlay, overwriting, dual MRP or hidden declarations.','misleading','critical');