import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Store, ExternalLink, Crown } from "lucide-react";
import { toast } from "sonner";
import { useI18n, useT } from "@/lib/i18n";
import { SUPER_ADMIN_EMAIL } from "@/lib/profile-context";

export const Route = createFileRoute("/_authenticated/brands")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const email = (user.email || "").toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL || profile?.role === "super_admin";
    if (!isSuperAdmin) throw redirect({ to: "/dashboard" });
  },
  component: BrandsPage,
});

type Brand = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

function BrandsPage() {
  const t = useT();
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Brand[];
    },
  });

  const brands = q.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-1">
            <Crown className="h-3.5 w-3.5" /> {lang === "ar" ? "المدير الأعلى" : "Super Admin"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-display">
            {lang === "ar" ? "العلامات التجارية" : "Brands"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "ar"
              ? "إدارة العلامات التجارية وعزل بيانات كل علامة تجارية."
              : "Create and manage the brands (tenants) hosted on this platform."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 me-2" /> {lang === "ar" ? "علامة تجارية جديدة" : "New Brand"}
            </Button>
          </DialogTrigger>
          <NewBrandDialog onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["brands"] }); }} />
        </Dialog>
      </div>

      {brands.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {lang === "ar" ? "لم يتم إنشاء أي علامة تجارية بعد." : "No brands yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name_en} className="h-10 w-10 rounded object-contain bg-secondary" />
                ) : (
                  <div className="h-10 w-10 rounded bg-secondary grid place-items-center">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg truncate">{b.name_en}</div>
                  <div className="text-xs text-muted-foreground truncate">/{b.slug}</div>
                </div>
                {!b.is_active && (
                  <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground">
                    {lang === "ar" ? "غير مفعل" : "Inactive"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/b/$slug/dashboard" params={{ slug: b.slug }}>
                    {lang === "ar" ? "فتح لوحة التحكم" : "Open workspace"}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/store/$slug" params={{ slug: b.slug }}>
                    <ExternalLink className="h-3.5 w-3.5 me-1.5" />
                    {lang === "ar" ? "المتجر" : "Storefront"}
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewBrandDialog({ onSaved }: { onSaved: () => void }) {
  const { lang } = useI18n();
  const [form, setForm] = useState({ slug: "", name_en: "", name_ar: "", logo_url: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const slug = form.slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) {
      toast.error(lang === "ar" ? "معرّف غير صالح (a-z, 0-9، -)" : "Invalid slug (a-z, 0-9, -)");
      return;
    }
    if (!form.name_en.trim()) {
      toast.error(lang === "ar" ? "الاسم بالإنجليزية مطلوب" : "English name is required");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from("brands") as any).insert({
        slug,
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim() || null,
        logo_url: form.logo_url.trim() || null,
        is_active: true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{lang === "ar" ? "علامة تجارية جديدة" : "New Brand"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>{lang === "ar" ? "المعرّف (الرابط)" : "Slug (URL)"}</Label>
          <Input
            placeholder="pura"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "ar" ? "سيظهر في: /b/{المعرّف} و /store/{المعرّف}" : "Used in /b/{slug} and /store/{slug}"}
          </p>
        </div>
        <div>
          <Label>{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
          <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </div>
        <div>
          <Label>{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
          <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        </div>
        <div>
          <Label>{lang === "ar" ? "رابط الشعار" : "Logo URL"}</Label>
          <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{lang === "ar" ? "إنشاء" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
