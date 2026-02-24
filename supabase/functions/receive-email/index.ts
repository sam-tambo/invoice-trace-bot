import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const db = createClient(supabaseUrl, serviceKey);

    const payload = await req.json();
    console.log("Received inbound email webhook:", JSON.stringify(payload).slice(0, 500));

    const fromEmail = payload.from || payload.sender || "";
    const toEmail = payload.to || "";
    const subject = payload.subject || "";
    const bodyText = payload.text || payload.body_text || "";
    const bodyHtml = payload.html || payload.body_html || "";
    const attachments = payload.attachments || [];

    // Find supplier by email
    const { data: suppliers } = await db
      .from("suppliers")
      .select("nif, company_id, id")
      .ilike("email", fromEmail)
      .limit(1);

    const supplier = suppliers?.[0];
    const companyId = supplier?.company_id;
    const supplierNif = supplier?.nif;

    if (!companyId) {
      console.log("No matching supplier found for email:", fromEmail);
      // Still store the message with no company_id — skip for now
      return new Response(JSON.stringify({ status: "no_match", from: fromEmail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let matchedInvoiceId: string | null = null;
    let attachmentsParsed = false;

    // Process PDF attachments with AI
    if (attachments.length > 0 && anthropicKey) {
      for (const att of attachments) {
        if (!att.content) continue;

        const contentType = att.content_type || att.type || "application/pdf";
        const fileName = att.filename || att.name || "attachment.pdf";

        // Upload to storage
        const filePath = `${companyId}/${supplierNif || "unknown"}/${Date.now()}_${fileName}`;
        const fileBuffer = Uint8Array.from(atob(att.content), (c) => c.charCodeAt(0));

        await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
          contentType,
          upsert: false,
        });

        // Use AI to extract invoice data
        if (contentType.includes("pdf") || contentType.includes("image")) {
          try {
            const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1024,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: contentType.includes("image") ? "image" : "document",
                        source: {
                          type: "base64",
                          media_type: contentType,
                          data: att.content,
                        },
                      },
                      {
                        type: "text",
                        text: `Analisa este documento e diz-me se é uma fatura. Se sim, extrai: invoice_number, amount (total com IVA), net_amount, vat_amount, issue_date (YYYY-MM-DD), due_date (YYYY-MM-DD). Responde APENAS em JSON: {"is_invoice": true/false, "invoice_number": "...", "amount": 0, "net_amount": 0, "vat_amount": 0, "issue_date": "...", "due_date": "..."}`,
                      },
                    ],
                  },
                ],
              }),
            });

            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const textContent = aiData.content?.find((c: any) => c.type === "text")?.text || "";
              const jsonMatch = textContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.is_invoice) {
                  attachmentsParsed = true;

                  // Try to match existing missing invoice
                  const { data: matchingInvoices } = await db
                    .from("invoices")
                    .select("id")
                    .eq("company_id", companyId)
                    .eq("supplier_nif", supplierNif!)
                    .in("status", ["missing", "contacted"])
                    .limit(1);

                  if (matchingInvoices?.[0]) {
                    matchedInvoiceId = matchingInvoices[0].id;
                    // Update the invoice with parsed data
                    await db
                      .from("invoices")
                      .update({
                        status: "received",
                        amount: parsed.amount || null,
                        net_amount: parsed.net_amount || null,
                        vat_amount: parsed.vat_amount || null,
                        issue_date: parsed.issue_date || null,
                        due_date: parsed.due_date || null,
                      })
                      .eq("id", matchedInvoiceId);

                    // Save attachment record
                    await db.from("attachments").insert({
                      company_id: companyId,
                      invoice_id: matchedInvoiceId,
                      file_name: fileName,
                      file_path: filePath,
                      file_type: contentType,
                      file_size: fileBuffer.length,
                      uploaded_by: "00000000-0000-0000-0000-000000000000", // system
                    });
                  }
                }
              }
            }
          } catch (aiErr) {
            console.error("AI parsing error:", aiErr);
          }
        }
      }
    }

    // Store inbox message
    await db.from("inbox_messages").insert({
      company_id: companyId,
      supplier_nif: supplierNif,
      direction: "inbound",
      from_email: fromEmail,
      to_email: toEmail,
      subject,
      body_text: bodyText,
      body_html: bodyHtml,
      has_attachments: attachments.length > 0,
      attachments_parsed: attachmentsParsed,
      matched_invoice_id: matchedInvoiceId,
      status: matchedInvoiceId ? "processed" : "new",
      raw_payload: payload,
    });

    return new Response(
      JSON.stringify({
        status: "ok",
        matched_invoice: matchedInvoiceId,
        attachments_parsed: attachmentsParsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("receive-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
