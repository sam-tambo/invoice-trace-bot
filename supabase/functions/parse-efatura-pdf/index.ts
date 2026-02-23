import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = base64Encode(new Uint8Array(arrayBuffer));

    const systemPrompt = `You are a data extraction assistant. You will receive a PDF of a "Mapa de conferência e-Fatura" from TOConline.
Extract ALL invoice rows from the table. The table has these columns:
- Número do documento do fornecedor (supplier NIF)
- Data (date in DD/MM/YYYY format)
- Doc. Compra (invoice number/reference)
- Valor líquido (net amount, Portuguese format with comma as decimal separator)
- IVA (VAT amount, Portuguese format)
- Total do documento e-fatura (total amount, Portuguese format)

IMPORTANT: 
- Some rows may have an empty NIF if it's a continuation from the previous supplier (same NIF). In that case, use the NIF from the previous row.
- Convert amounts from Portuguese format (1.107,90) to standard numbers (1107.90).
- Convert dates from DD/MM/YYYY to YYYY-MM-DD format.
- Extract ALL rows across ALL pages.

Return ONLY a valid JSON object with this exact structure, no markdown, no code blocks:
{"invoices": [{"supplier_nif": "...", "issue_date": "YYYY-MM-DD", "invoice_number": "...", "net_amount": 0.00, "vat_amount": 0.00, "amount": 0.00}]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: "Extract all invoice rows from this PDF. Return only the JSON object.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === "text")?.text;

    if (!textContent) {
      return new Response(JSON.stringify({ error: "AI did not return text" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = textContent.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const invoices = parsed.invoices;

    return new Response(JSON.stringify({ success: true, invoices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-efatura-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
