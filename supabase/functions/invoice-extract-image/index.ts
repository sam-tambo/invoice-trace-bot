import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { image_base64, media_type, company_id } = await req.json();

    if (!image_base64 || !company_id) {
      return new Response(JSON.stringify({ error: "Missing image_base64 or company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify company membership
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: membership } = await serviceClient
      .from("company_memberships")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Anthropic Claude Vision
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: media_type || "image/jpeg",
                  data: image_base64,
                },
              },
              {
                type: "text",
                text: `Analisa esta imagem de uma fatura portuguesa. Extrai os seguintes campos e responde APENAS com JSON válido, sem texto adicional:

{
  "supplier_name": "Nome do fornecedor",
  "supplier_nif": "NIF do fornecedor (9 dígitos)",
  "invoice_number": "Número da fatura",
  "issue_date": "Data de emissão em formato YYYY-MM-DD",
  "due_date": "Data de vencimento em formato YYYY-MM-DD ou null",
  "net_amount": 0.00,
  "vat_amount": 0.00,
  "amount": 0.00,
  "confidence": "high/medium/low",
  "notes": "Notas sobre campos incertos"
}

Se um campo não for legível, coloca null. O campo "amount" é o total com IVA. O campo "confidence" indica a confiança geral da extração.`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await anthropicRes.json();
    const textContent = aiResult.content?.[0]?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Upload image to invoice-scans bucket
    const imageBytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
    const ext = (media_type || "image/jpeg").split("/")[1] || "jpg";
    const filePath = `${company_id}/${Date.now()}.${ext}`;

    await serviceClient.storage.from("invoice-scans").upload(filePath, imageBytes, {
      contentType: media_type || "image/jpeg",
      upsert: false,
    });

    const { data: publicUrl } = serviceClient.storage
      .from("invoice-scans")
      .getPublicUrl(filePath);

    // Insert invoice
    const { data: invoice, error: insertError } = await serviceClient
      .from("invoices")
      .insert({
        company_id,
        created_by: userId,
        supplier_name: extracted.supplier_name || "Desconhecido",
        supplier_nif: extracted.supplier_nif || "",
        invoice_number: extracted.invoice_number || `SCAN-${Date.now()}`,
        issue_date: extracted.issue_date || null,
        due_date: extracted.due_date || null,
        net_amount: extracted.net_amount || null,
        vat_amount: extracted.vat_amount || null,
        amount: extracted.amount || null,
        status: "received",
        source: "scan",
        raw_image_url: publicUrl.publicUrl,
        extraction_confidence: extracted.confidence || "medium",
        extraction_notes: extracted.notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save invoice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ invoice, extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("invoice-extract-image error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
