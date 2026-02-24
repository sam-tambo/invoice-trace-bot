import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  missingCount: number;
  withEmailCount: number;
  onComplete: () => void;
}

const BulkEmailDialog = ({ open, onClose, companyId, missingCount, withEmailCount, onComplete }: Props) => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; total: number } | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: { company_id: companyId },
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Emails enviados!",
        description: `${data.sent} emails enviados, ${data.skipped} ignorados.`,
      });
      onComplete();
    } catch (err: any) {
      console.error("Bulk email error:", err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Pedir Faturas em Massa
          </DialogTitle>
          <DialogDescription>
            Enviar email a todos os fornecedores com faturas em falta.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold text-destructive">{missingCount}</div>
                <div className="text-sm text-muted-foreground">Faturas em falta</div>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold text-primary">{withEmailCount}</div>
                <div className="text-sm text-muted-foreground">Com email do fornecedor</div>
              </div>
            </div>

            {withEmailCount === 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Nenhum fornecedor com email configurado. Adicione emails na página de Fornecedores.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4">
              <CheckCircle className="h-6 w-6 text-success" />
              <div>
                <p className="font-medium">Envio concluído!</p>
                <p className="text-sm text-muted-foreground">
                  {result.sent} enviados, {result.skipped} sem email
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || withEmailCount === 0}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A enviar...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar {withEmailCount} emails
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkEmailDialog;
