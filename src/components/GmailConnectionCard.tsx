import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Link2, Unlink, Loader2 } from "lucide-react";

const GMAIL_CODE_KEY = "gmail_oauth_code";
const GMAIL_REDIRECT_URI_KEY = "gmail_oauth_redirect_uri";

const GmailConnectionCard = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [clientId, setClientId] = useState("");
  const callbackProcessed = useRef(false);

  const fetchConnection = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("email_connections")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .eq("provider", "gmail")
      .maybeSingle();
    setConnection(data);
    setLoading(false);
  }, [selectedCompany]);

  // Fetch Nylas Client ID from edge function
  useEffect(() => {
    const fetchClientId = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/gmail-auth-callback`,
          { method: "GET" }
        );
        const data = await res.json();
        if (data.client_id) setClientId(data.client_id);
      } catch (e) {
        console.error("Failed to fetch Nylas Client ID:", e);
      }
    };
    fetchClientId();
  }, []);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Save code from URL to sessionStorage immediately (before any redirect can strip it)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      console.log("Gmail OAuth code detected in URL, saving to sessionStorage");
      sessionStorage.setItem(GMAIL_CODE_KEY, code);
      // Clean URL immediately
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Process saved code once user and company are ready
  useEffect(() => {
    const savedCode = sessionStorage.getItem(GMAIL_CODE_KEY);
    if (savedCode && selectedCompany && user && !callbackProcessed.current) {
      callbackProcessed.current = true;
      console.log("Processing saved Gmail OAuth code for company:", selectedCompany.id);
      handleCallback(savedCode);
    }
  }, [selectedCompany, user]);

  const handleCallback = async (code: string) => {
    if (!selectedCompany) return;
    setConnecting(true);
    try {
    // Use the saved redirect_uri to ensure it matches what was used in connectGmail
    const redirectUri = sessionStorage.getItem(GMAIL_REDIRECT_URI_KEY) || `${window.location.origin}/settings`;
    console.log("Exchanging Gmail code with redirect_uri:", redirectUri);

      const { data, error } = await supabase.functions.invoke("gmail-auth-callback", {
        body: { code, redirect_uri: redirectUri, company_id: selectedCompany.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Clear saved data on success
      sessionStorage.removeItem(GMAIL_CODE_KEY);
      sessionStorage.removeItem(GMAIL_REDIRECT_URI_KEY);
      toast({ title: "Gmail ligado!", description: `Conta: ${data.email_address}` });
      fetchConnection();
    } catch (err: any) {
      console.error("Gmail callback error:", err);
      sessionStorage.removeItem(GMAIL_CODE_KEY);
      sessionStorage.removeItem(GMAIL_REDIRECT_URI_KEY);
      toast({ title: "Erro ao ligar Gmail", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const connectGmail = () => {
    if (!clientId) {
      toast({
        title: "Configuração em falta",
        description: "NYLAS_CLIENT_ID não está configurado.",
        variant: "destructive",
      });
      return;
    }

    // Use current origin — the redirect must come back to THIS domain
    const redirectUri = `${window.location.origin}/settings`;
    // Persist redirect_uri so the callback exchange uses the exact same value
    sessionStorage.setItem(GMAIL_REDIRECT_URI_KEY, redirectUri);
    
    // Nylas Hosted Auth URL
    const url = new URL("https://api.us.nylas.com/v3/connect/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("provider", "google");

    // If inside an iframe (Lovable preview), open in new tab instead of breaking the editor
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      window.open(url.toString(), "_blank");
      toast({
        title: "Gmail a abrir...",
        description: "Autentica no separador que abriu. Depois volta aqui e recarrega a página.",
      });
    } else {
      window.location.href = url.toString();
    }
  };

  const disconnectGmail = async () => {
    if (!connection) return;
    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("id", connection.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gmail desligado." });
      setConnection(null);
    }
  };

  if (!selectedCompany) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Gmail</CardTitle>
        </div>
        <CardDescription>
          Ligue a sua conta Gmail para procurar faturas automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A verificar...
          </div>
        ) : connection ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm">{connection.email_address || "Ligado"}</span>
            </div>
            <Button variant="outline" size="sm" onClick={disconnectGmail}>
              <Unlink className="mr-2 h-4 w-4" /> Desligar
            </Button>
          </div>
        ) : (
          <Button onClick={connectGmail} disabled={connecting} className="gap-2">
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {connecting ? "A ligar..." : "Ligar Gmail"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default GmailConnectionCard;
