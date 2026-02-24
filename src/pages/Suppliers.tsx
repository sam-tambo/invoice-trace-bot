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
import { Search } from "lucide-react";

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

      // Aggregate invoices by supplier NIF
      const invoiceAgg = new Map<string, { count: number; total: number }>();
      (invoicesData || []).forEach((inv) => {
        if (!inv.supplier_nif) return;
        const existing = invoiceAgg.get(inv.supplier_nif) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(inv.amount) || 0;
        invoiceAgg.set(inv.supplier_nif, existing);
      });

      const enriched: SupplierWithInvoices[] = (suppliersData || []).map((s) => {
        const agg = invoiceAgg.get(s.nif) || { count: 0, total: 0 };
        return { ...s, invoiceCount: agg.count, invoiceTotal: agg.total };
      });

      setSuppliers(enriched);
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
      <div>
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <p className="text-muted-foreground">Dados dos fornecedores encontrados automaticamente.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por nome ou NIF..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-right">Faturas</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {loading ? "A carregar..." : "Nenhum fornecedor encontrado."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{s.legal_name || s.name}</span>
                      <span className="block text-xs text-muted-foreground font-mono">{s.nif}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.email || "—"}</TableCell>
                  <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                  <TableCell className="text-right">{s.invoiceCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {s.invoiceTotal > 0
                      ? `€${s.invoiceTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`
                      : "—"}
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
