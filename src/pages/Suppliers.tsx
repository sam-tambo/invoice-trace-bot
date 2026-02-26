import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Pencil, Check, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Supplier = Tables<"suppliers">;
type Invoice = Tables<"invoices">;

interface SupplierWithInvoices extends Supplier {
  invoiceCount: number;
  invoiceTotal: number;
}

const Suppliers = () => {
  const { selectedCompany } = useCompany();
  const [suppliers, setSuppliers] = useState<SupplierWithInvoices[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });

  const startEdit = (s: SupplierWithInvoices) => {
    setEditingId(s.id);
    setEditEmail(s.email || "");
    setEditPhone(s.phone || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("suppliers")
      .update({ email: editEmail || null, phone: editPhone || null })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao guardar");
      return;
    }
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, email: editEmail || null, phone: editPhone || null } : s))
    );
    setEditingId(null);
    toast.success("Contacto atualizado");
  };

  const bulkEnrich = async () => {
    if (!selectedCompany) return;
    const toEnrich = suppliers.filter((s) => !s.lookup_success);
    if (toEnrich.length === 0) {
      toast.info("Todos os fornecedores já estão enriquecidos.");
      return;
    }
    setEnriching(true);
    setEnrichProgress({ done: 0, total: toEnrich.length });
    let success = 0;
    for (let i = 0; i < toEnrich.length; i++) {
      try {
        const { data } = await supabase.functions.invoke("nif-lookup", {
          body: { nif: toEnrich[i].nif, company_id: selectedCompany.id },
        });
        if (data?.success) success++;
      } catch {}
      setEnrichProgress({ done: i + 1, total: toEnrich.length });
    }
    setEnriching(false);
    toast.success(`${success} de ${toEnrich.length} fornecedores enriquecidos.`);
    // Reload data
    if (selectedCompany) {
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("name");
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("supplier_nif, amount")
        .eq("company_id", selectedCompany.id);
      const invoiceAgg = new Map<string, { count: number; total: number }>();
      (invoicesData || []).forEach((inv) => {
        if (!inv.supplier_nif) return;
        const existing = invoiceAgg.get(inv.supplier_nif) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(inv.amount) || 0;
        invoiceAgg.set(inv.supplier_nif, existing);
      });
      setSuppliers((suppliersData || []).map((s) => {
        const agg = invoiceAgg.get(s.nif) || { count: 0, total: 0 };
        return { ...s, invoiceCount: agg.count, invoiceTotal: agg.total };
      }));
    }
  };

  useEffect(() => {
    if (!selectedCompany) return;
    const fetchData = async () => {
      setLoading(true);
      const [{ data: suppliersData }, { data: invoicesData }] = await Promise.all([
        supabase
          .from("suppliers")
          .select("*")
          .eq("company_id", selectedCompany.id)
          .order("name"),
        supabase
          .from("invoices")
          .select("supplier_nif, amount")
          .eq("company_id", selectedCompany.id),
      ]);
      const invoiceAgg = new Map<string, { count: number; total: number }>();
      (invoicesData || []).forEach((inv) => {
        if (!inv.supplier_nif) return;
        const existing = invoiceAgg.get(inv.supplier_nif) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(inv.amount) || 0;
        invoiceAgg.set(inv.supplier_nif, existing);
      });
      setSuppliers((suppliersData || []).map((s) => {
        const agg = invoiceAgg.get(s.nif) || { count: 0, total: 0 };
        return { ...s, invoiceCount: agg.count, invoiceTotal: agg.total };
      }));
      setLoading(false);
    };
    fetchData();
  }, [selectedCompany]);

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.legal_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.nif.includes(search)
  );

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Dados dos fornecedores encontrados automaticamente.</p>
        </div>
        <Button onClick={bulkEnrich} disabled={enriching} variant="outline" className="gap-2">
          {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {enriching ? `A enriquecer (${enrichProgress.done}/${enrichProgress.total})` : "Enriquecer Todos"}
        </Button>
      </div>

      {enriching && (
        <Progress value={(enrichProgress.done / enrichProgress.total) * 100} className="h-2" />
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por nome ou NIF..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Faturas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {loading ? "A carregar..." : "Nenhum fornecedor encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="px-2">
                    {s.email ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" title="Email disponível" />
                    ) : s.phone ? (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning" title="Só telefone" />
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" title="Sem contacto" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-medium">{s.legal_name || s.name}</span>
                      <span className="block text-xs text-muted-foreground font-mono">{s.nif}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {editingId === s.id ? (
                      <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" placeholder="email@exemplo.pt" />
                    ) : (
                      s.email || "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {editingId === s.id ? (
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" placeholder="912345678" />
                    ) : (
                      s.phone || "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{s.invoiceCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.invoiceTotal > 0
                      ? `€${s.invoiceTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {editingId === s.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(s.id)} disabled={saving}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default Suppliers;
