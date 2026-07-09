import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrderDetailsPage() {
  // جلب الـ id والـ slug بشكل صحيح ومتوافق مع الرابط الحالي للمتجر
  const { id, slug } = useParams({ strict: false }) as { id: string; slug: string };
  const { toast } = useToast();
  
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<boolean | null>(null);

  // 1. جلب بيانات البراند بناءً على الـ slug الموجود في الرابط
  const { data: brand, isLoading: brandLoading } = useQuery({
    queryKey: ["admin-brand", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // 2. جلب بيانات الطلب والمنتجات
  const { data: order, isLoading: orderLoading, error, refetch } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            product:products(*)
          ),
          customer:customers(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleResendEmail = async () => {
    if (!id) return;
    setEmailLoading(true);
    setEmailSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-email", {
        body: { order_id: id },
      });

      if (error) throw error;

      setEmailSuccess(true);
      toast({
        title: "تم إرسال البريد",
        description: "تم إرسال بريد تأكيد الطلب للعميل بنجاح.",
      });
      refetch();
    } catch (err) {
      console.error(err);
      setEmailSuccess(false);
      toast({
        variant: "destructive",
        title: "فشل الإرسال",
        description: "حدث خطأ أثناء محاولة إرسال البريد الإلكتروني.",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  if (brandLoading || orderLoading) {
    return <div className="p-8 text-center">جاري تحميل تفاصيل الطلب والبراند...</div>;
  }

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-2">{slug || "Pura"}</h2>
        <p className="text-gray-500">Brand not found or unavailable.</p>
      </div>
    );
  }

  if (error || !order) {
    return <div className="p-8 text-center text-red-500">حدث خطأ أثناء جلب تفاصيل الطلب.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6 bg-white rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">تفاصيل الطلب #{order.order_number || order.id.slice(0,8)}</h1>
          <p className="text-sm text-gray-500">تاريخ الطلب: {new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
        </div>
        
        <Button 
          onClick={handleResendEmail} 
          disabled={emailLoading}
          variant={emailSuccess ? "outline" : "default"}
          className="flex items-center gap-2"
        >
          {emailLoading ? (
            <span className="animate-spin">⏳</span>
          ) : emailSuccess === true ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : emailSuccess === false ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {emailSuccess ? "تم الإرسال" : "إعادة إرسال بريد التأكيد"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">المنتجات</h2>
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium text-gray-800">{item.product?.name_ar || item.product?.name || 'منتج عباية'}</p>
                <p className="text-sm text-gray-500">الكمية: {item.quantity} × {item.unit_price} د.ب</p>
              </div>
              <p className="font-bold">{item.quantity * item.unit_price} د.ب</p>
            </div>
          ))}
          <div className="text-left pt-4 border-t">
            <p className="text-gray-600">المجموع الكلي:</p>
            <p className="text-2xl font-bold text-primary">{order.total_amount} د.ب</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h2 className="text-lg font-semibold border-b pb-2">بيانات العميل</h2>
          <p><span className="text-gray-500">الاسم:</span> {order.customer?.full_name || 'عميل زائر'}</p>
          <p><span className="text-gray-500">الهاتف:</span> {order.customer?.phone || 'غير مسجل'}</p>
          <p><span className="text-gray-500">البريد:</span> {order.customer?.email || 'لا يوجد بريد'}</p>
          <p><span className="text-gray-500">حالة إرسال الإيميل:</span> <span className="font-mono text-sm px-2 py-0.5 bg-gray-200 rounded">{order.confirmation_email_status || 'pending'}</span></p>
        </div>
      </div>
    </div>
  );
}