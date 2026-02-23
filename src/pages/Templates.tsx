import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Template = Tables<"message_templates">;

const Templates = () => {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const fetchTemplates = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .order("day_trigger");
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedCompany]);

  const openNew = () => {
    setEditing({
      name: "",
      subject: "",
      body: "",
      tone: "formal",
      day_trigger: 0,
      is_default: false,
    });
    setEditOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditing({ ...t });
    setEditOpen(true);
  };

  const save = async () => {
    if (!selectedCompany || !editing) return;
    const payload = {
      company_id: selectedCompany.id,
      name: editing.name || "",
      subject: editing.subject || "",
      body: editing.body || "",
      tone: editing.tone || "formal",
      day_trigger: editing.day_trigger || 0,
      is_default: editing.is_default || false,
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase.from("message_templates").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("message_templates").insert(payload));
    }

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Guardado!" });
      setEditOpen(false);
      fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("message_templates").delete().eq("id", id);
    fetchTemplates();
  };

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modelos de Mensagem</h1>
          <p className="text-muted-foreground">Templates de email/SMS para contactar fornecedores.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />Novo Modelo
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(t)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{t.name}</CardTitle>
                <span className="text-xs text-muted-foreground">Dia {t.day_trigger}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">{t.subject}</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{t.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-muted">{t.tone === "formal" ? "Formal" : "Amigável"}</span>
                {t.is_default && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Padrão</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && !loading && (
          <p className="text-muted-foreground col-span-full text-center py-10">Nenhum modelo criado.</p>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Modelo" : "Novo Modelo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Pedido inicial" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia de Envio</Label>
                  <Input type="number" value={editing.day_trigger ?? 0} onChange={(e) => setEditing({ ...editing, day_trigger: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Tom</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-sm">Formal</span>
                    <Switch checked={editing.tone === "friendly"} onCheckedChange={(c) => setEditing({ ...editing, tone: c ? "friendly" : "formal" })} />
                    <span className="text-sm">Amigável</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={editing.subject || ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Pedido de fatura em falta - {{invoice_number}}" />
              </div>
              <div className="space-y-2">
                <Label>Corpo</Label>
                <Textarea rows={6} value={editing.body || ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="Exmo(a). Sr(a).,&#10;&#10;Vimos por este meio solicitar...&#10;&#10;Placeholders: {{supplier_name}}, {{invoice_number}}, {{amount}}" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_default || false} onCheckedChange={(c) => setEditing({ ...editing, is_default: c })} />
                <Label>Modelo padrão</Label>
              </div>
              <div className="flex justify-between">
                {editing.id && (
                  <Button variant="destructive" size="sm" onClick={() => { deleteTemplate(editing.id!); setEditOpen(false); }}>
                    <Trash2 className="mr-2 h-4 w-4" />Eliminar
                  </Button>
                )}
                <Button className="ml-auto" onClick={save}>
                  <Save className="mr-2 h-4 w-4" />Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
