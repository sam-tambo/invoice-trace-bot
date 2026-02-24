import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

type Invoice = Tables<"invoices">;

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  missing: { label: "Em Falta", variant: "destructive" },
  contacted: { label: "Contactada", variant: "secondary", className: "bg-warning text-warning-foreground border-0" },
  received: { label: "Recebida", variant: "default", className: "bg-success text-success-foreground border-0" },
  closed: { label: "Fechada", variant: "outline" },
};

const DEFAULT_EMAIL_TEMPLATE = {
  subject: "Pedido de fatura em falta - {{invoice_number}}",
  body: `Exmo(a). Sr(a).,

Vimos por este meio solicitar o envio da fatura nº {{invoice_number}}, no valor de {{amount}}, referente ao fornecedor {{supplier_name}} (NIF: {{supplier_nif}}).

Agradecemos o envio com a maior brevidade possível.

Com os melhores cumprimentos,`,
};

const DEFAULT_SMS_TEMPLATE = {
  subject: "SMS - Pedido fatura {{invoice_number}}",
  body: `Olá, precisamos da fatura nº {{invoice_number}} ({{amount}}). Pode enviar por email? Obrigado.`,
};

function fillTemplate(text: string, invoice: Invoice) {
  return text
    .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
    .replace(/\{\{supplier_name\}\}/g, invoice.supplier_name || "—")
    .replace(/\{\{supplier_nif\}\}/g, invoice.supplier_nif || "—")
    .replace(/\{\{amount\}\}/g, invoice.amount ? `€${Number(invoice.amount).toFixed(2)}` : "—");
}

interface Props {
  invoice: Invoice | null;
  onClose: () => void;
  onStatusChange?: () => void;
}

export default function InvoiceContactDialog({ invoice, onClose, onStatusChange }: Props) {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [outreachLogs, setOutreachLogs] = useState<Tables<"outreach_logs">[]>([]);
  const [contactMode, setContactMode] = useState<"email" | "sms" | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [supplier, setSupplier] = useState<Tables<"suppliers"> | null>(null);

  useEffect(() => {
    if (!invoice) return;
    // Fetch outreach logs
    supabase
      .from("outreach_logs")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sent_at", { ascending: false })
      .then(({ data }) => setOutreachLogs(data || []));

    // Fetch supplier info for email/phone
    if (invoice.supplier_id) {
      supabase
        .from("suppliers")
        .select("*")
        .eq("id", invoice.supplier_id)
        .single()
        .then(({ data }) => setSupplier(data));
    } else if (invoice.supplier_nif && selectedCompany) {
      supabase
        .from("suppliers")
        .select("*")
        .eq("nif", invoice.supplier_nif)
        .eq("company_id", selectedCompany.id)
        .maybeSingle()
        .then(({ data }) => setSupplier(data));
    }

    setContactMode(null);
  }, [invoice]);

  const startContact = (mode: "email" | "sms") => {
    if (!invoice) return;
    const template = mode === "email" ? DEFAULT_EMAIL_TEMPLATE : DEFAULT_SMS_TEMPLATE;
    setContactMode(mode);
    setSubject(fillTemplate(template.subject, invoice));
    setBody(fillTemplate(template.body, invoice));
    setRecipient(mode === "email" ? (supplier?.email || "") : (supplier?.phone || ""));
  };

  const sendContact = async () => {
    if (!invoice || !selectedCompany) return;
    setSending(true);

    // Log the outreach
    const { error } = await supabase.from("outreach_logs").insert({
      invoice_id: invoice.id,
      company_id: selectedCompany.id,
      channel: contactMode || "email",
      recipient,
      subject,
      body,
      status: "sent",
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSending(false);
      return;
    }

    // Update invoice status to "contacted" and last_contact_at
    await supabase
      .from("invoices")
      .update({ status: "contacted", last_contact_at: new Date().toISOString() })
      .eq("id", invoice.id);

    toast({ title: "Contacto registado!", description: `${contactMode === "email" ? "Email" : "SMS"} enviado com sucesso.` });
    setSending(false);
    setContactMode(null);
    onStatusChange?.();

    // Refresh logs
    const { data } = await supabase
      .from("outreach_logs")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sent_at", { ascending: false });
    setOutreachLogs(data || []);
  };

  if (!invoice) return null;

  const st = statusMap[invoice.status] || statusMap.missing;

  return (
    <Dialog open={!!invoice} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fatura {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Fornecedor:</span> {invoice.supplier_name}</div>
            <div><span className="text-muted-foreground">NIF:</span> {invoice.supplier_nif}</div>
            <div><span className="text-muted-foreground">Valor:</span> {invoice.amount ? `€${Number(invoice.amount).toFixed(2)}` : "—"}</div>
            <div><span className="text-muted-foreground">Estado:</span> <Badge variant={st.variant} className={st.className}>{st.label}</Badge></div>
          </div>

          {/* Contact buttons */}
          {!contactMode && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Contactar Fornecedor</h4>
              <div className="flex gap-2">
                <Button variant="default" size="sm" onClick={() => startContact("email")}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Email
                </Button>
                <Button variant="secondary" size="sm" onClick={() => startContact("sms")}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar SMS
                </Button>
              </div>
            </div>
          )}

          {/* Contact form */}
          {contactMode && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  {contactMode === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  {contactMode === "email" ? "Compor Email" : "Compor SMS"}
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setContactMode(null)}>Cancelar</Button>
              </div>
              <div className="space-y-2">
                <Label>{contactMode === "email" ? "Email do destinatário" : "Telefone do destinatário"}</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={contactMode === "email" ? "fornecedor@email.com" : "+351 912 345 678"}
                />
              </div>
              {contactMode === "email" && (
                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea rows={contactMode === "email" ? 6 : 3} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <Button onClick={sendContact} disabled={sending || !recipient}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "A enviar..." : "Registar Contacto"}
              </Button>
            </div>
          )}

          {/* Outreach history */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Histórico de Contactos</h4>
            {outreachLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem contactos registados.</p>
            ) : (
              <div className="space-y-2">
                {outreachLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{log.subject || log.channel}</div>
                      {log.recipient && <div className="text-muted-foreground text-xs">{log.recipient}</div>}
                      <div className="text-muted-foreground text-xs">{format(new Date(log.sent_at), "dd MMM yyyy HH:mm", { locale: pt })}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{log.channel}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
