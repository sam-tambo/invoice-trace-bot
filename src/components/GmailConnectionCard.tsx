import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Link2, Unlink, Loader2 } from "lucide-react";

const GmailConnectionCard = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [clientId, setClientId] = useState("");

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

  // Handle Nylas OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && selectedCompany && user) {
      window.history.replaceState({}, "", window.location.pathname);
      handleCallback(code);
    }
  }, [selectedCompany, user]);

  const handleCallback = async (code: string) => {
    if (!selectedCompany) return;
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/settings`;
      const { data, error } = await supabase.functions.invoke("gmail-auth-callback", {
        body: { code, redirect_uri: redirectUri, company_id: selectedCompany.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Gmail ligado!", description: `Conta: ${data.email_address}` });
      fetchConnection();
    } catch (err: any) {
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
    // Use the published URL for redirects so Nylas doesn't get blocked by iframe
    const publishedOrigin = "https://invoice-trace-bot.lovable.app";
    const redirectUri = `${publishedOrigin}/settings`;
    // Nylas Hosted Auth URL
    const url = new URL("https://api.us.nylas.com/v3/connect/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("provider", "google");
    // Open in top-level window to avoid iframe restrictions
    if (window.top) {
      window.top.location.href = url.toString();
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
