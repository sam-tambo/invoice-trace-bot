import { Camera, Loader2, CheckCircle2, AlertTriangle, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInvoiceScanner } from "@/hooks/useInvoiceScanner";

const confidenceConfig = {
  high: { label: "Alta", icon: CheckCircle2, className: "bg-green-100 text-green-800 border-green-300" },
  medium: { label: "Média", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  low: { label: "Baixa", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300" },
};

const ScanInvoice = () => {
  const { fileInputRef, scanning, result, imagePreview, openCamera, handleFileCapture, reset } = useInvoiceScanner();

  const confidence = result?.extraction_confidence as keyof typeof confidenceConfig;
  const conf = confidence ? confidenceConfig[confidence] : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Digitalizar Fatura</h1>
        <p className="text-sm text-muted-foreground">Tire uma foto ou selecione uma imagem para extrair dados automaticamente.</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileCapture(file);
        }}
      />

      {!result && !scanning && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={openCamera}>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Digitalizar Fatura</p>
              <p className="text-sm text-muted-foreground">Toque para abrir a câmara ou selecionar imagem</p>
            </div>
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">A analisar fatura...</p>
              <p className="text-sm text-muted-foreground">A IA está a extrair os dados do documento</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {conf && (
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${conf.className}`}>
              <conf.icon className="h-5 w-5" />
              <span className="text-sm font-medium">Confiança da extração: {conf.label}</span>
            </div>
          )}

          {imagePreview && (
            <Card>
              <CardContent className="p-2">
                <img src={imagePreview} alt="Fatura digitalizada" className="w-full rounded-lg object-contain max-h-64" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Extraídos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Fornecedor", value: result.supplier_name },
                { label: "NIF", value: result.supplier_nif },
                { label: "Nº Fatura", value: result.invoice_number },
                { label: "Data Emissão", value: result.issue_date },
                { label: "Data Vencimento", value: result.due_date },
                { label: "Valor Líquido", value: result.net_amount != null ? `€${Number(result.net_amount).toFixed(2)}` : null },
                { label: "IVA", value: result.vat_amount != null ? `€${Number(result.vat_amount).toFixed(2)}` : null },
                { label: "Total", value: result.amount != null ? `€${Number(result.amount).toFixed(2)}` : null },
              ].map((field) => (
                <div key={field.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-medium text-foreground">{field.value || "—"}</span>
                </div>
              ))}
              {result.extraction_notes && (
                <div className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <strong>Notas:</strong> {result.extraction_notes}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Digitalizar outra
            </Button>
            <Button className="flex-1" onClick={() => window.location.href = "/calendar"}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Ver Calendário
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ScanInvoice;
