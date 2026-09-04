import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PortalType = "government" | "private" | "admin";
export type AppRole = "super_admin" | "gov_admin" | "inspector" | "org_admin" | "org_user";

export type AuthProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  portal_type: PortalType;
  organization_id: string | null;
  official_id: string | null;
  jurisdiction: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (userId: string) => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, portal_type, organization_id, official_id, jurisdiction")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!active) return;
      setProfile((p as AuthProfile) ?? null);
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => void load(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        void load(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isGovernment = roles.some((r) => r === "inspector" || r === "gov_admin" || r === "super_admin");

  return {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    loading,
    isGovernment,
    isAdmin: roles.some((r) => r === "gov_admin" || r === "super_admin" || r === "org_admin"),
    signOut: () => supabase.auth.signOut(),
  };
}
