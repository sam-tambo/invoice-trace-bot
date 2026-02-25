import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NYLAS_BASE = "https://api.us.nylas.com/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Nylas challenge verification (GET with ?challenge=xxx)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const db = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    console.log("Nylas webhook received:", JSON.stringify(payload).slice(0, 500));

    // Nylas sends { specversion, type, source, id, data: { object: {...} } }
    const webhookData = payload.data?.object || payload.data || payload;
    const grantId = webhookData.grant_id || payload.data?.grant_id;

    if (!grantId) {
      console.log("No grant_id in webhook payload, skipping");
      return new Response(JSON.stringify({ status: "skipped", reason: "no_grant_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the email_connection by grant_id (stored in access_token)
    const { data: conn } = await db
      .from("email_connections")
      .select("company_id, user_id")
      .eq("access_token", grantId)
      .maybeSingle();

    if (!conn) {
      console.log("No email_connection found for grant_id:", grantId);
      return new Response(JSON.stringify({ status: "skipped", reason: "unknown_grant" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = conn.company_id;
    const messageId = webhookData.id || webhookData.message_id;

    if (!messageId) {
      console.log("No message_id in webhook");
      return new Response(JSON.stringify({ status: "skipped", reason: "no_message_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch full message from Nylas
    const msgRes = await fetch(`${NYLAS_BASE}/grants/${grantId}/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${nylasApiKey}`, Accept: "application/json" },
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      console.error("Nylas message fetch error:", msgRes.status, errText);
      return new Response(JSON.stringify({ status: "error", reason: "nylas_fetch_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msgData = (await msgRes.json()).data;
    const fromEmail = msgData.from?.[0]?.email || "";
    const subject = msgData.subject || "";
    const bodyText = msgData.body || msgData.snippet || "";
    const attachments = (msgData.attachments || []).filter((att: any) => {
      const ct = (att.content_type || "").toLowerCase();
      return ct.includes("pdf") || ct.includes("image");
    });

    // Find supplier by email
    const { data: suppliers } = await db
      .from("suppliers")
      .select("nif, id, name")
      .eq("company_id", companyId)
      .ilike("email", fromEmail)
      .limit(1);

    const supplier = suppliers?.[0];
    const supplierNif = supplier?.nif || null;

    let matchedInvoiceId: string | null = null;
    let attachmentsParsed = false;

    // Process attachments with AI
    if (attachments.length > 0 && lovableApiKey) {
      for (const att of attachments) {
        // Download attachment
        const dlRes = await fetch(
          `${NYLAS_BASE}/grants/${grantId}/attachments/${att.id}/download?message_id=${messageId}`,
          { headers: { Authorization: `Bearer ${nylasApiKey}` } }
        );
        if (!dlRes.ok) {
          console.error("Attachment download failed:", dlRes.status);
          continue;
        }

        const fileBuffer = new Uint8Array(await dlRes.arrayBuffer());
        const b64Data = btoa(String.fromCharCode(...fileBuffer));

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

          attachmentsParsed = true;

          // Try to match with missing invoices
          const matchNif = supplierNif || parsed.supplier_nif;
          if (matchNif) {
            // First try exact invoice_number match
            if (parsed.invoice_number) {
              const { data: exactMatch } = await db
                .from("invoices")
                .select("id")
                .eq("company_id", companyId)
                .eq("invoice_number", parsed.invoice_number)
                .in("status", ["missing", "contacted"])
                .limit(1);

              if (exactMatch?.[0]) {
                matchedInvoiceId = exactMatch[0].id;
              }
            }

            // Fallback: match by amount with tolerance
            if (!matchedInvoiceId && parsed.amount) {
              const { data: amountMatches } = await db
                .from("invoices")
                .select("id, amount")
                .eq("company_id", companyId)
                .eq("supplier_nif", matchNif)
                .in("status", ["missing", "contacted"]);

              const match = amountMatches?.find(
                (inv) => inv.amount && Math.abs(Number(inv.amount) - parsed.amount) < 0.01
              );
              if (match) matchedInvoiceId = match.id;
            }

            // Fallback: first missing invoice from this supplier
            if (!matchedInvoiceId) {
              const { data: anyMatch } = await db
                .from("invoices")
                .select("id")
                .eq("company_id", companyId)
                .eq("supplier_nif", matchNif)
                .in("status", ["missing", "contacted"])
                .limit(1);

              if (anyMatch?.[0]) matchedInvoiceId = anyMatch[0].id;
            }
          }

          // Upload file + update invoice if matched
          const filePath = `${companyId}/${matchNif || "unknown"}/${Date.now()}_${att.filename || "attachment"}`;
          await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
            contentType: att.content_type,
            upsert: false,
          });

          if (matchedInvoiceId) {
            await db
              .from("invoices")
              .update({
                status: "received",
                source: "email",
                amount: parsed.amount || undefined,
                net_amount: parsed.net_amount || undefined,
                vat_amount: parsed.vat_amount || undefined,
                issue_date: parsed.issue_date || undefined,
                due_date: parsed.due_date || undefined,
              })
              .eq("id", matchedInvoiceId);

            await db.from("attachments").insert({
              company_id: companyId,
              invoice_id: matchedInvoiceId,
              file_name: att.filename || "attachment",
              file_path: filePath,
              file_type: att.content_type,
              file_size: fileBuffer.length,
              uploaded_by: conn.user_id || "00000000-0000-0000-0000-000000000000",
            });
          } else if (parsed.invoice_number) {
            // Create new invoice from unmatched email attachment
            const { data: newInvoice } = await db
              .from("invoices")
              .insert({
                company_id: companyId,
                created_by: conn.user_id,
                supplier_name: supplier?.name || "Desconhecido",
                supplier_nif: matchNif || "",
                invoice_number: parsed.invoice_number,
                issue_date: parsed.issue_date || null,
                due_date: parsed.due_date || null,
                net_amount: parsed.net_amount || null,
                vat_amount: parsed.vat_amount || null,
                amount: parsed.amount || null,
                status: "received",
                source: "email",
                supplier_id: supplier?.id || null,
              })
              .select("id")
              .single();

            if (newInvoice) {
              matchedInvoiceId = newInvoice.id;
              await db.from("attachments").insert({
                company_id: companyId,
                invoice_id: newInvoice.id,
                file_name: att.filename || "attachment",
                file_path: filePath,
                file_type: att.content_type,
                file_size: fileBuffer.length,
                uploaded_by: conn.user_id || "00000000-0000-0000-0000-000000000000",
              });
            }
          }
        } catch (aiErr) {
          console.error("AI parsing error:", aiErr);
        }
      }
    }

    // Store in inbox_messages
    await db.from("inbox_messages").insert({
      company_id: companyId,
      supplier_nif: supplierNif,
      direction: "inbound",
      from_email: fromEmail,
      to_email: msgData.to?.[0]?.email || null,
      subject,
      body_text: bodyText.slice(0, 10000),
      has_attachments: attachments.length > 0,
      attachments_parsed: attachmentsParsed,
      matched_invoice_id: matchedInvoiceId,
      status: matchedInvoiceId ? "processed" : "new",
      raw_payload: { nylas_message_id: messageId, grant_id: grantId },
    });

    console.log(`Webhook processed: from=${fromEmail}, matched=${matchedInvoiceId}, parsed=${attachmentsParsed}`);

    return new Response(
      JSON.stringify({
        status: "ok",
        matched_invoice: matchedInvoiceId,
        attachments_parsed: attachmentsParsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("nylas-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, // Return 200 to prevent Nylas from retrying
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
