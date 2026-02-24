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

  // GET: return the Google Client ID (public info)
  if (req.method === "GET") {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
    return new Response(
      JSON.stringify({ client_id: clientId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST: handle OAuth callback
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
    const userId = claimsData.claims.sub;

    const { code, redirect_uri, company_id } = await req.json();

    if (!code || !redirect_uri || !company_id) {
      return new Response(
        JSON.stringify({ error: "Missing code, redirect_uri, or company_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Google token error:", tokenData);
      return new Response(
        JSON.stringify({ error: tokenData.error_description || tokenData.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Get user's email from Gmail profile
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const profile = await profileRes.json();
    const emailAddress = profile.emailAddress || null;

    // Upsert email_connection
    const serviceDb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await serviceDb
      .from("email_connections")
      .select("id")
      .eq("company_id", company_id)
      .eq("provider", "gmail")
      .maybeSingle();

    if (existing) {
      await serviceDb
        .from("email_connections")
        .update({
          user_id: userId,
          access_token,
          refresh_token: refresh_token || undefined,
          token_expires_at: tokenExpiresAt,
          email_address: emailAddress,
        })
        .eq("id", existing.id);
    } else {
      await serviceDb.from("email_connections").insert({
        company_id,
        user_id: userId,
        provider: "gmail",
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        email_address: emailAddress,
      });
    }

    return new Response(
      JSON.stringify({ success: true, email_address: emailAddress }),
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
