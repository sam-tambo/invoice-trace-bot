import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NifRecord {
  nif: number;
  title: string;
  alias?: string;
  address?: string;
  pc4?: string;
  pc3?: string;
  city?: string;
  activity?: string;
  status?: string;
  cae?: string;
  contacts?: {
    email?: string;
    phone?: string;
    website?: string;
    fax?: string;
  };
  structure?: {
    nature?: string;
    capital?: string;
    capital_currency?: string;
  };
  geo?: {
    region?: string;
    county?: string;
    parish?: string;
  };
  racius?: string;
  portugalio?: string;
}

async function lookupNif(nif: string, apiKey: string): Promise<NifRecord | null> {
  const url = `https://www.nif.pt/?json=1&q=${nif}&key=${apiKey}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    throw new Error(`NIF.pt API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.result !== "success" || !data.nif_validation) {
    return null;
  }

  return data.records?.[nif] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NIF_PT_API_KEY = Deno.env.get("NIF_PT_API_KEY");
    if (!NIF_PT_API_KEY) {
      return new Response(
        JSON.stringify({ error: "NIF_PT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { nif, company_id, invoice_id } = await req.json();
    if (!nif || !company_id) {
      return new Response(
        JSON.stringify({ error: "nif and company_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean NIF
    const cleanNif = nif.replace(/[^0-9]/g, "").replace(/^351/, "");
    console.log(`Looking up NIF: ${cleanNif} via NIF.pt`);

    const record = await lookupNif(cleanNif, NIF_PT_API_KEY);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!record) {
      // Save minimal record so we don't re-query
      const { data: existing } = await supabase
        .from("suppliers")
        .select("id")
        .eq("nif", cleanNif)
        .eq("company_id", company_id)
        .maybeSingle();

      const minData = {
        nif: cleanNif,
        company_id,
        name: "",
        lookup_success: false,
        last_lookup_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("suppliers").update(minData).eq("id", existing.id);
      } else {
        await supabase.from("suppliers").insert(minData);
      }

      return new Response(
        JSON.stringify({ success: false, message: "NIF não encontrado na base de dados NIF.pt" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postalCode = record.pc4 && record.pc3 ? `${record.pc4}-${record.pc3}` : null;

    const supplierData = {
      nif: cleanNif,
      company_id,
      name: record.title || "",
      legal_name: record.title || null,
      alias: record.alias || null,
      address: record.address || null,
      city: record.city || null,
      postal_code: postalCode,
      region: record.geo?.region || null,
      county: record.geo?.county || null,
      email: record.contacts?.email || null,
      phone: record.contacts?.phone || null,
      website: record.contacts?.website || null,
      fax: record.contacts?.fax || null,
      status: record.status || null,
      cae: record.cae || null,
      legal_nature: record.structure?.nature || null,
      share_capital: record.structure?.capital ? parseFloat(record.structure.capital) : null,
      share_capital_currency: record.structure?.capital_currency || "EUR",
      activity_description: record.activity || null,
      nif_pt_url: record.racius || record.portugalio || null,
      lookup_success: true,
      last_lookup_at: new Date().toISOString(),
      confidence_score: 100,
      cached_data: record,
      cached_at: new Date().toISOString(),
    };

    // Upsert
    const { data: existing } = await supabase
      .from("suppliers")
      .select("id")
      .eq("nif", cleanNif)
      .eq("company_id", company_id)
      .maybeSingle();

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

    // Link supplier to invoice if provided
    if (invoice_id && supplier) {
      await supabase
        .from("invoices")
        .update({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_nif: cleanNif,
        })
        .eq("id", invoice_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        supplier,
        has_email: !!record.contacts?.email,
        has_phone: !!record.contacts?.phone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("nif-lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
