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
import { Search, Filter, Eye } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import InvoiceContactDialog from "@/components/InvoiceContactDialog";

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

  useEffect(() => {
    fetchInvoices();
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
      <div>
        <h1 className="text-2xl font-bold">Faturas</h1>
        <p className="text-muted-foreground">Rastreie e acompanhe faturas em falta.</p>
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
    </div>
  );
};

export default Invoices;
