import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Crown, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Main Administration Portal — Nirikshan AI" },
      {
        name: "description",
        content:
          "Secure sign-in for Nirikshan AI head administrators overseeing the government enforcement and business compliance portals.",
      },
      { property: "og:title", content: "Main Administration Portal — Nirikshan AI" },
      { property: "og:description", content: "Highest-level administration for the Nirikshan AI platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setBusy(false);
      toast.error(error?.message ?? "Invalid credentials");
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "main_admin");
    if (!roles || roles.length === 0) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("This account is not authorised for the Main Administration Portal.");
      return;
    }
    setBusy(false);
    toast.success("Signed in to Main Administration");
    navigate({ to: "/admin/dashboard", replace: true });
  };

  const forgot = async () => {
    if (!email.trim()) {
      toast.error("Enter your administrator email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset link sent");
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
          <span className="brand-gradient flex size-12 items-center justify-center rounded-xl text-primary-foreground">
            <Crown className="size-6" />
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold">Main Administration Portal</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Highest-level oversight of the Nirikshan AI platform — government enforcement, business compliance and
            system management. Every administrative action is recorded in the audit trail.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {[
              "Cross-portal users, organisations and permissions",
              "Platform-wide products, inspections and violations",
              "Legal Metrology rule engine configuration",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel w-full p-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <ShieldCheck className="size-4" aria-hidden="true" /> Restricted access
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold">Nirikshan AI</h2>
          <p className="text-sm text-muted-foreground">Main Administration Portal</p>
          <p className="mt-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Scan. Detect. Verify. Comply.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Administrator email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                required
                autoComplete="email"
                className="h-11"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={show ? "text" : "password"}
                  value={password}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-11"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                Keep me signed in
              </label>
              <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={forgot}>
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? "Verifying…" : "Sign in securely"}
            </Button>
          </form>

          <p className="mt-5 text-xs text-muted-foreground">
            Inspectors and business users sign in on their own portals from the{" "}
            <Link
              to="/"
              onClick={(e) => console.log("ADMIN_DEBUG link click, defaultPrevented:", e.defaultPrevented)}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              home page
            </Link>
            .{" "}
            <button
              type="button"
              className="rounded border px-2 text-xs"
              onClick={async () => {
                const w = window as unknown as { __TSR_ROUTER__?: unknown };
                console.log("ADMIN_DEBUG same router instance:", router === w.__TSR_ROUTER__);
                console.log("ADMIN_DEBUG state href:", router.state.location.href, "| status:", router.state.status);
                console.log("ADMIN_DEBUG latestLocation.href:", router.latestLocation.href);
                const built = router.buildLocation({ to: "/auth/government" });
                console.log("ADMIN_DEBUG built to /auth/government:", built.href, "| state:", JSON.stringify(built.state).slice(0, 200));
              }}
            >
              debug-nav
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
