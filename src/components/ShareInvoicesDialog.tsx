import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ShareInvoicesDialog = ({ open, onClose }: Props) => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [existingLink, setExistingLink] = useState<any>(null);
  const [loadingLink, setLoadingLink] = useState(true);

  const fetchExisting = async () => {
    if (!selectedCompany) return;
    setLoadingLink(true);
    const { data } = await (supabase.from as any)("shared_links")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setExistingLink(data);
    setLoadingLink(false);
  };

  useEffect(() => {
    if (open) fetchExisting();
  }, [open, selectedCompany]);

  const createLink = async () => {
    if (!selectedCompany || !user || !password.trim()) return;
    setCreating(true);

    // Hash password server-side via RPC
    const { data, error } = await (supabase.rpc as any)("create_shared_link", {
      p_company_id: selectedCompany.id,
      p_created_by: user.id,
      p_password: password,
      p_label: "Contabilidade",
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link criado com sucesso!" });
      setPassword("");
      fetchExisting();
    }
    setCreating(false);
  };

  const deactivateLink = async () => {
    if (!existingLink) return;
    await (supabase.from as any)("shared_links")
      .update({ is_active: false })
      .eq("id", existingLink.id);
    setExistingLink(null);
    toast({ title: "Link desativado" });
  };

  const shareUrl = existingLink
    ? `${window.location.origin}/shared/${existingLink.token}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copiado!" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Partilhar Faturas</DialogTitle>
          <DialogDescription>
            Gere um link protegido por password para a contabilidade aceder e descarregar as faturas.
          </DialogDescription>
        </DialogHeader>

        {loadingLink ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingLink ? (
          <div className="space-y-4">
            <div>
              <Label>Link de partilha</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={shareUrl} className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O contabilista precisa da password que definiu quando criou o link.
            </p>
            <Button variant="destructive" size="sm" onClick={deactivateLink} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Desativar Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="share-pw">Password de acesso</Label>
              <Input
                id="share-pw"
                type="password"
                placeholder="Defina uma password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button onClick={createLink} disabled={creating || !password.trim()} className="w-full gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar Link Partilhado
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareInvoicesDialog;
