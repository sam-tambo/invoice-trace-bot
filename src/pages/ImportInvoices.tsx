import { useState, useRef, useCallback } from "react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Search, CheckCircle2, XCircle, FileUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ParsedInvoice = {
  supplier_nif: string;
  issue_date: string;
  invoice_number: string;
  net_amount: number;
  vat_amount: number;
  amount: number;
};

type InvoiceRow = ParsedInvoice & {
  selected: boolean;
  supplierFound: boolean | null; // null = not checked yet
  lookingUp: boolean;
};

const ImportInvoices = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "review">("upload");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkLooking, setBulkLooking] = useState(false);
  const [rows, setRows] = useState<InvoiceRow[]>([]);

  // Check which NIFs already exist as suppliers with email
  const checkSuppliers = useCallback(
    async (invoices: ParsedInvoice[]) => {
      if (!selectedCompany) return invoices.map((inv) => ({ ...inv, selected: true, supplierFound: null, lookingUp: false }));

      const uniqueNifs = [...new Set(invoices.map((i) => i.supplier_nif).filter(Boolean))];
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("nif, email")
        .eq("company_id", selectedCompany.id)
        .in("nif", uniqueNifs);

      const foundMap = new Map<string, boolean>();
      suppliers?.forEach((s) => {
        foundMap.set(s.nif, !!s.email);
      });

      return invoices.map((inv) => ({
        ...inv,
        selected: true,
        supplierFound: foundMap.has(inv.supplier_nif) ? foundMap.get(inv.supplier_nif)! : false,
        lookingUp: false,
      }));
    },
    [selectedCompany]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-efatura-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast({ title: "Erro", description: data.error || "Falha ao processar PDF", variant: "destructive" });
        return;
      }

      const enriched = await checkSuppliers(data.invoices);
      setRows(enriched);
      setStep("review");
      toast({ title: "PDF processado", description: `${data.invoices.length} faturas extraídas.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Falha ao enviar ficheiro.", variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const handleImport = async () => {
    if (!selectedCompany || !user) return;
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos uma fatura.", variant: "destructive" });
      return;
    }

    setImporting(true);
    const insertRows = selected.map((r) => ({
      company_id: selectedCompany.id,
      created_by: user.id,
      invoice_number: r.invoice_number,
      supplier_name: "",
      supplier_nif: r.supplier_nif,
      amount: r.amount,
      net_amount: r.net_amount,
      vat_amount: r.vat_amount,
      issue_date: r.issue_date || null,
      status: "missing" as const,
    }));

    const { error } = await supabase.from("invoices").insert(insertRows);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setImporting(false);
      return;
    }

    toast({ title: "Importação concluída", description: `${insertRows.length} faturas importadas. A enriquecer fornecedores...` });

    // Auto-enrich: find unique NIFs not yet in suppliers table
    const uniqueNifs = [...new Set(selected.map((r) => r.supplier_nif).filter(Boolean))];
    const { data: existingSuppliers } = await supabase
      .from("suppliers")
      .select("nif")
      .eq("company_id", selectedCompany.id)
      .in("nif", uniqueNifs);

    const existingNifSet = new Set((existingSuppliers || []).map((s) => s.nif));
    const newNifs = uniqueNifs.filter((nif) => !existingNifSet.has(nif));

    if (newNifs.length > 0) {
      let enriched = 0;
      for (const nif of newNifs) {
        try {
          const { data } = await supabase.functions.invoke("nif-lookup", {
            body: { nif, company_id: selectedCompany.id },
          });
          if (data?.success) enriched++;
        } catch {
          // Continue with next
        }
      }
      if (enriched > 0) {
        toast({ title: "Fornecedores enriquecidos", description: `${enriched} de ${newNifs.length} novos fornecedores encontrados automaticamente.` });
      }
    }

    setImporting(false);
    navigate("/invoices");
  };

  const lookupSingleNif = async (idx: number) => {
    if (!selectedCompany) return;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, lookingUp: true } : r)));

    try {
      const { data, error } = await supabase.functions.invoke("nif-lookup", {
        body: { nif: rows[idx].supplier_nif, company_id: selectedCompany.id },
      });

      if (error || !data?.success) {
        toast({ title: "Erro", description: data?.error || "Falha na pesquisa", variant: "destructive" });
      } else {
        const hasEmail = !!data.supplier?.email;
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, supplierFound: hasEmail } : r))
        );
        toast({
          title: hasEmail ? "Fornecedor encontrado!" : "Fornecedor encontrado (sem email)",
          description: `${data.supplier.name || data.supplier.legal_name}`,
        });
      }
    } catch {
      toast({ title: "Erro", description: "Falha na pesquisa do NIF", variant: "destructive" });
    } finally {
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, lookingUp: false } : r)));
    }
  };

  const bulkLookup = async () => {
    if (!selectedCompany) return;
    const unmatched = rows
      .map((r, i) => ({ ...r, idx: i }))
      .filter((r) => !r.supplierFound && r.supplier_nif);
    const uniqueNifs = [...new Set(unmatched.map((r) => r.supplier_nif))];

    if (uniqueNifs.length === 0) {
      toast({ title: "Info", description: "Todos os fornecedores já foram encontrados." });
      return;
    }

    setBulkLooking(true);
    let found = 0;

    for (const nif of uniqueNifs) {
      try {
        const { data } = await supabase.functions.invoke("nif-lookup", {
          body: { nif, company_id: selectedCompany.id },
        });
        const hasEmail = !!data?.supplier?.email;
        if (data?.success) {
          found++;
          setRows((prev) =>
            prev.map((r) => (r.supplier_nif === nif ? { ...r, supplierFound: hasEmail } : r))
          );
        }
      } catch {
        // Continue with next NIF
      }
    }

    toast({ title: "Pesquisa concluída", description: `${found}/${uniqueNifs.length} fornecedores encontrados.` });
    setBulkLooking(false);
  };

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa primeiro.</p>;
  }

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Faturas</h1>
        <p className="text-muted-foreground">
          Carregue o mapa de conferência e-Fatura (PDF do TOConline) para importar faturas pendentes.
        </p>
      </div>

      {step === "upload" && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Carregar PDF</CardTitle>
            <CardDescription>
              Selecione o ficheiro "Mapa de conferência e-Fatura" exportado do TOConline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">A processar PDF com IA...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste o ficheiro PDF aqui
                  </p>
                  <p className="text-xs text-muted-foreground">Formatos: PDF (TOConline)</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing || !someSelected}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileUp className="mr-2 h-4 w-4" />
                Importar Selecionadas ({rows.filter((r) => r.selected).length})
              </Button>
              <Button variant="outline" onClick={bulkLookup} disabled={bulkLooking}>
                {bulkLooking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Search className="mr-2 h-4 w-4" />
                Procurar Fornecedores em Massa
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStep("upload"); setRows([]); }}>
              Novo Upload
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) => toggleAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Doc. Compra</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Fornecedor?</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => (
                      <TableRow key={idx} className={!row.selected ? "opacity-50" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={() => toggleRow(idx)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.supplier_nif}</TableCell>
                        <TableCell className="text-sm">{row.invoice_number}</TableCell>
                        <TableCell className="text-sm">{row.issue_date}</TableCell>
                        <TableCell className="text-right text-sm">
                          {row.net_amount?.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.vat_amount?.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {row.amount?.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €
                        </TableCell>
                        <TableCell className="text-center">
                          {row.supplierFound === true ? (
                            <CheckCircle2 className="h-5 w-5 text-primary mx-auto" />
                          ) : row.supplierFound === false ? (
                            <XCircle className="h-5 w-5 text-destructive mx-auto" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => lookupSingleNif(idx)}
                            disabled={row.lookingUp || row.supplierFound === true}
                            title="Procurar fornecedor"
                          >
                            {row.lookingUp ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportInvoices;
