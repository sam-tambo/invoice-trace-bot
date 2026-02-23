import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, ArrowRight } from "lucide-react";

const Onboarding = () => {
  const { user } = useAuth();
  const { refetch } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [companyNif, setCompanyNif] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: companyName, nif: companyNif || null, created_by: user.id })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create membership
      const { error: membershipError } = await supabase
        .from("company_memberships")
        .insert({ company_id: company.id, user_id: user.id, role: "owner" });

      if (membershipError) throw membershipError;

      await refetch();
      toast({ title: "Empresa criada!", description: "Pode começar a importar faturas." });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Configurar Empresa</CardTitle>
          <CardDescription>Adicione os dados da sua empresa para começar a rastrear faturas em falta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input id="company-name" placeholder="Empresa Lda" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-nif">NIF (opcional)</Label>
              <Input id="company-nif" placeholder="123456789" value={companyNif} onChange={(e) => setCompanyNif(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "A criar..." : "Criar Empresa"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
