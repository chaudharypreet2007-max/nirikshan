import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, ShieldCheck, Building2 } from "lucide-react";

type Portal = "government" | "private";

export function AuthPortal({ portal }: { portal: Portal }) {
  const navigate = useNavigate();
  const isGov = portal === "government";
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgOrId, setOrgOrId] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  const goDashboard = () => navigate({ to: "/app/dashboard" });

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("portal_type")
      .eq("id", data.user.id)
      .maybeSingle();
    setBusy(false);
    if (profile && profile.portal_type !== portal && profile.portal_type !== "admin") {
      await supabase.auth.signOut();
      toast.error(
        isGov
          ? "This account is registered on the business portal. Please sign in there."
          : "This account is registered on the government portal. Please sign in there.",
      );
      return;
    }
    toast.success("Signed in");
    goDashboard();
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app/dashboard`,
        data: {
          full_name: fullName,
          portal_type: portal,
          ...(isGov ? { official_id: orgOrId, jurisdiction } : { organization_name: orgOrId }),
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You can sign in now.");
    goDashboard();
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try email and password.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    goDashboard();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="safe-px mx-auto flex w-full max-w-5xl items-center justify-between py-5">
        <Wordmark />
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> Portals
          </Link>
        </Button>
      </header>

      <main className="safe-px safe-pb mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 pb-12 lg:grid-cols-[1fr_minmax(0,420px)]">
        <section className="hidden lg:block">
          <span
            className={
              isGov
                ? "flex size-12 items-center justify-center rounded-xl bg-gov text-gov-foreground"
                : "flex size-12 items-center justify-center rounded-xl bg-enterprise text-enterprise-foreground"
            }
          >
            {isGov ? <ShieldCheck className="size-6" /> : <Building2 className="size-6" />}
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold">
            {isGov ? "Government enforcement portal" : "Business compliance portal"}
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            {isGov
              ? "Restricted to Legal Metrology officers, inspectors and authorised administrators. All access attempts and inspections are logged."
              : "For manufacturers, packers, importers, retailers and e-commerce compliance teams verifying packaging before dispatch."}
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {(isGov
              ? ["Field scanning with GPS and timestamp", "Violation and enforcement workflow", "Jurisdiction-level analytics"]
              : ["Pre-dispatch label verification", "Corrective action recommendations", "Product compliance repository"]
            ).map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel w-full p-6">
          <h2 className="font-display text-xl font-semibold lg:hidden">
            {isGov ? "Government enforcement portal" : "Business compliance portal"}
          </h2>
          <Tabs defaultValue="signin" className="mt-2 lg:mt-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-4" onSubmit={signIn}>
                <Field
                  id="email"
                  label={isGov ? "Registered Government Email address" : "Official email"}
                  type="email"
                  value={email}
                  onChange={setEmail}
                />
                <Field id="password" label="Password" type="password" value={password} onChange={setPassword} />
                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? "Verifying…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-4" onSubmit={signUp}>
                <Field id="name" label="Full name" value={fullName} onChange={setFullName} />
                <Field
                  id="org"
                  label={isGov ? "Official / employee ID" : "Organisation name"}
                  value={orgOrId}
                  onChange={setOrgOrId}
                />
                {isGov ? (
                  <Field id="jurisdiction" label="Jurisdiction" value={jurisdiction} onChange={setJurisdiction} />
                ) : null}
                <Field id="email2" label="Work email" type="email" value={email} onChange={setEmail} />
                <Field id="password2" label="Password" type="password" value={password} onChange={setPassword} />
                <Button type="submit" className="h-11 w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="h-11 w-full" onClick={googleSignIn} disabled={busy}>
            Continue with Google
          </Button>

          <p className="mt-5 text-xs text-muted-foreground">
            {isGov ? (
              <>
                Not an enforcement user? <Link to="/auth/company" className="font-semibold text-primary underline-offset-4 hover:underline">Business portal</Link>
              </>
            ) : (
              <>
                Government officer? <Link to="/auth/government" className="font-semibold text-primary underline-offset-4 hover:underline">Enforcement portal</Link>
              </>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={type === "password" ? "current-password" : "on"}
        className="h-11"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
