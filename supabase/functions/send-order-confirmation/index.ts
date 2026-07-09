import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type Lang = "en" | "ar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const htmlEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const encodeHeader = (value: string) => `=?UTF-8?B?${base64Utf8(cleanHeader(value))}?=`;

function money(amount: unknown, currency: string, lang: Lang) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-BH" : "en-BH", {
      style: "currency",
      currency: currency || "BHD",
    }).format(value);
  } catch {
    return `${value.toFixed(3)} ${currency || "BHD"}`;
  }
}

function dateLabel(value: unknown, lang: Lang) {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-BH" : "en-BH", {
      dateStyle: "medium",
    }).format(new Date(String(value)));
  } catch {
    return String(value ?? "");
  }
}

function paymentLabel(value: unknown, lang: Lang) {
  const labels: Record<string, { en: string; ar: string }> = {
    cod: { en: "Cash on delivery", ar: "????? ??? ????????" },
    cash: { en: "Cash", ar: "?????" },
    card: { en: "Card payment", ar: "????? ????????" },
    benefit: { en: "Benefit Pay", ar: "????" },
    bank_transfer: { en: "Bank transfer", ar: "????? ????" },
    apple_pay: { en: "Apple Pay", ar: "Apple Pay" },
    google_pay: { en: "Google Pay", ar: "Google Pay" },
  };
  return labels[String(value ?? "")]?.[lang] ?? String(value ?? "");
}

function fulfillmentLabel(value: unknown, lang: Lang) {
  const labels: Record<string, { en: string; ar: string }> = {
    delivery: { en: "Delivery", ar: "?????" },
    pickup: { en: "Pickup from branch", ar: "?????? ?? ?????" },
  };
  return labels[String(value ?? "")]?.[lang] ?? String(value ?? "");
}

function buildMessage(order: any, settings: any, items: any[], lang: Lang, invoiceUrl: string) {
  const isAr = lang === "ar";
  const businessName = settings?.business_name || "Boutq";
  const customerName = order?.customers?.name || (isAr ? "?????? ??????" : "there");
  const subject = isAr
    ? `????? ???? #${order.invoice_number} ?? ${businessName}`
    : `Your order #${order.invoice_number} confirmation from ${businessName}`;

  const labels = isAr
    ? {
        greeting: `?????? ${customerName}?`,
        intro: "????? ?????. ?? ?????? ???? ????? ???? ???????:",
        invoice: "??? ????????",
        date: "???????",
        payment: "????? ?????",
        fulfillment: "????? ????????",
        subtotal: "??????? ??????",
        shipping: "???????",
        total: "????????",
        item: "??????",
        qty: "??????",
        amount: "??????",
        viewInvoice: "??? ????????",
        outro: "????? ???????? ??? ?????? ?????? ????????.",
      }
    : {
        greeting: `Hi ${customerName},`,
        intro: "Thank you for your order. We received it successfully:",
        invoice: "Invoice",
        date: "Date",
        payment: "Payment method",
        fulfillment: "Fulfillment",
        subtotal: "Subtotal",
        shipping: "Shipping",
        total: "Total",
        item: "Item",
        qty: "Qty",
        amount: "Amount",
        viewInvoice: "View invoice",
        outro: "We will contact you shortly to confirm the details.",
      };

  const itemRows = items
    .map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${htmlEscape(item.description)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${htmlEscape(item.quantity)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:end">${htmlEscape(money(item.line_total, order.currency, lang))}</td></tr>`)
    .join("");

  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";
  const html = `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <body style="margin:0;background:#f7f7f7;font-family:Arial,Tahoma,sans-serif;color:#222">
    <div style="max-width:640px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:12px;padding:24px;text-align:${align}">
        ${settings?.logo_url ? `<img src="${htmlEscape(settings.logo_url)}" alt="${htmlEscape(businessName)}" style="max-height:72px;max-width:180px;margin-bottom:18px" />` : ""}
        <h1 style="margin:0 0 12px;font-size:24px">${htmlEscape(labels.greeting)}</h1>
        <p style="margin:0 0 20px;line-height:1.7">${htmlEscape(labels.intro)}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.invoice)}</td><td style="padding:6px;text-align:end">#${htmlEscape(order.invoice_number)}</td></tr>
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.date)}</td><td style="padding:6px;text-align:end">${htmlEscape(dateLabel(order.order_date, lang))}</td></tr>
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.payment)}</td><td style="padding:6px;text-align:end">${htmlEscape(paymentLabel(order.payment_method, lang))}</td></tr>
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.fulfillment)}</td><td style="padding:6px;text-align:end">${htmlEscape(fulfillmentLabel(order.fulfillment_method, lang))}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr><th style="padding:8px;border-bottom:2px solid #ddd;text-align:${align}">${htmlEscape(labels.item)}</th><th style="padding:8px;border-bottom:2px solid #ddd;text-align:center">${htmlEscape(labels.qty)}</th><th style="padding:8px;border-bottom:2px solid #ddd;text-align:end">${htmlEscape(labels.amount)}</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.subtotal)}</td><td style="padding:6px;text-align:end">${htmlEscape(money(order.subtotal, order.currency, lang))}</td></tr>
          <tr><td style="padding:6px;color:#666">${htmlEscape(labels.shipping)}</td><td style="padding:6px;text-align:end">${htmlEscape(money(order.shipping, order.currency, lang))}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;border-top:1px solid #ddd">${htmlEscape(labels.total)}</td><td style="padding:8px;text-align:end;font-weight:bold;border-top:1px solid #ddd">${htmlEscape(money(order.total, order.currency, lang))}</td></tr>
        </table>
        <p style="margin:0 0 20px;line-height:1.7">${htmlEscape(labels.outro)}</p>
        <a href="${htmlEscape(invoiceUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">${htmlEscape(labels.viewInvoice)}</a>
      </div>
    </div>
  </body>
</html>`;

  const text = isAr
    ? [`?????? ${customerName}?`, "????? ?????. ?? ?????? ???? ?????.", `??? ????????: #${order.invoice_number}`, `???????: ${dateLabel(order.order_date, lang)}`, `????? ?????: ${paymentLabel(order.payment_method, lang)}`, `????????: ${money(order.total, order.currency, lang)}`, `????????: ${invoiceUrl}`].join("\n")
    : [`Hi ${customerName},`, "Thank you for your order. We received it successfully.", `Invoice: #${order.invoice_number}`, `Date: ${dateLabel(order.order_date, lang)}`, `Payment method: ${paymentLabel(order.payment_method, lang)}`, `Total: ${money(order.total, order.currency, lang)}`, `Invoice: ${invoiceUrl}`].join("\n");

  return { subject, html, text };
}

async function assertAdminCanSend(req: Request, supabase: any, orderBrandId: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, status, brand_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.status !== "active") throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const role = String(profile.role ?? "");
  if (role === "super_admin") return;
  if ((role === "admin" || role === "brand_admin") && profile.brand_id === orderBrandId) return;

  throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
}

async function readSmtp(conn: Deno.TlsConn) {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const buffer = new Uint8Array(2048);

  while (true) {
    const n = await conn.read(buffer);
    if (n === null) break;
    chunks.push(decoder.decode(buffer.subarray(0, n)));
    const lines = chunks.join("").split(/\r?\n/).filter(Boolean);
    const last = lines[lines.length - 1] ?? "";
    if (/^\d{3} /.test(last)) return chunks.join("");
  }

  return chunks.join("");
}

async function writeSmtp(conn: Deno.TlsConn, line: string, expected: number[]) {
  await conn.write(new TextEncoder().encode(`${line}\r\n`));
  const response = await readSmtp(conn);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) throw new Error(`SMTP error after ${line.split(" ")[0]}: ${response}`);
  return response;
}

async function sendSmtpMail(options: { to: string; subject: string; html: string; text: string; fromName: string }) {
  const host = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
  const port = Number(Deno.env.get("ZOHO_SMTP_PORT") || "465");
  const user = Deno.env.get("ZOHO_SMTP_USER") || "no-reply@boutq.store";
  const pass = Deno.env.get("ZOHO_SMTP_PASSWORD");

  if (!pass) throw new Error("Missing ZOHO_SMTP_PASSWORD secret");

  const conn = await Deno.connectTls({ hostname: host, port });

  try {
    const greeting = await readSmtp(conn);
    if (!greeting.startsWith("220")) throw new Error(`SMTP greeting failed: ${greeting}`);

    await writeSmtp(conn, "EHLO boutq.store", [250]);
    await writeSmtp(conn, "AUTH LOGIN", [334]);
    await writeSmtp(conn, base64Utf8(user), [334]);
    await writeSmtp(conn, base64Utf8(pass), [235]);
    await writeSmtp(conn, `MAIL FROM:<${user}>`, [250]);
    await writeSmtp(conn, `RCPT TO:<${options.to}>`, [250, 251]);
    await writeSmtp(conn, "DATA", [354]);

    const boundary = `boutq-${crypto.randomUUID()}`;
    const message = [
      `From: ${encodeHeader(options.fromName)} <${user}>`,
      `To: <${options.to}>`,
      `Subject: ${encodeHeader(options.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      options.text,
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      options.html,
      "",
      `--${boundary}--`,
      "",
    ].join("\r\n").replace(/^\./gm, "..");

    await conn.write(new TextEncoder().encode(`${message}\r\n.\r\n`));
    const dataResponse = await readSmtp(conn);
    if (!dataResponse.startsWith("250")) throw new Error(`SMTP DATA failed: ${dataResponse}`);

    await writeSmtp(conn, "QUIT", [221]);
  } finally {
    conn.close();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const orderId = String(body.orderId ?? "");
    const lang: Lang = body.lang === "ar" ? "ar" : "en";

    if (!orderId) throw new Response(JSON.stringify({ error: "Missing orderId" }), { status: 400 });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, customers(*), order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) throw new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });

    if (body.resend) {
      await assertAdminCanSend(req, supabase, order.brand_id);
    } else {
      const requestedEmail = normalizeEmail(body.customerEmail);
      const actualEmail = normalizeEmail(order.customers?.email);
      if (!requestedEmail || requestedEmail !== actualEmail) {
        throw new Response(JSON.stringify({ error: "Email does not match this order" }), { status: 403 });
      }
    }

    const to = normalizeEmail(order.customers?.email);
    if (!to) throw new Response(JSON.stringify({ error: "Order customer has no email" }), { status: 400 });

    const { data: settings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("brand_id", order.brand_id)
      .maybeSingle();

    const siteUrl = String(Deno.env.get("SITE_URL") || req.headers.get("Origin") || "").replace(/\/$/, "");
    const invoiceUrl = siteUrl ? `${siteUrl}/invoice/${order.id}` : `/invoice/${order.id}`;
    const message = buildMessage(order, settings, order.order_items ?? [], lang, invoiceUrl);

    await sendSmtpMail({
      to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      fromName: Deno.env.get("ZOHO_FROM_NAME") || settings?.business_name || "Boutq",
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) {
      return new Response(error.body, {
        status: error.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("send-order-confirmation failed", error);

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Email failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
