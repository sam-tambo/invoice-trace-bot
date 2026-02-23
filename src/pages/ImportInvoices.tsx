import { useState, useRef } from "react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ImportInvoices = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState("");

  // Manual entry
  const [manualEntries, setManualEntries] = useState([
    { supplier_name: "", supplier_nif: "", invoice_number: "", amount: "", issue_date: "" },
  ]);

  const addManualRow = () => {
    setManualEntries([...manualEntries, { supplier_name: "", supplier_nif: "", invoice_number: "", amount: "", issue_date: "" }]);
  };

  const updateManualRow = (idx: number, field: string, value: string) => {
    const updated = [...manualEntries];
    (updated[idx] as any)[field] = value;
    setManualEntries(updated);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(/[,;\t]/);
      const row: any = {};
      headers.forEach((h, i) => {
        row[h] = values[i]?.trim() || "";
      });
      return {
        supplier_name: row["fornecedor"] || row["supplier"] || row["nome"] || "",
        supplier_nif: row["nif"] || row["vat"] || "",
        invoice_number: row["fatura"] || row["invoice"] || row["numero"] || row["nº"] || "",
        amount: row["valor"] || row["amount"] || row["montante"] || "",
        issue_date: row["data"] || row["date"] || "",
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  const submitInvoices = async (entries: { supplier_name: string; supplier_nif: string; invoice_number: string; amount: string; issue_date: string }[]) => {
    if (!selectedCompany || !user) return;
    setLoading(true);

    const valid = entries.filter((e) => e.invoice_number.trim());
    if (valid.length === 0) {
      toast({ title: "Erro", description: "Nenhuma fatura válida encontrada.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = valid.map((e) => ({
      company_id: selectedCompany.id,
      created_by: user.id,
      invoice_number: e.invoice_number.trim(),
      supplier_name: e.supplier_name.trim(),
      supplier_nif: e.supplier_nif.trim(),
      amount: e.amount ? parseFloat(e.amount) : null,
      issue_date: e.issue_date || null,
      status: "missing" as const,
    }));

    const { error } = await supabase.from("invoices").insert(rows);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Importação concluída", description: `${rows.length} faturas importadas.` });
      navigate("/invoices");
    }
    setLoading(false);
  };

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa primeiro.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Importar Faturas</h1>
        <p className="text-muted-foreground">Carregue um ficheiro CSV ou insira faturas manualmente.</p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv"><FileSpreadsheet className="mr-2 h-4 w-4" />Ficheiro CSV</TabsTrigger>
          <TabsTrigger value="manual"><Plus className="mr-2 h-4 w-4" />Entrada Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carregar CSV</CardTitle>
              <CardDescription>
                O ficheiro deve conter colunas: fornecedor, nif, fatura, valor, data. Separador: vírgula, ponto e vírgula ou tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar Ficheiro
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Ou cole o conteúdo CSV:</Label>
                <Textarea rows={8} placeholder="fornecedor;nif;fatura;valor;data&#10;Empresa ABC;123456789;FT 2025/001;150.00;2025-01-15" value={csvData} onChange={(e) => setCsvData(e.target.value)} />
              </div>
              <Button onClick={() => submitInvoices(parseCSV(csvData))} disabled={loading || !csvData.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar Faturas
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entrada Manual</CardTitle>
              <CardDescription>Adicione faturas uma a uma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualEntries.map((entry, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2">
                  <Input placeholder="Fornecedor" value={entry.supplier_name} onChange={(e) => updateManualRow(idx, "supplier_name", e.target.value)} />
                  <Input placeholder="NIF" value={entry.supplier_nif} onChange={(e) => updateManualRow(idx, "supplier_nif", e.target.value)} />
                  <Input placeholder="Nº Fatura" value={entry.invoice_number} onChange={(e) => updateManualRow(idx, "invoice_number", e.target.value)} />
                  <Input placeholder="Valor" type="number" value={entry.amount} onChange={(e) => updateManualRow(idx, "amount", e.target.value)} />
                  <Input placeholder="Data" type="date" value={entry.issue_date} onChange={(e) => updateManualRow(idx, "issue_date", e.target.value)} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addManualRow}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar Linha
                </Button>
                <Button size="sm" onClick={() => submitInvoices(manualEntries)} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ImportInvoices;
