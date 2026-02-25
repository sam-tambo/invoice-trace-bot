import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onComplete: () => void;
}

const CONFIDENCE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  exact_number: { label: "Número exacto", variant: "default" },
  ai_parsed: { label: "IA", variant: "secondary" },
  amount_match: { label: "Valor", variant: "outline" },
  likely: { label: "Provável", variant: "outline" },
};

const ScanGmailDialog = ({ open, onClose, companyId, onComplete }: Props) => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const startScan = async () => {
    setScanning(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("scan-gmail-invoices", {
        body: { company_id: companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data);
      if (data.invoices_matched > 0) {
        onComplete();
      }
    } catch (err: any) {
      toast({ title: "Erro ao procurar", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleClose = () => {
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Procurar no Email
          </DialogTitle>
          <DialogDescription>
            Procura emails de fornecedores com faturas em anexo e faz correspondência automática. Funciona com Gmail, Outlook e outros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!results && !scanning && (
            <Button onClick={startScan} className="w-full gap-2">
              <Mail className="h-4 w-4" /> Iniciar Pesquisa
            </Button>
          )}

          {scanning && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                A pesquisar emails e analisar anexos...
              </p>
              <p className="text-xs text-muted-foreground">Isto pode demorar alguns minutos.</p>
            </div>
          )}

          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="font-medium">Pesquisa concluída</span>
              </div>

              {results.warning && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{results.warning}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{results.emails_found}</p>
                  <p className="text-xs text-muted-foreground">Emails encontrados</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-success">{results.invoices_matched}</p>
                  <p className="text-xs text-muted-foreground">Faturas correspondidas</p>
                </div>
              </div>
              {results.details?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Detalhes:</p>
                  {results.details.map((d: any, i: number) => {
                    const conf = CONFIDENCE_LABELS[d.confidence] || CONFIDENCE_LABELS.likely;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs rounded border p-2">
                        <span>
                          Fatura <span className="font-mono font-medium">{d.invoice_number}</span>
                          {d.filename && d.filename !== "email_match" && (
                            <span className="text-muted-foreground"> — {d.filename}</span>
                          )}
                        </span>
                        <Badge variant={conf.variant} className="text-[10px] ml-2">
                          {conf.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
              <Button variant="outline" onClick={handleClose} className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScanGmailDialog;
