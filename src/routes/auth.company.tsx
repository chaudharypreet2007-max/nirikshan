import { createFileRoute } from "@tanstack/react-router";
import { AuthPortal } from "@/components/auth-portal";

export const Route = createFileRoute("/auth/company")({
  head: () => ({
    meta: [
      { title: "Business compliance sign-in — Nirikshan AI" },
      {
        name: "description",
        content:
          "Sign-in for manufacturers, packers, importers and retailers verifying packaged commodity labels before dispatch.",
      },
      { property: "og:title", content: "Business compliance sign-in — Nirikshan AI" },
      { property: "og:description", content: "Pre-dispatch Legal Metrology label verification for compliance teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <AuthPortal portal="private" />,
});
