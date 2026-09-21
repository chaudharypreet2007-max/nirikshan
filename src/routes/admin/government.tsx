import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin-ui";
import { OrganisationManager, PortalPeople } from "@/components/admin-orgs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/government")({
  head: () => ({
    meta: [
      { title: "Government management — Nirikshan AI admin" },
      {
        name: "description",
        content: "Manage government organisations, inspectors and enforcement administrators.",
      },
      { property: "og:title", content: "Government management — Nirikshan AI admin" },
      {
        property: "og:description",
        content: "Organisations, jurisdictions and officer permissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GovernmentManagement,
});

function GovernmentManagement() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Government management"
        description="Enforcement organisations, inspectors and government administrators."
      />
      <Tabs defaultValue="organisations">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="organisations">Organisations</TabsTrigger>
          <TabsTrigger value="officers">Officers</TabsTrigger>
        </TabsList>
        <TabsContent value="organisations" className="mt-4">
          <OrganisationManager scope="government" />
        </TabsContent>
        <TabsContent value="officers" className="mt-4">
          <PortalPeople portal="government" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
