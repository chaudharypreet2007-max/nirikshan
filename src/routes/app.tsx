import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ScanLine,
  ClipboardList,
  Gavel,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/scan", label: "Scan package", icon: ScanLine },
  { to: "/app/inspections", label: "Inspections", icon: ClipboardList },
  { to: "/app/rules", label: "Rule engine", icon: Gavel },
];

function AppLayout() {
  const { loading, session, profile, isGovernment, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Verifying access…</p>
      </div>
    );
  }

  const portalLabel = isGovernment ? "Enforcement portal" : "Business portal";
  const PortalIcon = isGovernment ? ShieldCheck : Building2;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Wordmark tone="invert" showTagline />
          <button
            className="rounded-md p-2 text-sidebar-foreground/80 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mx-5 flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-xs font-semibold text-sidebar-accent-foreground">
          <PortalIcon className="size-4" aria-hidden="true" />
          {portalLabel}
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith(item.to)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4.5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="safe-pb border-t border-sidebar-border px-5 py-4">
          <p className="truncate text-sm font-semibold">{profile?.full_name ?? profile?.email ?? "Signed in"}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{profile?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-px sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 py-3 backdrop-blur lg:hidden">
          <button className="rounded-md p-2" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Wordmark />
        </header>

        <main className="safe-px safe-pb mx-auto w-full max-w-6xl flex-1 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
