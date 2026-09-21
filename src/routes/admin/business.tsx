import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin-ui";
import { OrganisationManager, PortalPeople } from "@/components/admin-orgs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/business")({
  head: () => ({
    meta: [
      { title: "Business management — Nirikshan AI admin" },
      {
        name: "description",
        content:
          "Register, verify and supervise manufacturers, retailers, inspection agencies and their users.",
      },
      { property: "og:title", content: "Business management — Nirikshan AI admin" },
      { property: "og:description", content: "Business organisations and their user accounts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessManagement,
});

function BusinessManagement() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Business management"
        description="Manufacturers, retailers, inspection agencies and private companies."
      />
      <Tabs defaultValue="organisations">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="organisations">Organisations</TabsTrigger>
          <TabsTrigger value="users">Business users</TabsTrigger>
        </TabsList>
        <TabsContent value="organisations" className="mt-4">
          <OrganisationManager scope="business" />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <PortalPeople portal="private" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
