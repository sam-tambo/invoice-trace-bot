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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY or RESEND_FROM_EMAIL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id, invoice_ids } = await req.json();

    // Verify user is a member of the requested company
    // db already created above for membership check
    const { data: membership } = await db
      .from("company_memberships")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, supabaseServiceKey);

    // Get default template
    const { data: templates } = await db
      .from("message_templates")
      .select("*")
      .eq("company_id", company_id)
      .eq("is_default", true)
      .limit(1);

    const template = templates?.[0];

    // Get invoices to contact
    let query = db
      .from("invoices")
      .select("*, suppliers!invoices_supplier_id_fkey(email, name, nif)")
      .eq("company_id", company_id)
      .eq("status", "missing");

    if (invoice_ids?.length) {
      query = query.in("id", invoice_ids);
    }

    const { data: invoices, error: invError } = await query;
    if (invError) {
      console.error("Error fetching invoices:", invError);
      return new Response(JSON.stringify({ error: invError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { invoice_id: string; status: string; error?: string }[] = [];
    let sent = 0;
    let skipped = 0;

    for (const inv of invoices || []) {
      const supplier = inv.suppliers as any;
      const supplierEmail = supplier?.email;

      if (!supplierEmail) {
        skipped++;
        results.push({ invoice_id: inv.id, status: "skipped", error: "No supplier email" });
        continue;
      }

      // Build email content
      const subject = template
        ? template.subject
            .replace(/{{invoice_number}}/g, inv.invoice_number)
            .replace(/{{supplier_name}}/g, inv.supplier_name || supplier?.name || "")
            .replace(/{{amount}}/g, inv.amount ? `€${Number(inv.amount).toFixed(2)}` : "")
        : `Pedido de Fatura ${inv.invoice_number}`;

      const body = template
        ? template.body
            .replace(/{{invoice_number}}/g, inv.invoice_number)
            .replace(/{{supplier_name}}/g, inv.supplier_name || supplier?.name || "")
            .replace(/{{amount}}/g, inv.amount ? `€${Number(inv.amount).toFixed(2)}` : "")
        : `Estimado fornecedor,\n\nVimos solicitar o envio da fatura nº ${inv.invoice_number}.\n\nPor favor envie a fatura em resposta a este email.\n\nCom os melhores cumprimentos.`;

      try {
        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [supplierEmail],
            reply_to: fromEmail,
            subject,
            text: body,
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          throw new Error(`Resend error ${resendRes.status}: ${errBody}`);
        }

        // Update invoice status
        await db
          .from("invoices")
          .update({ status: "contacted", last_contact_at: new Date().toISOString() })
          .eq("id", inv.id);

        // Log outreach
        await db.from("outreach_logs").insert({
          company_id,
          invoice_id: inv.id,
          recipient: supplierEmail,
          subject,
          body,
          channel: "email",
          status: "sent",
          template_id: template?.id || null,
        });

        // Save to inbox_messages
        await db.from("inbox_messages").insert({
          company_id,
          invoice_id: inv.id,
          supplier_nif: inv.supplier_nif,
          direction: "outbound",
          from_email: fromEmail,
          to_email: supplierEmail,
          subject,
          body_text: body,
          status: "processed",
        });

        sent++;
        results.push({ invoice_id: inv.id, status: "sent" });
      } catch (err) {
        console.error(`Error sending to ${supplierEmail}:`, err);
        results.push({ invoice_id: inv.id, status: "error", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped, total: invoices?.length || 0, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-bulk-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
