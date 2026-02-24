import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return null;
  return { access_token: data.access_token, expires_in: data.expires_in };
}

async function searchGmail(accessToken: string, query: string): Promise<any[]> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.messages || [];
}

async function getMessageWithAttachments(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return await res.json();
}

async function downloadAttachment(accessToken: string, messageId: string, attachmentId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.data; // base64url encoded
}

function base64UrlToBase64(b64url: string): string {
  return b64url.replace(/-/g, "+").replace(/_/g, "/");
}

function findAttachmentParts(parts: any[]): any[] {
  const results: any[] = [];
  for (const part of parts) {
    if (part.filename && part.body?.attachmentId) {
      const mime = (part.mimeType || "").toLowerCase();
      if (mime.includes("pdf") || mime.includes("image")) {
        results.push({
          filename: part.filename,
          mimeType: part.mimeType,
          attachmentId: part.body.attachmentId,
          size: part.body.size || 0,
        });
      }
    }
    if (part.parts) {
      results.push(...findAttachmentParts(part.parts));
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
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

    // Get gmail connection
    const { data: conn } = await db
      .from("email_connections")
      .select("*")
      .eq("company_id", company_id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (!conn || !conn.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Gmail não ligado. Ligue primeiro nas Definições." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if expired
    let accessToken = conn.access_token;
    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : new Date(0);
    if (expiresAt < new Date()) {
      const refreshed = await refreshAccessToken(conn.refresh_token, googleClientId, googleClientSecret);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Falha ao refrescar token Gmail. Religue nas Definições." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await db
        .from("email_connections")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", conn.id);
    }

    // Get missing/contacted invoices with their suppliers
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
      const queryParts: string[] = [];
      if (supplier?.email) {
        queryParts.push(`from:${supplier.email}`);
      } else if (supplier?.name) {
        queryParts.push(supplier.name);
      } else if (supplier?.legal_name) {
        queryParts.push(supplier.legal_name);
      } else {
        continue; // No way to search
      }
      queryParts.push("has:attachment");
      queryParts.push("(filename:pdf OR filename:jpg OR filename:png)");

      const query = queryParts.join(" ");
      console.log(`Searching Gmail for NIF ${nif}: ${query}`);

      const messages = await searchGmail(accessToken!, query);
      totalEmailsFound += messages.length;

      for (const msg of messages.slice(0, 5)) {
        const fullMsg = await getMessageWithAttachments(accessToken!, msg.id);
        const parts = fullMsg.payload?.parts || [];
        const attachmentParts = findAttachmentParts(
          fullMsg.payload?.parts ? parts : [fullMsg.payload]
        );

        for (const att of attachmentParts) {
          if (!anthropicKey) continue;

          const rawData = await downloadAttachment(accessToken!, msg.id, att.attachmentId);
          if (!rawData) continue;

          const b64Data = base64UrlToBase64(rawData);

          // Parse with AI
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
                        type: att.mimeType.includes("image") ? "image" : "document",
                        source: {
                          type: "base64",
                          media_type: att.mimeType,
                          data: b64Data,
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

            if (!aiRes.ok) continue;

            const aiData = await aiRes.json();
            const textContent = aiData.content?.find((c: any) => c.type === "text")?.text || "";
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) continue;

            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.is_invoice) continue;

            // Try to match by invoice number first, then by amount
            let matchedInvoice = nifInvoices.find(
              (inv) => parsed.invoice_number && inv.invoice_number === parsed.invoice_number
            );
            if (!matchedInvoice && parsed.amount) {
              matchedInvoice = nifInvoices.find(
                (inv) => inv.amount && Math.abs(Number(inv.amount) - parsed.amount) < 0.01
              );
            }
            if (!matchedInvoice) {
              matchedInvoice = nifInvoices[0]; // fallback: first missing invoice for this supplier
            }

            if (matchedInvoice) {
              // Upload to storage
              const filePath = `${company_id}/${nif}/${Date.now()}_${att.filename}`;
              const fileBuffer = Uint8Array.from(atob(b64Data), (c) => c.charCodeAt(0));

              await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
                contentType: att.mimeType,
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
                file_type: att.mimeType,
                file_size: att.size,
                uploaded_by: "00000000-0000-0000-0000-000000000000",
              });

              totalMatched++;
              results.push({
                invoice_number: matchedInvoice.invoice_number,
                supplier_nif: nif,
                filename: att.filename,
              });

              // Remove from pending list
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
