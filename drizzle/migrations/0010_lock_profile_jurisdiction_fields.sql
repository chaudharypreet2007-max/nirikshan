CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_super boolean;
  is_gov_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_super := public.has_role(auth.uid(), 'super_admin');
  is_gov_admin := public.has_role(auth.uid(), 'gov_admin');

  IF TG_OP = 'INSERT' THEN
    -- Nobody but a super admin may self-assign oversight-relevant attributes.
    IF NOT is_super THEN
      NEW.official_id := NULL;
      NEW.jurisdiction := NULL;
      NEW.designation := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: super admins may change anything.
  IF is_super THEN
    RETURN NEW;
  END IF;

  -- Gov admins may administer other officers but never their own
  -- oversight scope (self-escalation via jurisdiction matching).
  IF is_gov_admin AND NEW.id <> auth.uid() THEN
    NEW.portal_type := OLD.portal_type;
    RETURN NEW;
  END IF;

  NEW.organization_id := OLD.organization_id;
  NEW.official_id := OLD.official_id;
  NEW.portal_type := OLD.portal_type;
  NEW.jurisdiction := OLD.jurisdiction;
  NEW.designation := OLD.designation;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profile_insert_trg ON public.profiles;
CREATE TRIGGER protect_profile_insert_trg
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
