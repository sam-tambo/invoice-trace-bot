import type { Tables } from "@/integrations/supabase/types";
import { Mail, Phone, Globe, MapPin, Building2, BadgeCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Supplier = Tables<"suppliers">;

interface SupplierCardProps {
  supplier: Supplier;
}

export default function SupplierCard({ supplier }: SupplierCardProps) {
  const hasContact = supplier.email || supplier.phone;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{supplier.legal_name || supplier.name || "Empresa Desconhecida"}</p>
          {supplier.alias && supplier.alias !== supplier.name && (
            <p className="text-xs text-muted-foreground">{supplier.alias}</p>
          )}
          <p className="text-xs text-muted-foreground font-mono">NIF {supplier.nif}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {supplier.status === "active" && (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">Ativa</Badge>
          )}
          {supplier.legal_nature && (
            <Badge variant="outline" className="text-xs">{supplier.legal_nature}</Badge>
          )}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5 text-sm">
        {supplier.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{supplier.email}</span>
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 ml-auto shrink-0">✓ Email</Badge>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{supplier.phone}</span>
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 ml-auto shrink-0">✓ Telefone</Badge>
          </div>
        )}
        {supplier.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
              {supplier.website}
            </a>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{supplier.address}{supplier.city ? `, ${supplier.city}` : ""}{supplier.postal_code ? ` ${supplier.postal_code}` : ""}</span>
          </div>
        )}
        {supplier.cae && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">CAE {supplier.cae}{supplier.activity_description ? ` — ${supplier.activity_description}` : ""}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {supplier.lookup_success ? (
        <div className="flex items-center gap-1.5 text-xs pt-1 border-t">
          {hasContact ? (
            <>
              <BadgeCheck className="h-3.5 w-3.5 text-success" />
              <span className="text-success">Pronto para contacto via {supplier.email ? "email" : "telefone"}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-warning">Sem contacto disponível — requer intervenção manual</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs pt-1 border-t">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">Empresa não encontrada no NIF.pt</span>
        </div>
      )}
    </div>
  );
}
