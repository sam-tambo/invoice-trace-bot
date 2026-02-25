import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailConnectionCard from "@/components/EmailConnectionCard";

const SettingsPage = () => {
  const { user } = useAuth();
  const { companies, selectedCompany, refetch } = useCompany();
  const { toast } = useToast();
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNif, setNewNif] = useState("");
  const [loading, setLoading] = useState(false);

  const addCompany = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .insert({ name: newName, nif: newNif || null, created_by: user.id })
        .select()
        .single();
      if (error) throw error;

      await supabase.from("company_memberships").insert({ company_id: data.id, user_id: user.id, role: "owner" });
      await refetch();
      toast({ title: "Empresa adicionada!" });
      setNewCompanyOpen(false);
      setNewName("");
      setNewNif("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Definições</h1>
        <p className="text-muted-foreground">Gerir conta e empresas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Empresas</CardTitle>
            <Button size="sm" onClick={() => setNewCompanyOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nova Empresa
            </Button>
          </div>
          <CardDescription>Empresas associadas à sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                {c.nif && <p className="text-xs text-muted-foreground">NIF: {c.nif}</p>}
              </div>
              {selectedCompany?.id === c.id && (
                <span className="text-xs text-primary font-medium">Ativa</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <EmailConnectionCard />

      <Dialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Empresa Lda" />
            </div>
            <div className="space-y-2">
              <Label>NIF (opcional)</Label>
              <Input value={newNif} onChange={(e) => setNewNif(e.target.value)} placeholder="123456789" />
            </div>
            <Button className="w-full" onClick={addCompany} disabled={loading || !newName.trim()}>
              {loading ? "A criar..." : "Criar Empresa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
