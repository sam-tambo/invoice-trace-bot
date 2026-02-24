import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowDownLeft, ArrowUpRight, Paperclip, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface InboxMessage {
  id: string;
  direction: string;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean | null;
  attachments_parsed: boolean | null;
  matched_invoice_id: string | null;
  supplier_nif: string | null;
  status: string;
  created_at: string;
}

interface Props {
  message: InboxMessage | null;
  onClose: () => void;
}

const InboxMessageDetail = ({ message, onClose }: Props) => {
  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {message.direction === "inbound" ? (
              <ArrowDownLeft className="h-5 w-5 text-primary" />
            ) : (
              <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
            )}
            {message.subject || "(sem assunto)"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">De:</span>{" "}
              <span className="font-medium">{message.from_email || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Para:</span>{" "}
              <span className="font-medium">{message.to_email || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>{" "}
              {format(new Date(message.created_at), "dd MMM yyyy, HH:mm", { locale: pt })}
            </div>
            <div>
              <span className="text-muted-foreground">NIF:</span>{" "}
              <span className="font-mono">{message.supplier_nif || "—"}</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            {message.has_attachments && (
              <Badge variant="outline" className="gap-1">
                <Paperclip className="h-3 w-3" /> Anexos
              </Badge>
            )}
            {message.matched_invoice_id && (
              <Badge className="bg-success text-success-foreground border-0 gap-1">
                <FileCheck className="h-3 w-3" /> Fatura detectada automaticamente
              </Badge>
            )}
            {message.attachments_parsed && (
              <Badge variant="secondary" className="gap-1">
                Anexos processados por IA
              </Badge>
            )}
          </div>

          <Separator />

          {/* Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {message.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">{message.body_text || "(sem conteúdo)"}</pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InboxMessageDetail;
