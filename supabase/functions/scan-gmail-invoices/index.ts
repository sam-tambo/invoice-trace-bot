import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NYLAS_BASE = "https://api.us.nylas.com/v3";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

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

/**
 * Generate MANY search query variations for a single invoice number.
 * The goal: at least ONE of these MUST match what Gmail indexes.
 * 
 * For "FT PT2025/870578" we generate:
 *  - "FT PT2025/870578"           (exact full)
 *  - "PT2025/870578"              (without doc-type prefix)
 *  - "870578"                      (just the number after last /)
 *  - "PT2025 870578"              (slash replaced with space)
 *  - "FT PT2025 870578"           (full with slash→space)  
 *  - "\"PT2025/870578\""          (quoted exact)
 *  - "\"870578\""                 (quoted suffix)
 */
function generateSearchQueries(invoiceNumber: string): string[] {
  const queries: string[] = [];
  const trimmed = invoiceNumber.trim();
  
  // 1. Full invoice number as-is
  queries.push(trimmed);
  
  // 2. Without document type prefix
  const withoutPrefix = trimmed.replace(/^(FT|FS|FR|NC|ND|FP|VD|RC|GR|GT|GA|GC|GD)\s+/i, "");
  if (withoutPrefix !== trimmed) {
    queries.push(withoutPrefix);
  }
  
  // 3. Number after last slash (the most unique part)
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash !== -1) {
    const suffix = trimmed.substring(lastSlash + 1);
    if (suffix.length >= 4) {
      queries.push(suffix);
    }
  }
  
  // 4. Replace slashes with spaces (Gmail may tokenize on /)
  const spacified = trimmed.replace(/\//g, " ");
  if (spacified !== trimmed) queries.push(spacified);
  
  const spacifiedNoPrefix = withoutPrefix.replace(/\//g, " ");
  if (spacifiedNoPrefix !== withoutPrefix && spacifiedNoPrefix !== spacified) {
    queries.push(spacifiedNoPrefix);
  }

  // 5. Quoted versions for exact matching
  queries.push(`"${withoutPrefix}"`);
  if (lastSlash !== -1) {
    const suffix = trimmed.substring(lastSlash + 1);
    if (suffix.length >= 4) queries.push(`"${suffix}"`);
  }
  
  // 6. Series/number pattern e.g. "A/856709073"
  const seriesMatch = trimmed.match(/([A-Z0-9]+\/\d{4,})/i);
  if (seriesMatch) {
    queries.push(seriesMatch[1]);
    queries.push(`"${seriesMatch[1]}"`);
  }

  // 7. Extract ALL numeric sequences of 5+ digits (very likely to be unique identifiers)
  const numericParts = trimmed.match(/\d{5,}/g);
  if (numericParts) {
    for (const np of numericParts) {
      if (!queries.includes(np)) queries.push(np);
    }
  }

  // Deduplicate
  return [...new Set(queries)];
}

function findInvoiceNumberInText(text: string, invoiceNumbers: string[]): string | null {
  if (!text) return null;
  const upperText = text.toUpperCase();
  const normalizedText = upperText.replace(/[\s\-\/\.]/g, "");
  
  for (const num of invoiceNumbers) {
    // Exact match
    if (upperText.includes(num.toUpperCase())) return num;
    // Normalized match (ignore separators)
    const normalized = normalizeInvoiceNumber(num);
    if (normalized.length > 3 && normalizedText.includes(normalized)) return num;
    // Also check the suffix after last /
    const lastSlash = num.lastIndexOf("/");
    if (lastSlash !== -1) {
      const suffix = num.substring(lastSlash + 1);
      if (suffix.length >= 5 && upperText.includes(suffix.toUpperCase())) return num;
    }
    // Check all long numeric sequences from the invoice number
    const nums = num.match(/\d{5,}/g);
    if (nums) {
      for (const n of nums) {
        if (upperText.includes(n)) return num;
      }
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
    const errText = await res.text();
    console.error(`Nylas search error for "${query}":`, res.status, errText);
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

    const supplierNifs = [...new Set(invoices.map((i) => i.supplier_nif).filter(Boolean))];
    const { data: suppliers } = await db
      .from("suppliers")
      .select("nif, email, name, legal_name")
      .eq("company_id", company_id)
      .in("nif", supplierNifs);

    const supplierMap = new Map<string, any>();
    for (const s of suppliers || []) supplierMap.set(s.nif, s);

    const invoicesByNif = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      if (!inv.supplier_nif) continue;
      if (!invoicesByNif.has(inv.supplier_nif)) invoicesByNif.set(inv.supplier_nif, []);
      invoicesByNif.get(inv.supplier_nif)!.push(inv);
    }

    const allInvoiceNumbers = invoices.map(i => i.invoice_number).filter(Boolean);

    let totalEmailsFound = 0;
    let totalMatched = 0;
    const results: any[] = [];
    const matchedInvoiceIds = new Set<string>();
    const seenMessageIds = new Set<string>();
    let aiCreditsExhausted = false;

    interface CandidateMessage {
      msg: any;
      pass: number;
      targetNif: string;
      targetInvoiceId?: string; // Set when Pass 1 found this email searching for a specific invoice
    }
    const candidates: CandidateMessage[] = [];

    function addCandidate(msg: any, pass: number, targetNif: string, targetInvoiceId?: string) {
      if (seenMessageIds.has(msg.id)) {
        // If already seen but now we have a more specific targetInvoiceId, update it
        if (targetInvoiceId) {
          const existing = candidates.find(c => c.msg.id === msg.id);
          if (existing && !existing.targetInvoiceId) {
            existing.targetInvoiceId = targetInvoiceId;
          }
        }
        return;
      }
      seenMessageIds.add(msg.id);
      candidates.push({ msg, pass, targetNif, targetInvoiceId });
    }

    // ============================================================
    // PASS 1: Search EACH invoice number with MULTIPLE query variations
    // This is the critical pass — try every possible search string
    // ============================================================
    for (const inv of invoices) {
      if (!inv.invoice_number || matchedInvoiceIds.has(inv.id)) continue;
      
      const queries = generateSearchQueries(inv.invoice_number);
      console.log(`Pass 1 — Invoice "${inv.invoice_number}" → ${queries.length} search variations: ${JSON.stringify(queries)}`);
      
      let foundAny = false;
      for (const query of queries) {
        if (query.length < 4) continue;
        
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        if (msgs.length > 0) {
          console.log(`  ✓ Found ${msgs.length} emails for query: "${query}"`);
          for (const msg of msgs) addCandidate(msg, 1, inv.supplier_nif, inv.id);
          foundAny = true;
          // Don't break — but if we already found results, skip remaining variations
          // to save API calls. First hit is usually enough.
          break;
        } else {
          console.log(`  ✗ No results for: "${query}"`);
        }
      }
      if (!foundAny) {
        console.log(`  ⚠ NO emails found for any of ${queries.length} variations of "${inv.invoice_number}"`);
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
        console.log(`Pass 2 - NIF ${nif}: ${query}`);
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        for (const msg of msgs) addCandidate(msg, 2, nif);
      } else if (email.includes("@")) {
        const query = `from:${email} has:attachment`;
        console.log(`Pass 2 - NIF ${nif}: ${query}`);
        const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 10);
        for (const msg of msgs) addCandidate(msg, 2, nif);
      }
    }

    // --- PASS 3: Search by supplier name ---
    for (const [nif, nifInvoices] of invoicesByNif) {
      const remaining = nifInvoices.filter(i => !matchedInvoiceIds.has(i.id));
      if (remaining.length === 0) continue;

      const supplier = supplierMap.get(nif);
      const name = supplier?.name || supplier?.legal_name || nifInvoices[0]?.supplier_name;
      if (!name) continue;

      const shortName = name.split(/[,\-]/).map((p: string) => p.trim()).filter(Boolean)[0] || name;
      const query = `${shortName} has:attachment`;
      console.log(`Pass 3 - NIF ${nif}: ${query}`);
      const msgs = await searchNylasMessages(nylasApiKey, grantId, query, 8);
      for (const msg of msgs) addCandidate(msg, 3, nif);
    }

    totalEmailsFound = candidates.length;
    console.log(`Total candidate emails: ${totalEmailsFound}`);

    // ============================================================
    // PROCESS CANDIDATES
    // ============================================================
    for (const candidate of candidates) {
      const { msg, pass, targetNif } = candidate;

      const fullMsg = await getNylasMessage(nylasApiKey, grantId, msg.id) || msg;

      const subject = fullMsg.subject || "";
      const snippet = fullMsg.snippet || msg.snippet || "";
      const bodyRaw = typeof fullMsg.body === "string" ? fullMsg.body : (fullMsg.body?.text || fullMsg.body?.html || "");
      const bodyText = bodyRaw.replace(/<[^>]+>/g, " ");
      const combinedText = `${subject} ${snippet} ${bodyText}`;

      // --- Direct match from Pass 1 (search-based evidence) ---
      let matchedInvoice: any = null;
      let confidence = "likely";

      // KEY FIX: If Pass 1 found this email by searching for a specific invoice number,
      // that IS the match — we don't need to find the number in the email body text.
      if (candidate.targetInvoiceId && !matchedInvoiceIds.has(candidate.targetInvoiceId)) {
        matchedInvoice = invoices.find(i => i.id === candidate.targetInvoiceId);
        if (matchedInvoice) {
          confidence = "search_match";
          console.log(`  → Direct match via search: ${matchedInvoice.invoice_number}`);
        }
      }

      // Text-based matching (for Pass 2/3 candidates or as upgrade to "exact_number")
      if (!matchedInvoice) {
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
      } else {
        // Even if we have a search match, check if the number appears in text for stronger confidence
        const foundNum = findInvoiceNumberInText(combinedText, [matchedInvoice.invoice_number]);
        if (foundNum) confidence = "exact_number";
      }

      // Check attachment filenames
      const attachments = (fullMsg.attachments || []).filter((att: any) => {
        const ct = (att.content_type || "").toLowerCase();
        return ct.includes("pdf") || ct.includes("image");
      });

      if (!matchedInvoice) {
        for (const att of attachments) {
          const filename = att.filename || "";
          for (const [_nif, nifInvoices] of invoicesByNif) {
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

      // Upload attachment and mark as received
      if (matchedInvoice && !matchedInvoiceIds.has(matchedInvoice.id)) {
        let uploadedFilename = "email_match";

        for (const att of attachments) {
          if (att.size && att.size > MAX_ATTACHMENT_SIZE) continue;
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
              console.log(`✅ Uploaded "${att.filename}" for ${matchedInvoice.invoice_number}`);
            }
            break;
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
        console.log(`✅ Matched ${matchedInvoice.invoice_number} (${confidence})`);
        continue;
      }

      // --- AI fallback ---
      if (aiCreditsExhausted || !anthropicApiKey || attachments.length === 0) continue;
      if (pass === 3) continue;

      const targetNifs = targetNif ? [targetNif] : [...invoicesByNif.keys()];

      for (const att of attachments.slice(0, 2)) {
        if (att.size && att.size > MAX_ATTACHMENT_SIZE) continue;

        const fileData = await downloadNylasAttachment(nylasApiKey, grantId, att.id, msg.id);
        if (!fileData) continue;

        const fileBuffer = new Uint8Array(fileData);
        const b64Data = uint8ToBase64(fileBuffer);

        const ct = (att.content_type || "").toLowerCase();
        const isPdf = ct.includes("pdf");
        const supportedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        const isImage = supportedImages.some(s => ct.includes(s.split("/")[1]));
        if (!isPdf && !isImage) continue;

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
            console.error("AI error:", aiRes.status, errText);
            if (aiRes.status === 429 || aiRes.status === 402) {
              aiCreditsExhausted = true;
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

          let aiMatchedInvoice: any = null;
          let aiConfidence = "ai_parsed";

          for (const nif of targetNifs) {
            const remaining = (invoicesByNif.get(nif) || []).filter(i => !matchedInvoiceIds.has(i.id));
            aiMatchedInvoice = remaining.find(i =>
              parsed.invoice_number && normalizeInvoiceNumber(i.invoice_number) === normalizeInvoiceNumber(parsed.invoice_number)
            );
            if (aiMatchedInvoice) { aiConfidence = "exact_number"; break; }
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
            console.log(`✅ AI matched ${aiMatchedInvoice.invoice_number} (${aiConfidence})`);
            break;
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
