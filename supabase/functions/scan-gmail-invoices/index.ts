import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NYLAS_BASE = "https://api.us.nylas.com/v3";

async function searchNylasMessages(apiKey: string, grantId: string, query: string, requireAttachments = false): Promise<any[]> {
  const url = `${NYLAS_BASE}/grants/${grantId}/messages?search_query_native=${encodeURIComponent(query)}${requireAttachments ? '&has_attachments=true' : ''}&limit=15`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    console.error("Nylas search error:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return data.data || [];
}

async function getNylasMessage(apiKey: string, grantId: string, messageId: string): Promise<any> {
  const url = `${NYLAS_BASE}/grants/${grantId}/messages/${messageId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()).data;
}

async function downloadNylasAttachment(apiKey: string, grantId: string, attachmentId: string, messageId: string): Promise<ArrayBuffer | null> {
  const url = `${NYLAS_BASE}/grants/${grantId}/attachments/${attachmentId}/download?message_id=${messageId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error("Nylas download error:", res.status, await res.text());
    return null;
  }
  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !authUser) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "Missing company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    // Get gmail connection — grant_id is stored in access_token field
    const { data: conn } = await db
      .from("email_connections")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!conn || !conn.access_token) {
      return new Response(
        JSON.stringify({ error: "Email não ligado. Ligue primeiro nas Definições." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const grantId = conn.access_token; // grant_id stored here

    // Get missing/contacted invoices
    const { data: invoices } = await db
      .from("invoices")
      .select("id, invoice_number, supplier_nif, supplier_name, amount, supplier_id")
      .eq("company_id", company_id)
      .in("status", ["missing", "contacted"]);

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emails_found: 0, invoices_matched: 0, message: "Sem faturas em falta." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get supplier emails
    const supplierNifs = [...new Set(invoices.map((i) => i.supplier_nif).filter(Boolean))];
    const { data: suppliers } = await db
      .from("suppliers")
      .select("nif, email, name, legal_name")
      .eq("company_id", company_id)
      .in("nif", supplierNifs);

    const supplierMap = new Map<string, any>();
    for (const s of suppliers || []) {
      supplierMap.set(s.nif, s);
    }

    let totalEmailsFound = 0;
    let totalMatched = 0;
    const results: any[] = [];

    // Group invoices by supplier NIF
    const invoicesByNif = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (!inv.supplier_nif) continue;
      if (!invoicesByNif.has(inv.supplier_nif)) {
        invoicesByNif.set(inv.supplier_nif, []);
      }
      invoicesByNif.get(inv.supplier_nif)!.push(inv);
    }

    for (const [nif, nifInvoices] of invoicesByNif) {
      const supplier = supplierMap.get(nif);

      // Build search query
      // Build search query — include invoice numbers + broader terms
      const queryParts: string[] = [];
      if (supplier?.email) {
        queryParts.push(`from:${supplier.email}`);
      }
      // Add supplier name for broader matching
      const supplierName = supplier?.name || supplier?.legal_name;
      if (supplierName && !supplier?.email) {
        queryParts.push(supplierName);
      }
      // Add invoice numbers to search body text
      const invoiceNumbers = nifInvoices.map(i => i.invoice_number).filter(Boolean);
      if (invoiceNumbers.length > 0) {
        queryParts.push(`{${invoiceNumbers.join(" ")}}`);
      }
      // Add common invoice terms
      queryParts.push("fatura OR invoice OR factura OR recibo");

      if (queryParts.length === 0) continue;
      const query = queryParts.join(" ");
      console.log(`Searching Nylas for NIF ${nif}: ${query}`);

      const messages = await searchNylasMessages(nylasApiKey, grantId, query);
      totalEmailsFound += messages.length;

      for (const msg of messages.slice(0, 5)) {
        // Get full message with attachments
        const fullMsg = msg.attachments ? msg : await getNylasMessage(nylasApiKey, grantId, msg.id);
        if (!fullMsg) continue;

        const attachments = (fullMsg.attachments || []).filter((att: any) => {
          const ct = (att.content_type || "").toLowerCase();
          return ct.includes("pdf") || ct.includes("image");
        });

        for (const att of attachments) {
          if (!lovableApiKey) continue;

          const fileData = await downloadNylasAttachment(nylasApiKey, grantId, att.id, msg.id);
          if (!fileData) continue;

          const fileBuffer = new Uint8Array(fileData);
          const b64Data = btoa(String.fromCharCode(...fileBuffer));

          // Parse with Lovable AI (Gemini)
          try {
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:${att.content_type};base64,${b64Data}`,
                        },
                      },
                      {
                        type: "text",
                        text: `Analisa este documento e diz-me se é uma fatura. Se sim, extrai: invoice_number, amount (total com IVA), net_amount, vat_amount, issue_date (YYYY-MM-DD), due_date (YYYY-MM-DD), supplier_nif. Responde APENAS em JSON: {"is_invoice": true/false, "invoice_number": "...", "amount": 0, "net_amount": 0, "vat_amount": 0, "issue_date": "...", "due_date": "...", "supplier_nif": "..."}`,
                      },
                    ],
                  },
                ],
              }),
            });

            if (!aiRes.ok) {
              console.error("AI parse error:", aiRes.status, await aiRes.text());
              continue;
            }

            const aiData = await aiRes.json();
            const textContent = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) continue;

            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.is_invoice) continue;

            // Try to match
            let matchedInvoice = nifInvoices.find(
              (inv) => parsed.invoice_number && inv.invoice_number === parsed.invoice_number
            );
            if (!matchedInvoice && parsed.amount) {
              matchedInvoice = nifInvoices.find(
                (inv) => inv.amount && Math.abs(Number(inv.amount) - parsed.amount) < 0.01
              );
            }
            if (!matchedInvoice) {
              matchedInvoice = nifInvoices[0];
            }

            if (matchedInvoice) {
              // Upload to storage
              const filePath = `${company_id}/${nif}/${Date.now()}_${att.filename}`;
              await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
                contentType: att.content_type,
                upsert: false,
              });

              // Update invoice
              await db
                .from("invoices")
                .update({
                  status: "received",
                  amount: parsed.amount || undefined,
                  net_amount: parsed.net_amount || undefined,
                  vat_amount: parsed.vat_amount || undefined,
                  issue_date: parsed.issue_date || undefined,
                  due_date: parsed.due_date || undefined,
                })
                .eq("id", matchedInvoice.id);

              // Save attachment
              await db.from("attachments").insert({
                company_id,
                invoice_id: matchedInvoice.id,
                file_name: att.filename,
                file_path: filePath,
                file_type: att.content_type,
                file_size: att.size || fileBuffer.length,
                uploaded_by: "00000000-0000-0000-0000-000000000000",
              });

              totalMatched++;
              results.push({
                invoice_number: matchedInvoice.invoice_number,
                supplier_nif: nif,
                filename: att.filename,
              });

              const idx = nifInvoices.indexOf(matchedInvoice);
              if (idx > -1) nifInvoices.splice(idx, 1);
            }
          } catch (aiErr) {
            console.error("AI parse error:", aiErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_found: totalEmailsFound,
        invoices_matched: totalMatched,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scan-gmail-invoices error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
