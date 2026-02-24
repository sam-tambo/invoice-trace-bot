import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Firecrawl connector not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { nif, company_id } = await req.json();
    if (!nif || !company_id) {
      return new Response(JSON.stringify({ error: "nif and company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Looking up NIF: ${nif}`);

    // Strategy: run 3 lookups in parallel for maximum hit rate
    const [raciusResult, einformaResult, googleResult] = await Promise.allSettled([
      // 1. Direct Racius scrape
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.racius.com/observatorio/${nif}/`,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Racius ${r.status}`);
        return r.json();
      }),

      // 2. Direct Einforma scrape
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.einforma.pt/servlet/app/portal/ENTP/screen/SProducto/prod/ETIQUETA_EMPRESA/nif/${nif}`,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Einforma ${r.status}`);
        return r.json();
      }),

      // 3. Google search targeting racius + einforma + general
      fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `"${nif}" site:racius.com OR site:einforma.pt OR site:portugalia.com OR site:informadb.pt`,
          limit: 5,
          lang: "pt",
          country: "PT",
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Search ${r.status}`);
        return r.json();
      }),
    ]);

    // Build context from all sources
    const contextParts: string[] = [];

    if (raciusResult.status === "fulfilled" && raciusResult.value?.data?.markdown) {
      contextParts.push(`Racius page:\n${raciusResult.value.data.markdown.substring(0, 3000)}`);
      console.log("Racius: OK");
    } else {
      console.log("Racius: failed", raciusResult.status === "rejected" ? raciusResult.reason : "no data");
    }

    if (einformaResult.status === "fulfilled" && einformaResult.value?.data?.markdown) {
      contextParts.push(`Einforma page:\n${einformaResult.value.data.markdown.substring(0, 3000)}`);
      console.log("Einforma: OK");
    } else {
      console.log("Einforma: failed", einformaResult.status === "rejected" ? einformaResult.reason : "no data");
    }

    if (googleResult.status === "fulfilled" && googleResult.value?.data?.length) {
      const searchText = googleResult.value.data
        .map((r: any) => `${r.title}: ${r.description}\n${r.markdown?.substring(0, 500) || ""}`)
        .join("\n\n");
      contextParts.push(`Google results:\n${searchText}`);
      console.log(`Google: ${googleResult.value.data.length} results`);
    } else {
      console.log("Google: failed", googleResult.status === "rejected" ? googleResult.reason : "no data");
    }

    const context = contextParts.join("\n\n---\n\n");

    if (!context.trim()) {
      return new Response(JSON.stringify({ success: false, error: "No data found for this NIF" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract structured supplier info
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:
          "Extract company information from the provided web data for a Portuguese company. Return ONLY a valid JSON object with these fields: legal_name (official registered name), name (trading/common name), address, email, phone, confidence_score (0-100). If you find partial data, still return what you can. No markdown, no code blocks.",
        messages: [
          {
            role: "user",
            content: `Extract company info for Portuguese NIF ${nif} from this data:\n\n${context}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.content?.find((c: any) => c.type === "text")?.text;
    if (!textContent) {
      return new Response(JSON.stringify({ success: false, error: "Could not extract company data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonStr = textContent.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const companyInfo = JSON.parse(jsonStr);

    // Upsert supplier in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: existing } = await supabase
      .from("suppliers")
      .select("id")
      .eq("nif", nif)
      .eq("company_id", company_id)
      .maybeSingle();

    const supplierData = {
      nif,
      company_id,
      name: companyInfo.name || companyInfo.legal_name || "",
      legal_name: companyInfo.legal_name || null,
      address: companyInfo.address || null,
      email: companyInfo.email || null,
      phone: companyInfo.phone || null,
      confidence_score: companyInfo.confidence_score || 0,
      cached_data: companyInfo,
      cached_at: new Date().toISOString(),
    };

    let supplier;
    if (existing) {
      const { data, error } = await supabase
        .from("suppliers")
        .update(supplierData)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      supplier = data;
    } else {
      const { data, error } = await supabase
        .from("suppliers")
        .insert(supplierData)
        .select()
        .single();
      if (error) throw error;
      supplier = data;
    }

    return new Response(JSON.stringify({ success: true, supplier }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nif-lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
