import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NYLAS_API_KEY = Deno.env.get("NYLAS_API_KEY") || "";
const NYLAS_CLIENT_ID = Deno.env.get("NYLAS_CLIENT_ID") || "";
const NYLAS_CALLBACK_URI = Deno.env.get("NYLAS_CALLBACK_URI") || "";
const APP_URL = "https://invoice-trace-bot.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── POST: Frontend calls this to get the Nylas auth URL ──
  if (req.method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const companyId = body.company_id;
      if (!companyId) {
        return new Response(JSON.stringify({ error: "Missing company_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encode user_id + company_id in state
      const state = btoa(JSON.stringify({ user_id: user.id, company_id: companyId }));

      const authUrl = new URL("https://api.us.nylas.com/v3/connect/auth");
      authUrl.searchParams.set("client_id", NYLAS_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", NYLAS_CALLBACK_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline");
      // No provider set — Nylas shows its provider picker (Gmail, Outlook, Yahoo, etc.)

      console.log("Generated Nylas auth URL with redirect_uri:", NYLAS_CALLBACK_URI);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Auth init error:", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── GET: Nylas redirects here after user authorizes ──
  if (req.method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // If no code/state params, return client_id (legacy support)
    if (!code && !state && !error) {
      return new Response(
        JSON.stringify({ client_id: NYLAS_CLIENT_ID }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (error) {
      console.error("Nylas auth error:", error);
      return Response.redirect(`${APP_URL}/settings?email=denied&reason=${error}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${APP_URL}/settings?email=error&reason=missing_params`, 302);
    }

    try {
      const { user_id, company_id } = JSON.parse(atob(state));
      console.log("Processing Nylas callback for user:", user_id, "company:", company_id);

      // Exchange code for Nylas grant — NO code_verifier since we didn't send code_challenge
      const tokenRes = await fetch("https://api.us.nylas.com/v3/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: NYLAS_CLIENT_ID,
          client_secret: NYLAS_API_KEY,
          redirect_uri: NYLAS_CALLBACK_URI,
          code,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      console.log("Nylas token exchange response status:", tokenRes.status, "has grant_id:", !!tokenData.grant_id);

      if (!tokenData.grant_id) {
        console.error("Nylas token exchange failed:", JSON.stringify(tokenData));
        const reason = tokenData.error_description || tokenData.error || "token_exchange_failed";
        return Response.redirect(`${APP_URL}/settings?email=error&reason=${encodeURIComponent(reason)}`, 302);
      }

      const { grant_id, email } = tokenData;

      // Save to DB using service role
      const serviceDb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const provider = tokenData.provider || "unknown";

      const { data: existing } = await serviceDb
        .from("email_connections")
        .select("id")
        .eq("company_id", company_id)
        .maybeSingle();

      const connectionData = {
        user_id,
        provider,
        access_token: grant_id,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        email_address: email || null,
      };

      if (existing) {
        await serviceDb.from("email_connections").update(connectionData).eq("id", existing.id);
      } else {
        await serviceDb.from("email_connections").insert({
          company_id,
          ...connectionData,
        });
      }

      console.log("Email connected successfully for:", email, "provider:", tokenData.provider);
      return Response.redirect(
        `${APP_URL}/settings?email=connected&address=${encodeURIComponent(email || "")}`,
        302
      );
    } catch (err) {
      console.error("Nylas callback error:", err);
      return Response.redirect(`${APP_URL}/settings?email=error&reason=${encodeURIComponent(String(err))}`, 302);
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
