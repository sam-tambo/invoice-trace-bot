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

  // GET: return Nylas Client ID + auth URL info
  if (req.method === "GET") {
    const clientId = Deno.env.get("NYLAS_CLIENT_ID") || "";
    return new Response(
      JSON.stringify({ client_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST: exchange Nylas auth code for grant_id
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const nylasApiKey = Deno.env.get("NYLAS_API_KEY")!;
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID")!;

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
    const userId = authUser.id;

    const { code, redirect_uri, company_id } = await req.json();

    if (!code || !redirect_uri || !company_id) {
      return new Response(
        JSON.stringify({ error: "Missing code, redirect_uri, or company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange Nylas auth code for tokens + grant_id
    const tokenRes = await fetch("https://api.us.nylas.com/v3/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: nylasClientId,
        client_secret: nylasApiKey,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.grant_id) {
      console.error("Nylas token exchange error:", tokenData);
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error || "Failed to exchange code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { grant_id, email, access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Upsert email_connection — store grant_id in refresh_token field for reuse
    const serviceDb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await serviceDb
      .from("email_connections")
      .select("id")
      .eq("company_id", company_id)
      .eq("provider", "gmail")
      .maybeSingle();

    const connectionData = {
      user_id: userId,
      access_token: grant_id, // Store grant_id as primary identifier
      refresh_token: refresh_token || null,
      token_expires_at: tokenExpiresAt,
      email_address: email || null,
    };

    if (existing) {
      await serviceDb
        .from("email_connections")
        .update(connectionData)
        .eq("id", existing.id);
    } else {
      await serviceDb.from("email_connections").insert({
        company_id,
        provider: "gmail",
        ...connectionData,
      });
    }

    return new Response(
      JSON.stringify({ success: true, email_address: email, grant_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("gmail-auth-callback error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
