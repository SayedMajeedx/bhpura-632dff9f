import { createFileRoute, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

/**
 * Public storefront placeholder — reserves the /store/:slug URL.
 * Fetches brand by slug and renders a "coming soon" shell. The full
 * customer-facing catalog will render here once products get a public
 * SELECT policy scoped by brand_id + is_active.
 */
export const Route = createFileRoute("/store/$slug")({
  loader: async ({ params }) => {
    const { data: brand, error } = await supabase
      .from("brands")
      .select("id, slug, name_en, name_ar, logo_url, is_active")
      .eq("slug", params.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !brand) throw notFound();
    return { brand };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.brand ? `${loaderData.brand.name_en} — Storefront` : "Storefront" },
      { name: "description", content: `Shop ${loaderData?.brand?.name_en ?? "our brand"} online.` },
    ],
  }),
  component: StorefrontComingSoon,
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center p-8">
      <Card className="p-8 text-center max-w-md">
        <h1 className="text-2xl font-display mb-2">Storefront not found</h1>
        <p className="text-muted-foreground">This brand doesn't have an active storefront yet.</p>
      </Card>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8">
      <Card className="p-8 text-center max-w-md">
        <h1 className="text-2xl font-display mb-2">Storefront not found</h1>
        <p className="text-muted-foreground">This brand doesn't have an active storefront yet.</p>
      </Card>
    </div>
  ),
});

function StorefrontComingSoon() {
  const { brand } = Route.useLoaderData();
  return (
    <div className="min-h-screen grid place-items-center p-8 bg-background">
      <Card className="p-10 text-center max-w-lg">
        {brand.logo_url && (
          <img src={brand.logo_url} alt={brand.name_en} className="h-16 mx-auto mb-6 object-contain" />
        )}
        <h1 className="text-3xl font-display mb-2">{brand.name_en}</h1>
        {brand.name_ar && <p className="text-lg text-muted-foreground mb-6">{brand.name_ar}</p>}
        <p className="text-muted-foreground">Storefront coming soon.</p>
      </Card>
    </div>
  );
}
