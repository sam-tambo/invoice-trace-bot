import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NYLAS_BASE = "https://api.us.nylas.com/v3";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB

// --- Helpers ---

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeInvoiceNumber(num: string): string {
  return num.replace(/[\s\-\/\.]/g, "").toUpperCase();
}

/** Extract the "core" part of an invoice number: strip the doc-type prefix (FT, FS, FR, NC, ND, etc.)
 *  and any leading series code, returning the most distinctive numeric/alphanumeric identifier.
 *  E.g. "FT PT2025/870578" -> ["PT2025/870578", "870578"]
 *       "FS 1A2501/10396"  -> ["1A2501/10396", "10396"]
 *       "FR IDSM125/20577986" -> ["IDSM125/20577986", "20577986"]
 */
function extractSearchTerms(invoiceNumber: string): string[] {
  const terms: string[] = [invoiceNumber]; // always include full number
  // Strip document type prefix (FT, FS, FR, NC, ND, FP, VD, etc.) + optional space
  const withoutPrefix = invoiceNumber.replace(/^(FT|FS|FR|NC|ND|FP|VD|RC|GR|GT|GA|GC|GD)\s+/i, "");
  if (withoutPrefix !== invoiceNumber) terms.push(withoutPrefix);
  // Extract just the number after the last "/"
  const lastSlash = invoiceNumber.lastIndexOf("/");
  if (lastSlash !== -1) {
    const suffix = invoiceNumber.substring(lastSlash + 1);
    if (suffix.length >= 4) terms.push(suffix); // only if meaningful (4+ chars)
  }
  // Also try the series/number part (e.g. "A/856709073" from "FT A/856709073")
  const seriesMatch = invoiceNumber.match(/([A-Z0-9]+\/\d{4,})/i);
  if (seriesMatch && !terms.includes(seriesMatch[1])) terms.push(seriesMatch[1]);
  return [...new Set(terms)];
}

function findInvoiceNumberInText(text: string, invoiceNumbers: string[]): string | null {
  if (!text) return null;
  const upperText = text.toUpperCase();
  for (const num of invoiceNumbers) {
    // Try exact match first
    if (upperText.includes(num.toUpperCase())) return num;
    // Try normalized match (ignore separators)
    const normalized = normalizeInvoiceNumber(num);
    // Build a regex that allows optional separators between chars of the core number part
    if (normalized.length > 3 && upperText.replace(/[\s\-\/\.]/g, "").includes(normalized)) {
      return num;
    }
  }
  return null;
}

async function searchNylasMessages(apiKey: string, grantId: string, query: string, limit = 15): Promise<any[]> {
  const url = `${NYLAS_BASE}/grants/${grantId}/messages?search_query_native=${encodeURIComponent(query)}&limit=${limit}`;
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

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "Missing company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(supabaseUrl, serviceKey);

    // Get email connection
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

    const grantId = conn.access_token;

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

    // Get supplier info
    const supplierNifs = [...new Set(invoices.map((i) => i.supplier_nif).filter(Boolean))];
    const { data: suppliers } = await db
      .from("suppliers")
      .select("nif, email, name, legal_name")
      .eq("company_id", company_id)
      .in("nif", supplierNifs);

    const supplierMap = new Map<string, any>();
    for (const s of suppliers || []) supplierMap.set(s.nif, s);

    // Group invoices by supplier NIF
    const invoicesByNif = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (!inv.supplier_nif) continue;
      if (!invoicesByNif.has(inv.supplier_nif)) invoicesByNif.set(inv.supplier_nif, []);
      invoicesByNif.get(inv.supplier_nif)!.push(inv);
    }

    // All invoice numbers for text matching
    const allInvoiceNumbers = invoices.map(i => i.invoice_number).filter(Boolean);

    let totalEmailsFound = 0;
    let totalMatched = 0;
    const results: any[] = [];
    const matchedInvoiceIds = new Set<string>();
    const seenMessageIds = new Set<string>();
    let aiCreditsExhausted = false;

    // ============================================================
    // MULTI-PASS SEARCH STRATEGY (per-invoice, high recall)
    // ============================================================

    // Collect all unique messages across passes, deduplicated
    interface CandidateMessage {
      msg: any;
      pass: number;
      targetNif: string;
    }
    const candidates: CandidateMessage[] = [];

    function addCandidate(msg: any, pass: number, targetNif: string) {
      if (seenMessageIds.has(msg.id)) return;
      seenMessageIds.add(msg.id);
      candidates.push({ msg, pass, targetNif });
    }

    // --- PASS 1: Search EACH invoice number individually ---
    // This is the most reliable approach — Gmail handles individual searches best
    for (const inv of invoices) {
      if (!inv.invoice_number || matchedInvoiceIds.has(inv.id)) continue;
      const terms = extractSearchTerms(inv.invoice_number);
      
      // Try each search term individually, starting from most specific
      // Sort by length desc (longer = more specific)
      const sortedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
      
      for (const term of sortedTerms) {
        // Skip very short terms (< 4 chars) to avoid noise
        if (term.length < 4) continue;
        
        const query = `${term}`;
        console.log(`Pass 1 - Invoice ${inv.invoice_number} → searching: "${term}"`);
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        if (msgs.length > 0) {
          console.log(`  Found ${msgs.length} emails for term "${term}"`);
          for (const msg of msgs) addCandidate(msg, 1, inv.supplier_nif);
          break; // Found results for this invoice, no need to try other terms
        }
      }
    }

    // --- PASS 2: Search by supplier email/domain + has:attachment ---
    for (const [nif, nifInvoices] of invoicesByNif) {
      const remaining = nifInvoices.filter(i => !matchedInvoiceIds.has(i.id));
      if (remaining.length === 0) continue;

      const supplier = supplierMap.get(nif);
      if (!supplier?.email) continue;

      const email = supplier.email;
      const domain = email.includes("@") ? email.split("@").pop() : email.replace(/^@/, "");
      
      const genericDomains = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "live.com", "sapo.pt", "live.com.pt"];
      
      if (domain && !genericDomains.includes(domain!)) {
        const query = `from:${domain} has:attachment`;
        console.log(`Pass 2a - Searching by domain for NIF ${nif}: ${query}`);
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        for (const msg of msgs) addCandidate(msg, 2, nif);
      } else if (email.includes("@")) {
        const query = `from:${email} has:attachment`;
        console.log(`Pass 2b - Searching by email for NIF ${nif}: ${query}`);
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        for (const msg of msgs) addCandidate(msg, 2, nif);
      }
    }

    // --- PASS 3: Search by supplier name + has:attachment ---
    for (const [nif, nifInvoices] of invoicesByNif) {
      const remaining = nifInvoices.filter(i => !matchedInvoiceIds.has(i.id));
      if (remaining.length === 0) continue;
      
      const supplier = supplierMap.get(nif);
      const name = supplier?.name || supplier?.legal_name || nifInvoices[0]?.supplier_name;
      if (!name) continue;

      const shortName = name.split(/[,\-]/).map((p: string) => p.trim()).filter(Boolean)[0] || name;
      const query = `${shortName} has:attachment`;
      console.log(`Pass 3 - Searching by name for NIF ${nif}: ${query.substring(0, 100)}`);
      const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 8);
      for (const msg of msgs) addCandidate(msg, 3, nif);
    }

    totalEmailsFound = candidates.length;
    console.log(`Total candidate emails found across all passes: ${totalEmailsFound}`);

    // ============================================================
    // PROCESS CANDIDATES — non-AI matching first, then AI fallback
    // ============================================================

    for (const candidate of candidates) {
      const { msg, pass, targetNif } = candidate;

      // ALWAYS fetch full message to get complete body text (search results have truncated snippets)
      const fullMsg = await getNylasMessage(nylasApiKey, grantId, msg.id) || msg;

      const subject = fullMsg.subject || "";
      const snippet = fullMsg.snippet || msg.snippet || "";
      // Nylas v3: body can be a string (HTML) or object; extract text either way
      const bodyRaw = typeof fullMsg.body === "string" ? fullMsg.body : (fullMsg.body?.text || fullMsg.body?.html || "");
      // Strip HTML tags for plain text matching
      const bodyText = bodyRaw.replace(/<[^>]+>/g, " ");
      const combinedText = `${subject} ${snippet} ${bodyText}`;

      // --- Step A: Non-AI text matching (fast, free, most common case) ---
      let matchedInvoice: any = null;
      let confidence = "likely";

      // Check all NIFs' invoices against this email's text
      for (const [nif, nifInvoices] of invoicesByNif) {
        const remaining = nifInvoices.filter(i => !matchedInvoiceIds.has(i.id));
        if (remaining.length === 0) continue;
        const nums = remaining.map(i => i.invoice_number);
        const foundNum = findInvoiceNumberInText(combinedText, nums);
        if (foundNum) {
          matchedInvoice = remaining.find(i => i.invoice_number === foundNum);
          confidence = "exact_number";
          break;
        }
      }

      // Also check attachment filenames for invoice numbers
      const attachments = (fullMsg.attachments || []).filter((att: any) => {
        const ct = (att.content_type || "").toLowerCase();
        return ct.includes("pdf") || ct.includes("image");
      });

      if (!matchedInvoice) {
        for (const att of attachments) {
          const filename = att.filename || "";
          for (const [nif, nifInvoices] of invoicesByNif) {
            const remaining = nifInvoices.filter(i => !matchedInvoiceIds.has(i.id));
            const foundNum = findInvoiceNumberInText(filename, remaining.map(i => i.invoice_number));
            if (foundNum) {
              matchedInvoice = remaining.find(i => i.invoice_number === foundNum);
              confidence = "exact_number";
              break;
            }
          }
          if (matchedInvoice) break;
        }
      }

      // If we found a text-based match, upload the first PDF/image attachment and mark as received
      if (matchedInvoice && !matchedInvoiceIds.has(matchedInvoice.id)) {
        let uploadedFilename = "email_match";

        // Always try to download the first PDF/image attachment when we have a text match
        for (const att of attachments) {
          if (att.size && att.size > MAX_ATTACHMENT_SIZE) {
            console.log(`Skipping large attachment ${att.filename} (${att.size} bytes)`);
            continue;
          }
          const fileData = await downloadNylasAttachment(nylasApiKey, grantId, att.id, msg.id);
          if (fileData) {
            const fileBuffer = new Uint8Array(fileData);
            const filePath = `${company_id}/${matchedInvoice.supplier_nif}/${Date.now()}_${att.filename}`;
            const { error: uploadErr } = await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
              contentType: att.content_type, upsert: false,
            });
            if (!uploadErr) {
              await db.from("attachments").insert({
                company_id,
                invoice_id: matchedInvoice.id,
                file_name: att.filename,
                file_path: filePath,
                file_type: att.content_type,
                file_size: att.size || fileBuffer.length,
                uploaded_by: authUser.id,
              });
              uploadedFilename = att.filename;
              console.log(`✅ Uploaded attachment "${att.filename}" for invoice ${matchedInvoice.invoice_number}`);
            } else {
              console.error(`Upload error for ${att.filename}:`, uploadErr);
            }
            break; // Only upload the first successful attachment
          }
        }

        await db.from("invoices").update({ status: "received" }).eq("id", matchedInvoice.id);
        matchedInvoiceIds.add(matchedInvoice.id);
        totalMatched++;
        results.push({
          invoice_number: matchedInvoice.invoice_number,
          supplier_nif: matchedInvoice.supplier_nif,
          filename: uploadedFilename,
          confidence,
        });
        console.log(`✅ Matched invoice ${matchedInvoice.invoice_number} (${confidence}, file: ${uploadedFilename})`);
        continue;
      }

      // --- Step B: AI-based parsing (fallback for unmatched emails with attachments) ---
      if (aiCreditsExhausted || !anthropicApiKey || attachments.length === 0) continue;

      // Only try AI for pass 1 and 2 candidates (higher relevance)
      if (pass === 3) continue;

      // Determine which NIFs to try matching against
      const targetNifs = targetNif ? [targetNif] : [...invoicesByNif.keys()];

      for (const att of attachments.slice(0, 2)) {
        if (att.size && att.size > MAX_ATTACHMENT_SIZE) {
          console.log(`Skipping large attachment for AI: ${att.filename} (${att.size} bytes)`);
          continue;
        }

        const fileData = await downloadNylasAttachment(nylasApiKey, grantId, att.id, msg.id);
        if (!fileData) continue;

        const fileBuffer = new Uint8Array(fileData);
        const b64Data = uint8ToBase64(fileBuffer);

        // Skip unsupported content types for AI
        const ct = (att.content_type || "").toLowerCase();
        const isPdf = ct.includes("pdf");
        const supportedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        const isImage = supportedImages.some(s => ct.includes(s.split("/")[1]));
        if (!isPdf && !isImage) {
          console.log(`Skipping unsupported content type for AI: ${att.content_type} (${att.filename})`);
          continue;
        }

        try {
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicApiKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              messages: [{
                role: "user",
                content: [
                  isPdf
                    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64Data } }
                    : { type: "image", source: { type: "base64", media_type: supportedImages.find(s => ct.includes(s.split("/")[1]))!, data: b64Data } },
                  { type: "text", text: `Analisa este documento e diz-me se é uma fatura. Se sim, extrai: invoice_number, amount (total com IVA), net_amount, vat_amount, issue_date (YYYY-MM-DD), due_date (YYYY-MM-DD), supplier_nif. Responde APENAS em JSON: {"is_invoice": true/false, "invoice_number": "...", "amount": 0, "net_amount": 0, "vat_amount": 0, "issue_date": "...", "due_date": "...", "supplier_nif": "..."}` },
                ],
              }],
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error("AI parse error:", aiRes.status, errText);
            if (aiRes.status === 429 || aiRes.status === 402) {
              aiCreditsExhausted = true;
              console.warn("Anthropic API rate limited or payment issue — switching to non-AI matching only.");
              break;
            }
            continue;
          }

          const aiData = await aiRes.json();
          const textContent = aiData.content?.[0]?.text || "";
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) continue;

          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.is_invoice) continue;

          // Try matching by invoice number first, then amount
          let aiMatchedInvoice: any = null;
          let aiConfidence = "ai_parsed";

          for (const nif of targetNifs) {
            const remaining = (invoicesByNif.get(nif) || []).filter(i => !matchedInvoiceIds.has(i.id));
            // Exact number match
            aiMatchedInvoice = remaining.find(i =>
              parsed.invoice_number && normalizeInvoiceNumber(i.invoice_number) === normalizeInvoiceNumber(parsed.invoice_number)
            );
            if (aiMatchedInvoice) { aiConfidence = "exact_number"; break; }
            // Amount match
            if (parsed.amount) {
              aiMatchedInvoice = remaining.find(i =>
                i.amount && Math.abs(Number(i.amount) - parsed.amount) < 0.01
              );
              if (aiMatchedInvoice) { aiConfidence = "amount_match"; break; }
            }
          }

          if (aiMatchedInvoice && !matchedInvoiceIds.has(aiMatchedInvoice.id)) {
            const filePath = `${company_id}/${aiMatchedInvoice.supplier_nif}/${Date.now()}_${att.filename}`;
            await db.storage.from("invoice-files").upload(filePath, fileBuffer, {
              contentType: att.content_type, upsert: false,
            });

            await db.from("invoices").update({
              status: "received",
              amount: parsed.amount || undefined,
              net_amount: parsed.net_amount || undefined,
              vat_amount: parsed.vat_amount || undefined,
              issue_date: parsed.issue_date || undefined,
              due_date: parsed.due_date || undefined,
            }).eq("id", aiMatchedInvoice.id);

            await db.from("attachments").insert({
              company_id,
              invoice_id: aiMatchedInvoice.id,
              file_name: att.filename,
              file_path: filePath,
              file_type: att.content_type,
              file_size: att.size || fileBuffer.length,
              uploaded_by: authUser.id,
            });

            matchedInvoiceIds.add(aiMatchedInvoice.id);
            totalMatched++;
            results.push({
              invoice_number: aiMatchedInvoice.invoice_number,
              supplier_nif: aiMatchedInvoice.supplier_nif,
              filename: att.filename,
              confidence: aiConfidence,
            });
            console.log(`✅ AI matched invoice ${aiMatchedInvoice.invoice_number} (${aiConfidence}, file: ${att.filename})`);
            break; // Got a match from this message, move to next
          }
        } catch (aiErr) {
          console.error("AI parse error:", aiErr);
        }
      }
    }

    const response: any = {
      success: true,
      emails_found: totalEmailsFound,
      invoices_matched: totalMatched,
      details: results,
    };
    if (aiCreditsExhausted) {
      response.warning = "API de IA indisponível temporariamente. Algumas faturas foram correspondidas apenas por número no texto do email.";
    }

    return new Response(JSON.stringify(response), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scan-gmail-invoices error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
