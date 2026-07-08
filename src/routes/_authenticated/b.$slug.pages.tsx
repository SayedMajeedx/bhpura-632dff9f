import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Trash2, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBrand } from "@/lib/brand-context";

export const Route = createFileRoute("/_authenticated/b/$slug/pages")({
  component: PagesAndPolicies,
});

type PageSlot = {
  title_ar: string;
  title_en: string;
  content_ar: string;
  content_en: string;
  image_url: string | null;
};

const emptySlot = (): PageSlot => ({
  title_ar: "",
  title_en: "",
  content_ar: "",
  content_en: "",
  image_url: null,
});

const LONG_TTL = 60 * 60 * 24 * 365 * 10;

async function uploadPageImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/page-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("invoice-assets").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: se } = await supabase.storage.from("invoice-assets").createSignedUrl(path, LONG_TTL);
  if (se || !data) throw se ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

function PagesAndPolicies() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const brand = useBrand();
  const brandId = brand.id;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["business-settings-pages", brandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_settings")
        .select("pages, whatsapp_enabled, whatsapp_number")
        .eq("brand_id", brandId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [pages, setPages] = useState<PageSlot[]>(() => Array.from({ length: 5 }, emptySlot));
  const [waEnabled, setWaEnabled] = useState(false);
  const [waNumber, setWaNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!data) return;
    const raw = Array.isArray(data.pages) ? data.pages : [];
    setPages(
      Array.from({ length: 5 }, (_, i) => ({
        title_ar: raw[i]?.title_ar ?? "",
        title_en: raw[i]?.title_en ?? "",
        content_ar: raw[i]?.content_ar ?? "",
        content_en: raw[i]?.content_en ?? "",
        image_url: raw[i]?.image_url ?? null,
      })),
    );
    setWaEnabled(Boolean(data.whatsapp_enabled));
    setWaNumber(data.whatsapp_number ?? "");
  }, [data]);

  const updatePage = (idx: number, patch: Partial<PageSlot>) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const onPickImage = async (idx: number, file: File) => {
    try {
      setUploadingIdx(idx);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const url = await uploadPageImage(user.id, file);
      updatePage(idx, { image_url: url });
      toast.success(isAr ? "تم الرفع — لا تنس الحفظ" : "Uploaded — remember to save");
    } catch (e: any) {
      toast.error(e.message ?? (isAr ? "فشل الرفع" : "Upload failed"));
    } finally {
      setUploadingIdx(null);
    }
  };

  const save = async () => {
    setSaving(true);
    const cleaned = pages.map((p) => ({
      title_ar: p.title_ar.trim() || null,
      title_en: p.title_en.trim() || null,
      content_ar: p.content_ar.trim() || null,
      content_en: p.content_en.trim() || null,
      image_url: p.image_url || null,
    }));
    const number = waNumber.replace(/\s+/g, "").replace(/^00/, "+");
    const { error } = await (supabase.from("business_settings") as any)
      .update({
        pages: cleaned,
        whatsapp_enabled: waEnabled,
        whatsapp_number: number || null,
      })
      .eq("brand_id", brandId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isAr ? "تم الحفظ" : "Saved");
      qc.invalidateQueries({ queryKey: ["business-settings-pages", brandId] });
    }
  };

  if (isLoading) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">
          {isAr ? "الصفحات والسياسات" : "Pages & Policies"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "خصّص حتى 5 صفحات (دليل مقاسات، سياسة التوصيل، من نحن ...) — ستظهر الروابط الممتلئة تلقائياً في تذييل المتجر."
            : "Customize up to 5 pages (size guide, delivery policy, about us…). Filled slots appear automatically in your storefront footer."}
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" style={{ color: "#25D366" }} />
          <h2 className="font-display text-lg">
            {isAr ? "زر واتساب العائم" : "WhatsApp floating button"}
          </h2>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm font-medium">
              {isAr ? "تفعيل الأيقونة على المتجر" : "Enable icon on storefront"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr ? "أيقونة عائمة في زاوية المتجر تفتح محادثة واتساب مباشرة" : "Floating corner icon that opens a WhatsApp chat"}
            </p>
          </div>
          <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
        </div>
        <div>
          <Label>{isAr ? "رقم واتساب مع رمز الدولة" : "WhatsApp number with country code"}</Label>
          <Input
            value={waNumber}
            onChange={(e) => setWaNumber(e.target.value)}
            placeholder="+97312345678"
            inputMode="tel"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {isAr ? "مثال: 97312345678+ (بدون أصفار في البداية)" : "Example: +97312345678 (no leading zeros)"}
          </p>
        </div>
      </Card>

      {pages.map((p, i) => (
        <Card key={i} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">
              {isAr ? `الصفحة ${i + 1}` : `Page ${i + 1}`}
            </h2>
            {(p.title_ar || p.title_en || p.content_ar || p.content_en || p.image_url) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPages((prev) => prev.map((x, j) => (j === i ? emptySlot() : x)))}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isAr ? "مسح" : "Clear"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{isAr ? "العنوان بالعربي" : "Title (Arabic)"}</Label>
              <Input
                value={p.title_ar}
                onChange={(e) => updatePage(i, { title_ar: e.target.value })}
                placeholder={isAr ? "مثال: دليل المقاسات" : "e.g. دليل المقاسات"}
                dir="rtl"
              />
            </div>
            <div>
              <Label>{isAr ? "العنوان بالإنجليزي" : "Title (English)"}</Label>
              <Input
                value={p.title_en}
                onChange={(e) => updatePage(i, { title_en: e.target.value })}
                placeholder="e.g. Size Guide"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{isAr ? "المحتوى بالعربي" : "Content (Arabic)"}</Label>
              <Textarea
                value={p.content_ar}
                onChange={(e) => updatePage(i, { content_ar: e.target.value })}
                rows={6}
                dir="rtl"
              />
            </div>
            <div>
              <Label>{isAr ? "المحتوى بالإنجليزي" : "Content (English)"}</Label>
              <Textarea
                value={p.content_en}
                onChange={(e) => updatePage(i, { content_en: e.target.value })}
                rows={6}
              />
            </div>
          </div>

          <div>
            <Label>{isAr ? "صورة اختيارية" : "Optional image"}</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={(el) => { fileInputs.current[i] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(i, f); e.target.value = ""; }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputs.current[i]?.click()}
                disabled={uploadingIdx === i}
              >
                <Upload className="h-4 w-4 mr-1" />
                {uploadingIdx === i
                  ? (isAr ? "جاري الرفع…" : "Uploading…")
                  : (isAr ? "رفع صورة" : "Upload image")}
              </Button>
              {p.image_url && (
                <>
                  <img src={p.image_url} alt="" className="h-16 w-16 object-cover rounded border" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => updatePage(i, { image_url: null })}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    {isAr ? "إزالة" : "Remove"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : (isAr ? "حفظ التغييرات" : "Save changes")}
        </Button>
      </div>
    </div>
  );
}
