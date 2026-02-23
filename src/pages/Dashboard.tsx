import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceStats {
  total: number;
  missing: number;
  contacted: number;
  received: number;
  closed: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [stats, setStats] = useState<InvoiceStats>({ total: 0, missing: 0, contacted: 0, received: 0, closed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany) return;

    const fetchStats = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("status")
        .eq("company_id", selectedCompany.id);

      if (!error && data) {
        const s: InvoiceStats = { total: data.length, missing: 0, contacted: 0, received: 0, closed: 0 };
        data.forEach((inv) => {
          if (inv.status in s) s[inv.status as keyof Omit<InvoiceStats, "total">]++;
        });
        setStats(s);
      }
      setLoading(false);
    };

    fetchStats();
  }, [selectedCompany]);

  const recoveryRate = stats.total > 0 ? Math.round(((stats.received + stats.closed) / stats.total) * 100) : 0;

  const statCards = [
    { title: "Total de Faturas", value: stats.total, icon: FileText, color: "text-primary" },
    { title: "Em Falta", value: stats.missing, icon: AlertCircle, color: "text-destructive" },
    { title: "Contactadas", value: stats.contacted, icon: Clock, color: "text-warning" },
    { title: "Recebidas", value: stats.received + stats.closed, icon: CheckCircle2, color: "text-success" },
  ];

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Bem-vindo ao InvoiceTrace</h2>
        <p className="text-muted-foreground">Crie uma empresa para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="text-muted-foreground">Resumo de recuperação de faturas para {selectedCompany.name}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recovery progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Taxa de Recuperação</CardTitle>
            <Badge variant={recoveryRate === 100 ? "default" : "secondary"} className={recoveryRate === 100 ? "bg-success text-success-foreground" : ""}>
              {recoveryRate}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={recoveryRate} className={recoveryRate === 100 ? "[&>div]:bg-success" : ""} />
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.received + stats.closed} de {stats.total} faturas recuperadas
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
