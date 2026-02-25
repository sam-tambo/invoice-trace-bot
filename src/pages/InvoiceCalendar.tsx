import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { ChevronLeft, ChevronRight, Camera, Mail, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";

const statusColors: Record<string, string> = {
  missing: "bg-destructive",
  contacted: "bg-[hsl(var(--warning))]",
  received: "bg-[hsl(var(--success))]",
};

const statusLabels: Record<string, string> = {
  missing: "Em falta",
  contacted: "Contactado",
  received: "Recebida",
};

const sourceIcons: Record<string, typeof Camera> = {
  scan: Camera,
  email: Mail,
  manual: Pencil,
  import: Pencil,
};

const InvoiceCalendar = () => {
  const { selectedCompany } = useCompany();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: invoices = [] } = useQuery({
    queryKey: ["calendar-invoices", selectedCompany?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!selectedCompany) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .gte("issue_date", format(monthStart, "yyyy-MM-dd"))
        .lte("issue_date", format(monthEnd, "yyyy-MM-dd"))
        .order("issue_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany,
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  // Adjust for Monday start: Sunday (0) becomes 6, Mon (1) becomes 0, etc.
  const adjustedStartPad = startPad === 0 ? 6 : startPad - 1;

  const invoicesByDay = useMemo(() => {
    const map: Record<string, typeof invoices> = {};
    invoices.forEach((inv) => {
      if (inv.issue_date) {
        const key = inv.issue_date;
        if (!map[key]) map[key] = [];
        map[key].push(inv);
      }
    });
    return map;
  }, [invoices]);

  const selectedDayInvoices = selectedDay
    ? invoicesByDay[format(selectedDay, "yyyy-MM-dd")] || []
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário de Faturas</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} faturas em {format(currentMonth, "MMMM yyyy", { locale: pt })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center font-medium capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: pt })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${statusColors[key]}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Calendar grid */}
        <Card className="flex-1">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground mb-2">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: adjustedStartPad }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayInvoices = invoicesByDay[key] || [];
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors hover:bg-accent ${
                      isSelected ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    <span className={`text-xs ${isSelected ? "font-bold" : ""}`}>{day.getDate()}</span>
                    {dayInvoices.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayInvoices.slice(0, 3).map((inv, i) => (
                          <div key={i} className={`h-1.5 w-1.5 rounded-full ${statusColors[inv.status] || "bg-muted-foreground"}`} />
                        ))}
                        {dayInvoices.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayInvoices.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        {selectedDay && (
          <Card className="w-80 shrink-0">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                {format(selectedDay, "d 'de' MMMM", { locale: pt })}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedDayInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem faturas neste dia</p>
              ) : (
                selectedDayInvoices.map((inv) => {
                  const SourceIcon = sourceIcons[(inv as any).source] || Pencil;
                  return (
                    <div key={inv.id} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{inv.supplier_name}</span>
                        </div>
                        <Badge variant={inv.status === "received" ? "default" : inv.status === "contacted" ? "secondary" : "destructive"} className="text-[10px]">
                          {statusLabels[inv.status] || inv.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>NIF: {inv.supplier_nif || "—"}</span>
                        <span>Nº: {inv.invoice_number}</span>
                        {inv.amount != null && <span>Total: €{Number(inv.amount).toFixed(2)}</span>}
                        {inv.vat_amount != null && <span>IVA: €{Number(inv.vat_amount).toFixed(2)}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InvoiceCalendar;
