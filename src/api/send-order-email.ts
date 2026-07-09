import { SMTPClient } from "npm:denomailer@1.6.0";
import { renderOrderEmail } from "../supabase/functions/send-order-email/template.ts";

export async function handler(req: Request) {
  const FROM_ADDRESS = Deno.env.get("ORDER_EMAIL_FROM_ADDRESS") || "orders@boutq.store";
  const SMTP_HOST = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
  const SMTP_PORT = Number(Deno.env.get("ZOHO_SMTP_PORT") || "465");
  const SMTP_USER = Deno.env.get("ZOHO_SMTP_USER") || FROM_ADDRESS;
  const SMTP_PASS = Deno.env.get("ZOHO_SMTP_PASS") || "";

  try {
    const body = await req.json();
    const { order_id, emailData } = body;

    if (!SMTP_PASS) {
      return new Response(JSON.stringify({ error: "ZOHO_SMTP_PASS missing" }), { status: 500 });
    }

    const { subject, html } = renderOrderEmail(emailData);

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    await client.send({
      from: `"${emailData.brand.nameAr || 'Boutq'}" <${FROM_ADDRESS}>`,
      to: emailData.customer.email,
      subject: subject,
      html: html,
    });

    await client.close();
    return new Response(JSON.stringify({ sent: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}