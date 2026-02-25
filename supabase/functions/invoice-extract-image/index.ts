import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `Analisa esta imagem de uma fatura portuguesa. Extrai os seguintes campos e responde APENAS com JSON válido, sem texto adicional:

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

Se um campo não for legível, coloca null. O campo "amount" é o total com IVA. O campo "confidence" indica a confiança geral da extração.`;

async function tryAnthropic(image_base64: string, media_type: string): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type, data: image_base64 } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("Anthropic error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    console.error("Anthropic exception:", e);
    return null;
  }
}

async function tryLovableAI(image_base64: string, media_type: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${media_type};base64,${image_base64}` } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("Lovable AI error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Lovable AI exception:", e);
    return null;
  }
}

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

    const mType = media_type || "image/jpeg";

    // Cascade: Anthropic → Lovable AI (Gemini)
    console.log("Trying Anthropic...");
    let textContent = await tryAnthropic(image_base64, mType);
    let provider = "anthropic";

    if (!textContent) {
      console.log("Anthropic failed, trying Lovable AI...");
      textContent = await tryLovableAI(image_base64, mType);
      provider = "lovable-ai";
    }

    if (!textContent) {
      return new Response(JSON.stringify({ error: "All AI providers failed. Please try again later." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extraction succeeded via:", provider);

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse AI response:", textContent);
      return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Upload image to invoice-scans bucket
    const imageBytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
    const ext = mType.split("/")[1] || "jpg";
    const filePath = `${company_id}/${Date.now()}.${ext}`;

    await serviceClient.storage.from("invoice-scans").upload(filePath, imageBytes, {
      contentType: mType,
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

    return new Response(JSON.stringify({ invoice, extracted, provider }), {
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
