import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Inbox as InboxIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Paperclip,
  FileCheck,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";
import InboxMessageDetail from "@/components/InboxMessageDetail";

interface InboxMessage {
  id: string;
  company_id: string;
  invoice_id: string | null;
  supplier_nif: string | null;
  direction: string;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean | null;
  attachments_parsed: boolean | null;
  matched_invoice_id: string | null;
  status: string;
  created_at: string;
}

const Inbox = () => {
  const { selectedCompany } = useCompany();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);

  const fetchMessages = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .order("created_at", { ascending: false });
    setMessages((data as InboxMessage[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedCompany]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedCompany) return;
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inbox_messages",
          filter: `company_id=eq.${selectedCompany.id}`,
        },
        (payload) => {
          setMessages((prev) => [payload.new as InboxMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompany]);

  const filtered = messages.filter((msg) => {
    const term = search.toLowerCase();
    return (
      (msg.from_email || "").toLowerCase().includes(term) ||
      (msg.to_email || "").toLowerCase().includes(term) ||
      (msg.subject || "").toLowerCase().includes(term) ||
      (msg.supplier_nif || "").includes(term)
    );
  });

  const unreadCount = messages.filter((m) => m.status === "new" && m.direction === "inbound").length;

  const handleMarkRead = async (msg: InboxMessage) => {
    if (msg.status === "new") {
      await supabase.from("inbox_messages").update({ status: "read" }).eq("id", msg.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "read" } : m))
      );
    }
    setSelectedMessage(msg);
  };

  if (!selectedCompany) {
    return <p className="text-muted-foreground py-10 text-center">Selecione uma empresa.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <InboxIcon className="h-6 w-6" />
            Caixa de Entrada
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Emails enviados e respostas dos fornecedores.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por email, assunto ou NIF..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>De / Para</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  {loading ? "A carregar..." : "Nenhuma mensagem encontrada."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((msg) => (
                <TableRow
                  key={msg.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50",
                    msg.status === "new" && msg.direction === "inbound" && "bg-primary/5 font-semibold"
                  )}
                  onClick={() => handleMarkRead(msg)}
                >
                  <TableCell>
                    {msg.direction === "inbound" ? (
                      <ArrowDownLeft className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {msg.direction === "inbound" ? msg.from_email : msg.to_email}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">
                    <div className="flex items-center gap-2">
                      {msg.subject || "(sem assunto)"}
                      {msg.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {msg.matched_invoice_id && <FileCheck className="h-3 w-3 text-success shrink-0" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{msg.supplier_nif || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(msg.created_at), "dd MMM HH:mm", { locale: pt })}
                  </TableCell>
                  <TableCell>
                    {msg.status === "new" && msg.direction === "inbound" ? (
                      <Badge variant="destructive" className="text-xs">Nova</Badge>
                    ) : msg.matched_invoice_id ? (
                      <Badge className="bg-success text-success-foreground border-0 text-xs">Fatura detectada</Badge>
                    ) : msg.direction === "outbound" ? (
                      <Badge variant="secondary" className="text-xs">Enviado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{msg.status === "read" ? "Lida" : msg.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <InboxMessageDetail
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />
    </div>
  );
};

export default Inbox;
