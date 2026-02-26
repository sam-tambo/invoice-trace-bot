import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Link2, Unlink, Loader2, CheckCircle2, Plus } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Gmail",
  microsoft: "Outlook",
  yahoo: "Yahoo Mail",
  imap: "Email (IMAP)",
  gmail: "Gmail",
};

const EmailConnectionCard = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("email_connections")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .order("created_at", { ascending: true });
    setConnections(data || []);
    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Handle Nylas callback result from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailStatus = params.get("email");
    
    if (emailStatus === "connected") {
      const address = params.get("address");
      toast({ 
        title: "Email ligado com sucesso!", 
        description: address ? `Conta: ${address}` : "A conta foi ligada." 
      });
      window.history.replaceState({}, "", window.location.pathname);
      fetchConnections();
    } else if (emailStatus === "denied") {
      toast({ 
        title: "Autorização negada", 
        description: "Não autorizou o acesso ao email.", 
        variant: "destructive" 
      });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (emailStatus === "error") {
      const reason = params.get("reason");
      toast({ 
        title: "Erro ao ligar email", 
        description: reason || "Tente novamente.", 
        variant: "destructive" 
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connectEmail = async () => {
    if (!selectedCompany || !user) return;
    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("gmail-auth-callback", {
        body: { company_id: selectedCompany.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("No auth URL returned");

      const isInIframe = window.self !== window.top;
      if (isInIframe) {
        window.open(data.url, "_blank");
        toast({
          title: "Email a abrir...",
          description: "Autentica no separador que abriu. Depois volta aqui e recarrega a página.",
        });
      } else {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Connect email error:", err);
      toast({ 
        title: "Erro ao iniciar ligação", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectEmail = async (connectionId: string) => {
    const { error } = await supabase
      .from("email_connections")
      .delete()
      .eq("id", connectionId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email desligado." });
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    }
  };

  if (!selectedCompany) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Caixas de Correio</CardTitle>
        </div>
        <CardDescription>
          Ligue as suas contas de email (Gmail, Outlook, Yahoo) para procurar faturas automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> A verificar...
          </div>
        ) : (
          <>
            {connections.map((conn) => {
              const providerLabel = PROVIDER_LABELS[conn.provider] || "Email";
              return (
                <div key={conn.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {conn.email_address || "Ligado"}
                      <span className="text-muted-foreground ml-1">({providerLabel})</span>
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => disconnectEmail(conn.id)}>
                    <Unlink className="mr-2 h-4 w-4" /> Desligar
                  </Button>
                </div>
              );
            })}

            <Button onClick={connectEmail} disabled={connecting} variant={connections.length > 0 ? "outline" : "default"} className="gap-2">
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : connections.length > 0 ? (
                <Plus className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {connecting ? "A ligar..." : connections.length > 0 ? "Adicionar outra conta" : "Ligar Email"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailConnectionCard;
