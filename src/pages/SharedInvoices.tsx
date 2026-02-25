import { useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Download, Lock, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  missing: { label: "Em Falta", variant: "destructive" },
  contacted: { label: "Contactada", variant: "secondary", className: "bg-amber-500 text-white border-0" },
  received: { label: "Recebida", variant: "default", className: "bg-emerald-500 text-white border-0" },
  closed: { label: "Fechada", variant: "outline" },
};

const rowColorMap: Record<string, string> = {
  missing: "border-l-4 border-l-red-400",
  contacted: "border-l-4 border-l-amber-400",
  received: "border-l-4 border-l-emerald-400",
  closed: "border-l-4 border-l-gray-400",
};

interface Invoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  supplier_nif: string;
  amount: number | null;
  net_amount: number | null;
  vat_amount: number | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
}

interface Attachment {
  id: string;
  invoice_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  public_url: string;
}

const SharedInvoices = () => {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleLogin = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError("");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/shared-invoices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao aceder");
        setLoading(false);
        return;
      }

      setCompanyName(data.company_name);
      setInvoices(data.invoices);
      setAttachments(data.attachments);
      setAuthenticated(true);
    } catch {
      setError("Erro de ligação");
    }
    setLoading(false);
  };

  const daysOutstanding = (inv: Invoice) => {
    const start = inv.issue_date ? new Date(inv.issue_date) : new Date(inv.created_at);
    return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAttachments = (invoiceId: string) =>
    attachments.filter((a) => a.invoice_id === invoiceId);

  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplier_nif.includes(search);
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const receivedCount = invoices.filter((i) => i.status === "received").length;
  const missingCount = invoices.filter((i) => i.status === "missing").length;

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Acesso às Faturas</h1>
            <p className="text-sm text-muted-foreground">
              Introduza a password para aceder às faturas partilhadas.
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aceder
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{companyName} — Faturas</h1>
          <p className="text-muted-foreground">
            {invoices.length} faturas · {receivedCount} recebidas · {missingCount} em falta
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por fornecedor, NIF ou nº fatura..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                <TableHead>Estado</TableHead>
                <TableHead>Ficheiro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Nenhuma fatura encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv) => {
                  const st = statusMap[inv.status] || statusMap.missing;
                  const files = getAttachments(inv.id);
                  return (
                    <TableRow key={inv.id} className={cn(rowColorMap[inv.status])}>
                      <TableCell className="font-medium">{inv.supplier_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.supplier_nif || "—"}</TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell className="text-right">
                        {inv.amount ? `€${Number(inv.amount).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>{daysOutstanding(inv)}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant} className={st.className}>
                          {st.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {files.length > 0 ? (
                          <div className="flex gap-1">
                            {files.map((f) => (
                              <a
                                key={f.id}
                                href={f.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                title={f.file_name}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default SharedInvoices;
