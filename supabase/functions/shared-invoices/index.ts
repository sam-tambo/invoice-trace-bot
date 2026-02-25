import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return new Response(JSON.stringify({ error: "Token e password são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find the shared link
    const { data: link, error: linkErr } = await supabase
      .from("shared_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link expirado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify password using pgcrypto crypt
    const { data: pwCheck } = await supabase.rpc("verify_shared_link_password", {
      p_link_id: link.id,
      p_password: password,
    });

    if (!pwCheck) {
      return new Response(JSON.stringify({ error: "Password incorreta" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company name
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", link.company_id)
      .single();

    // Fetch invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, supplier_name, supplier_nif, amount, net_amount, vat_amount, status, issue_date, due_date, created_at")
      .eq("company_id", link.company_id)
      .order("created_at", { ascending: false });

    // Fetch attachments for these invoices
    const invoiceIds = (invoices || []).map((i: any) => i.id);
    let attachments: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: atts } = await supabase
        .from("attachments")
        .select("id, invoice_id, file_name, file_path, file_type, file_size")
        .in("invoice_id", invoiceIds);
      attachments = atts || [];
    }

    // Build public URLs for attachments
    const attachmentsWithUrls = attachments.map((att: any) => {
      const { data: urlData } = supabase.storage
        .from("invoice-files")
        .getPublicUrl(att.file_path);
      return { ...att, public_url: urlData?.publicUrl };
    });

    return new Response(
      JSON.stringify({
        company_name: company?.name || "",
        label: link.label,
        invoices: invoices || [],
        attachments: attachmentsWithUrls,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("shared-invoices error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
