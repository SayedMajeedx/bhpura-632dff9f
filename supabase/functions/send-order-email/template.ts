// ============================================================================
// Bilingual (Arabic + English) order-confirmation email template.
// Pure string templating — table-based layout for maximum email-client compatibility.
// ============================================================================

export type OrderEmailData = {
  brand: {
    nameEn: string | null;
    nameAr: string | null;
    logoUrl: string | null;
    primaryColor: string;
    textColor: string;
    backgroundColor: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  order: {
    invoiceNumber: number;
    createdAt: string;
    currency: string;
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    paymentMethod: string | null;
    paymentStatus: string;
    fulfillmentMethod: string;
    notes: string | null;
  };
  customer: {
    name: string;
    phone: string | null;
    email: string;
  };
  address: {
    label: string | null;
    region: string | null;
    block: string | null;
    road: string | null;
    house: string | null;
    flat: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sku: string | null;
    size: string | null;
    color: string | null;
  }>;
  storefrontUrl: string;
  platformName: string;
};

const REGIONS: Record<string, { en: string; ar: string }> = {
  manama: { en: "Manama", ar: "المنامة" },
  muharraq: { en: "Muharraq", ar: "المحرق" },
  riffa: { en: "Riffa", ar: "الرفاع" },
  hamad_town: { en: "Hamad Town", ar: "مدينة حمد" },
  isa_town: { en: "Isa Town", ar: "مدينة عيسى" },
  hidd: { en: "Hidd", ar: "الحد" },
  budaiya: { en: "Budaiya", ar: "البديع" },
  sanabis: { en: "Sanabis", ar: "السنابس" },
  juffair: { en: "Juffair", ar: "الجفير" },
  seef: { en: "Seef", ar: "السيف" },
  saar: { en: "Saar", ar: "سار" },
  sitra: { en: "Sitra", ar: "سترة" },
  amwaj: { en: "Amwaj Islands", ar: "جزر أمواج" },
  adliya: { en: "Adliya", ar: "العدلية" },
  gudaibiya: { en: "Gudaibiya", ar: "القضيبية" },
  salmaniya: { en: "Salmaniya", ar: "السلمانية" },
  tubli: { en: "Tubli", ar: "توبلي" },
  jidhafs: { en: "Jidhafs", ar: "جدحفص" },
  aali: { en: "A'ali", ar: "عالي" },
  zallaq: { en: "Zallaq", ar: "الزلاق" },
  durrat: { en: "Durrat Al Bahrain", ar: "درة البحرين" },
  askar: { en: "Askar", ar: "عسكر" },
  jasra: { en: "Jasra", ar: "الجسرة" },
  diyar: { en: "Diyar Al Muharraq", ar: "ديار المحرق" },
  busaiteen: { en: "Busaiteen", ar: "البسيتين" },
  galali: { en: "Galali", ar: "قلالي" },
  arad: { en: "Arad", ar: "عراد" },
  malikiya: { en: "Malikiya", ar: "المالكية" },
  karzakan: { en: "Karzakan", ar: "كرزكان" },
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function money(n: number, currency: string, locale: "ar" | "en"): string {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-BH" : "en-BH", {
      style: "currency",
      currency: currency || "BHD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(n);
  } catch {
    return `${n.toFixed(3)} ${currency}`;
  }
}

function regionLabel(region: string | null, lang: "ar" | "en"): string {
  if (!region) return "";
  const r = REGIONS[region];
  if (!r) return region;
  return lang === "ar" ? r.ar : r.en;
}

function formatAddress(addr: OrderEmailData["address"], lang: "ar" | "en"): string {
  if (!addr) return "";
  const region = regionLabel(addr.region, lang);
  const parts = lang === "ar"
    ? [region, addr.block ? `مجمع ${addr.block}` : "", addr.road ? `طريق ${addr.road}` : "",
       addr.house ? `منزل ${addr.house}` : "", addr.flat ? `شقة ${addr.flat}` : ""]
    : [addr.flat ? `Flat ${addr.flat}` : "", addr.house ? `House ${addr.house}` : "",
       addr.road ? `Road ${addr.road}` : "", addr.block ? `Block ${addr.block}` : "", region];
  return parts.filter(Boolean).join(lang === "ar" ? "، " : ", ");
}

const PAYMENT_LABEL: Record<string, { en: string; ar: string }> = {
  cod: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
  card: { en: "Card payment", ar: "الدفع بالبطاقة" },
  benefit: { en: "Benefit Pay", ar: "بنفت باي" },
};

const FULFILLMENT_LABEL: Record<string, { en: string; ar: string }> = {
  delivery: { en: "Delivery", ar: "توصيل" },
  pickup: { en: "Pickup from branch", ar: "استلام من الفرع" },
};

function itemsTable(data: OrderEmailData, lang: "ar" | "en", accent: string, textColor: string): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";
  const rows = data.items
    .map((it) => {
      const meta = [it.size, it.color, it.sku].filter(Boolean).join(" · ");
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:${align};color:${textColor};font-size:14px;">
            ${esc(it.description)}${meta ? `<div style="font-size:12px;color:#888;margin-top:2px;">${esc(meta)}</div>` : ""}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;color:${textColor};font-size:14px;">${it.quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:${align};color:${textColor};font-size:14px;">${esc(money(it.unitPrice, data.order.currency, lang))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:${align};color:${textColor};font-size:14px;font-weight:600;">${esc(money(it.lineTotal, data.order.currency, lang))}</td>
        </tr>`;
    })
    .join("");

  const th = (label: string) =>
    `<th style="padding:8px;text-align:${align};font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid ${accent};">${label}</th>`;

  return `
    <table dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr>
          ${th(lang === "ar" ? "المنتج" : "Item")}
          ${th(lang === "ar" ? "الكمية" : "Qty")}
          ${th(lang === "ar" ? "السعر" : "Price")}
          ${th(lang === "ar" ? "الإجمالي" : "Total")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function summaryRows(data: OrderEmailData, lang: "ar" | "en", textColor: string): string {
  const c = data.order.currency;
  const line = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:4px 8px;color:${bold ? textColor : "#888"};font-size:${bold ? "16px" : "13px"};font-weight:${bold ? 700 : 400};">${label}</td>
      <td style="padding:4px 8px;text-align:${lang === "ar" ? "left" : "right"};color:${bold ? textColor : "#888"};font-size:${bold ? "16px" : "13px"};font-weight:${bold ? 700 : 400};">${value}</td>
    </tr>`;
  let rows = line(lang === "ar" ? "المجموع الفرعي" : "Subtotal", money(data.order.subtotal, c, lang));
  if (data.order.discount > 0) {
    rows += line(lang === "ar" ? "الخصم" : "Discount", `-${money(data.order.discount, c, lang)}`);
  }
  rows += line(lang === "ar" ? "الشحن" : "Shipping", data.order.shipping > 0 ? money(data.order.shipping, c, lang) : (lang === "ar" ? "مجاني" : "Free"));
  rows += line(lang === "ar" ? "الإجمالي المدفوع" : "Total Paid", money(data.order.total, c, lang), true);
  return `<table dir="${lang === "ar" ? "rtl" : "ltr"}" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${rows}</table>`;
}

function languageBlock(data: OrderEmailData, lang: "ar" | "en"): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";
  const accent = data.brand.primaryColor;
  const textColor = data.brand.textColor;
  const brandName = lang === "ar"
    ? (data.brand.nameAr || data.brand.nameEn || "")
    : (data.brand.nameEn || data.brand.nameAr || "");
  const fulfillment = FULFILLMENT_LABEL[data.order.fulfillmentMethod] || { en: data.order.fulfillmentMethod, ar: data.order.fulfillmentMethod };
  const payment = data.order.paymentMethod ? (PAYMENT_LABEL[data.order.paymentMethod] || { en: data.order.paymentMethod, ar: data.order.paymentMethod }) : null;
  const orderDate = new Date(data.order.createdAt);
  const dateStr = orderDate.toLocaleDateString(lang === "ar" ? "ar-BH" : "en-BH", { year: "numeric", month: "long", day: "numeric" });

  const greeting = lang === "ar"
    ? `شكراً لك، ${esc(data.customer.name)}! تم استلام طلبك بنجاح.`
    : `Thank you, ${esc(data.customer.name)}! Your order has been received.`;

  const addressBlock = data.address
    ? `
      <div style="margin-top:14px;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.03em;">${lang === "ar" ? "عنوان التوصيل" : "Delivery Address"}</div>
        <div style="font-size:14px;color:${textColor};margin-top:4px;">${esc(formatAddress(data.address, lang))}</div>
      </div>`
    : `
      <div style="margin-top:14px;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.03em;">${lang === "ar" ? "طريقة الاستلام" : "Fulfillment"}</div>
        <div style="font-size:14px;color:${textColor};margin-top:4px;">${esc(lang === "ar" ? fulfillment.ar : fulfillment.en)}</div>
      </div>`;

  return `
  <div dir="${dir}" style="text-align:${align};padding:28px 26px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;">
          ${data.brand.logoUrl ? `<img src="${esc(data.brand.logoUrl)}" alt="${esc(brandName)}" height="44" style="height:44px;max-width:160px;object-fit:contain;display:block;${lang === "ar" ? "margin-right:auto;margin-left:0" : "margin-left:auto;margin-right:0"};" />` : `<span style="font-size:20px;font-weight:700;color:${accent};">${esc(brandName)}</span>`}
        </td>
      </tr>
    </table>

    <h1 style="font-size:20px;color:${textColor};margin:20px 0 6px;">${greeting}</h1>
    <p style="font-size:13px;color:#888;margin:0 0 18px;">
      ${lang === "ar" ? `طلب رقم` : "Order"} <strong style="color:${textColor};">#${data.order.invoiceNumber}</strong>
      &nbsp;•&nbsp; ${esc(dateStr)}
    </p>

    ${itemsTable(data, lang, accent, textColor)}
    ${summaryRows(data, lang, textColor)}
    ${addressBlock}

    ${payment ? `
    <div style="margin-top:14px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.03em;">${lang === "ar" ? "طريقة الدفع" : "Payment Method"}</div>
      <div style="font-size:14px;color:${textColor};margin-top:4px;">${esc(lang === "ar" ? payment.ar : payment.en)}</div>
    </div>` : ""}

    ${data.order.notes ? `
    <div style="margin-top:14px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.03em;">${lang === "ar" ? "ملاحظات" : "Notes"}</div>
      <div style="font-size:14px;color:${textColor};margin-top:4px;">${esc(data.order.notes)}</div>
    </div>` : ""}

    <div style="margin-top:24px;">
      <a href="${esc(data.storefrontUrl)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600;">
        ${lang === "ar" ? "متابعة التسوق" : "Continue Shopping"}
      </a>
    </div>
  </div>`;
}

export function renderOrderEmail(data: OrderEmailData): { subject: string; html: string } {
  const brandNameAr = data.brand.nameAr || data.brand.nameEn || "";
  const brandNameEn = data.brand.nameEn || data.brand.nameAr || "";
  const subject = `${brandNameAr} — تم تأكيد طلبك #${data.order.invoiceNumber}  |  Order Confirmed #${data.order.invoiceNumber} — ${brandNameEn}`;

  const bg = data.brand.backgroundColor || "#ffffff";
  const accent = data.brand.primaryColor || "#8b6f47";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ef;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${bg};border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
          <tr>
            <td style="height:6px;background:${accent};line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td>${languageBlock(data, "ar")}</td>
          </tr>
          <tr>
            <td style="padding:0 26px;"><div style="border-top:1px dashed #ddd;"></div></td>
          </tr>
          <tr>
            <td>${languageBlock(data, "en")}</td>
          </tr>
          <tr>
            <td style="padding:18px 26px;background:#faf9f7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#999;">
                ${esc(brandNameAr)} / ${esc(brandNameEn)}
                ${data.brand.contactEmail ? ` &nbsp;•&nbsp; ${esc(data.brand.contactEmail)}` : ""}
                ${data.brand.contactPhone ? ` &nbsp;•&nbsp; ${esc(data.brand.contactPhone)}` : ""}
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#bbb;">Powered by ${esc(data.platformName)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}