import { createFileRoute } from "@tanstack/react-router";
import { AuthPortal } from "@/components/auth-portal";

export const Route = createFileRoute("/auth/government")({
  head: () => ({
    meta: [
      { title: "Government enforcement sign-in — Nirikshan AI" },
      {
        name: "description",
        content: "Secure sign-in for Legal Metrology officers and inspectors using Nirikshan AI enforcement tools.",
      },
      { property: "og:title", content: "Government enforcement sign-in — Nirikshan AI" },
      { property: "og:description", content: "Restricted access for Legal Metrology enforcement officers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPortal portal="government" />,
});
