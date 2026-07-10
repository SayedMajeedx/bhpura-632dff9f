import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  // data URL: data:<mime>;base64,<...>
  dataUrl: z.string().min(32).max(15_000_000),
  mimeType: z.string().min(3).max(100),
  targetLang: z.enum(["ar", "en"]).default("ar"),
});

export type ScannedExpense = {
  category: string;
  description: string;
  supplier: string;
  amount: number;
  currency: string;
  expense_date: string; // YYYY-MM-DD
  notes: string;
};

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }): Promise<ScannedExpense> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const langName = data.targetLang === "ar" ? "Arabic" : "English";
    const today = new Date().toISOString().slice(0, 10);

    const isPdf = data.mimeType === "application/pdf";
    const userContent: unknown[] = [
      {
        type: "text",
        text:
          `You are an expert bookkeeping OCR. Extract the expense from this receipt/invoice image and return STRICT JSON ONLY matching this schema:\n` +
          `{"category": string, "description": string, "supplier": string, "amount": number, "currency": string, "expense_date": "YYYY-MM-DD", "notes": string}\n\n` +
          `FIELD RULES (be strict):\n` +
          `- amount: the FINAL TOTAL PAID (look for "Total", "Grand Total", "Amount Due", "Total Paid", "Balance Due", "الإجمالي", "المجموع الكلي", "المبلغ المستحق"). Number only, no currency symbol. Prefer the largest bottom-most total line. If multiple candidates, pick the one after tax/VAT (grand total). Use 0 only if truly unreadable.\n` +
          `- expense_date: strict YYYY-MM-DD (e.g. 2026-07-08). Parse any date format on the invoice (DD/MM/YYYY, MMM D YYYY, etc.). If missing use "${today}".\n` +
          `- supplier: the vendor / company / store name issuing the invoice (e.g. "EcoPack Solutions Ltd"). Keep proper nouns readable.\n` +
          `- description: ONE short optimized ${langName} summary of what was purchased (e.g. "أكياس شحن وتغليف مخصصة مع شرائط حريرية"). Translate item names into ${langName}. Do NOT include the price, the vendor, or the date here.\n` +
          `- category: one short ${langName} label from: Shipping, Packaging, Marketing, Utilities, Software, Meals, Travel, Office, Inventory, Rent, Salaries, Fees, Other (translated).\n` +
          `- currency: 3-letter ISO code (BHD, USD, SAR, AED, KWD, QAR, OMR). If unclear default "BHD".\n` +
          `- notes: invoice number, VAT number, or other useful context in ${langName}; else empty string.\n\n` +
          `FALLBACK: if you cannot find a clearly-labeled total, take the largest monetary value that appears after any tax/VAT line.\n` +
          `Return ONLY the JSON object. No markdown fences, no commentary, no prose.`,
      },
      isPdf
        ? { type: "file", file: { filename: "receipt.pdf", file_data: data.dataUrl } }
        : { type: "image_url", image_url: { url: data.dataUrl } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract structured expense data from receipts. Return strict JSON only." },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (res.status === 429) throw new Error("RATE_LIMITED");
    if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";
    // strip accidental code fences
    raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: Partial<ScannedExpense> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // best-effort: try to find a JSON object in the text
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
      }
    }

    const amountNum = Number(parsed.amount);
    return {
      category: String(parsed.category ?? "").trim() || (data.targetLang === "ar" ? "أخرى" : "Other"),
      description: String(parsed.description ?? "").trim(),
      supplier: String(parsed.supplier ?? "").trim(),
      amount: Number.isFinite(amountNum) ? amountNum : 0,
      currency: String(parsed.currency ?? "BHD").trim().toUpperCase().slice(0, 3) || "BHD",
      expense_date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.expense_date))
        ? String(parsed.expense_date)
        : today,
      notes: String(parsed.notes ?? "").trim(),
    };
  });
