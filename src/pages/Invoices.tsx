import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, Eye, Send, UserSearch, Loader2, Mail, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import InvoiceContactDialog from "@/components/InvoiceContactDialog";
import BulkEmailDialog from "@/components/BulkEmailDialog";
import ScanGmailDialog from "@/components/ScanGmailDialog";
import ShareInvoicesDialog from "@/components/ShareInvoicesDialog";

type Invoice = Tables<"invoices">;

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  missing: { label: "Em Falta", variant: "destructive" },
  contacted: { label: "Contactada", variant: "secondary", className: "bg-warning text-warning-foreground border-0" },
  received: { label: "Recebida", variant: "default", className: "bg-success text-success-foreground border-0" },
  closed: { label: "Fechada", variant: "outline" },
};

const rowColorMap: Record<string, string> = {
  missing: "border-l-4 border-l-destructive",
  contacted: "border-l-4 border-l-warning",
  received: "border-l-4 border-l-success",
  closed: "border-l-4 border-l-muted-foreground",
};

const Invoices = () => {
  const { selectedCompany } = useCompany();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [suppliersWithEmail, setSuppliersWithEmail] = useState(0);
  const [lookupRunning, setLookupRunning] = useState(false);
  const [lookupProgress, setLookupProgress] = useState({ done: 0, total: 0 });
  const [gmailScanOpen, setGmailScanOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const { toast } = useToast();

  const fetchInvoices = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .order("created_at", { ascending: false });
    setInvoices(data || []);
    setLoading(false);
  };

  const fetchSuppliersWithEmail = async () => {
    if (!selectedCompany) return;
    const { count } = await supabase
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", selectedCompany.id)
      .not("email", "is", null);
    setSuppliersWithEmail(count || 0);
  };

  const bulkLookupSuppliers = async () => {
    if (!selectedCompany) return;
    // Find unique NIFs with no supplier_name
    const missingNifs = [...new Set(
      invoices.filter((inv) => !inv.supplier_name || inv.supplier_name === "").map((inv) => inv.supplier_nif)
    )].filter(Boolean);

    if (missingNifs.length === 0) {
      toast({ title: "Todos os fornecedores já têm nome." });
      return;
    }

    setLookupRunning(true);
    setLookupProgress({ done: 0, total: missingNifs.length });

    let successCount = 0;
    for (let i = 0; i < missingNifs.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("nif-lookup", {
          body: { nif: missingNifs[i], company_id: selectedCompany.id },
        });
        if (data?.success && data.supplier) {
          // Update invoice supplier_name + supplier_id locally
          const supplierName = data.supplier.name || data.supplier.legal_name || "";
          if (supplierName) {
            await supabase
              .from("invoices")
              .update({ supplier_name: supplierName, supplier_id: data.supplier.id })
              .eq("company_id", selectedCompany.id)
              .eq("supplier_nif", missingNifs[i]);
            successCount++;
          }
        }
      } catch (e) {
        console.error(`Lookup failed for ${missingNifs[i]}:`, e);
      }
      setLookupProgress({ done: i + 1, total: missingNifs.length });
    }

    setLookupRunning(false);
    toast({
      title: `Lookup concluído`,
      description: `${successCount} de ${missingNifs.length} fornecedores encontrados.`,
    });
    fetchInvoices();
  };

  const checkEmailConnection = async () => {
    if (!selectedCompany) return;
    const { data } = await supabase
      .from("email_connections")
      .select("id")
      .eq("company_id", selectedCompany.id)
      .maybeSingle();
    setHasEmail(!!data);
  };

  useEffect(() => {
    fetchInvoices();
    fetchSuppliersWithEmail();
    checkEmailConnection();
  }, [selectedCompany]);

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplier_nif.includes(search);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const daysOutstanding = (inv: Invoice) => {
    const start = inv.issue_date ? new Date(inv.issue_date) : new Date(inv.created_at);
    return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faturas</h1>
          <p className="text-muted-foreground">Rastreie e acompanhe faturas em falta.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={bulkLookupSuppliers}
            disabled={lookupRunning}
            className="gap-2"
          >
            {lookupRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
            {lookupRunning ? `A procurar (${lookupProgress.done}/${lookupProgress.total})` : "Procurar Fornecedores"}
          </Button>
          {hasEmail && (
            <Button variant="outline" onClick={() => setGmailScanOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" />
              Procurar no Email
            </Button>
          )}
          <Button onClick={() => setBulkOpen(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Pedir Todas em Falta
          </Button>
          <Button variant="outline" onClick={() => setShareOpen(true)} className="gap-2">
            <Share2 className="h-4 w-4" />
            Partilhar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por fornecedor, NIF ou nº fatura..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="missing">Em Falta</SelectItem>
            <SelectItem value="contacted">Contactada</SelectItem>
            <SelectItem value="received">Recebida</SelectItem>
            <SelectItem value="closed">Fechada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fornecedor</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Nº Fatura</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Último Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {loading ? "A carregar..." : "Nenhuma fatura encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const st = statusMap[inv.status] || statusMap.missing;
                return (
                  <TableRow key={inv.id} className={cn(rowColorMap[inv.status], "cursor-pointer hover:bg-muted/50")} onClick={() => setSelectedInvoice(inv)}>
                    <TableCell className="font-medium">{inv.supplier_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.supplier_nif || "—"}</TableCell>
                    <TableCell>{inv.invoice_number}</TableCell>
                    <TableCell className="text-right">{inv.amount ? `€${Number(inv.amount).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>{daysOutstanding(inv)}</TableCell>
                    <TableCell className="text-xs">{inv.last_contact_at ? format(new Date(inv.last_contact_at), "dd MMM yyyy", { locale: pt }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant} className={st.className}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <InvoiceContactDialog
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onStatusChange={fetchInvoices}
      />

      <BulkEmailDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        companyId={selectedCompany.id}
        missingCount={invoices.filter((i) => i.status === "missing").length}
        withEmailCount={suppliersWithEmail}
        onComplete={fetchInvoices}
      />

      <ScanGmailDialog
        open={gmailScanOpen}
        onClose={() => setGmailScanOpen(false)}
        companyId={selectedCompany.id}
        onComplete={fetchInvoices}
      />

      <ShareInvoicesDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
};

export default Invoices;
