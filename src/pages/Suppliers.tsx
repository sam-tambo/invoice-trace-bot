import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Building2 } from "lucide-react";

type Supplier = Tables<"suppliers">;

const Suppliers = () => {
  const { selectedCompany } = useCompany();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("name");
      setSuppliers(data || []);
      setLoading(false);
    };
    fetch();
  }, [selectedCompany]);

  const filtered = suppliers.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.nif.includes(search)
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
              <TableHead>NIF</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Confiança</TableHead>
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
                  <TableCell className="font-medium">{s.legal_name || s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.nif}</TableCell>
                  <TableCell>{s.email || "—"}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>
                    {s.confidence_score != null ? (
                      <Badge variant={Number(s.confidence_score) >= 0.7 ? "default" : "secondary"} className={Number(s.confidence_score) >= 0.7 ? "bg-success text-success-foreground border-0" : ""}>
                        {Math.round(Number(s.confidence_score) * 100)}%
                      </Badge>
                    ) : (
                      "—"
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
