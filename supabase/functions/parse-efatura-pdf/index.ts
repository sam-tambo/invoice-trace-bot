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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
- Extract ALL rows across ALL pages.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: file.name,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all invoice rows from this PDF. Return the data using the extract_invoices tool.",
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_invoices",
                description: "Extract structured invoice data from the PDF",
                parameters: {
                  type: "object",
                  properties: {
                    invoices: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          supplier_nif: { type: "string", description: "9-digit NIF" },
                          issue_date: { type: "string", description: "Date in YYYY-MM-DD format" },
                          invoice_number: { type: "string", description: "Doc. Compra reference" },
                          net_amount: { type: "number", description: "Valor líquido as number" },
                          vat_amount: { type: "number", description: "IVA as number" },
                          amount: { type: "number", description: "Total as number" },
                        },
                        required: ["supplier_nif", "issue_date", "invoice_number", "net_amount", "vat_amount", "amount"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["invoices"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_invoices" } },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Failed to parse PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoices = JSON.parse(toolCall.function.arguments).invoices;

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
