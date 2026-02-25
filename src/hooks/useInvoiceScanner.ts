import { useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";

interface ExtractedInvoice {
  id: string;
  supplier_name: string;
  supplier_nif: string;
  invoice_number: string;
  issue_date: string | null;
  due_date: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  amount: number | null;
  raw_image_url: string | null;
  extraction_confidence: string | null;
  extraction_notes: string | null;
}

export function useInvoiceScanner() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExtractedInvoice | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();

  const openCamera = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileCapture = useCallback(
    async (file: File) => {
      if (!selectedCompany) {
        toast({ title: "Erro", description: "Selecione uma empresa primeiro.", variant: "destructive" });
        return;
      }

      setScanning(true);
      setImagePreview(URL.createObjectURL(file));

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke("invoice-extract-image", {
          body: {
            image_base64: base64,
            media_type: file.type || "image/jpeg",
            company_id: selectedCompany.id,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setResult(data.invoice);
        toast({ title: "Fatura extraída", description: `Confiança: ${data.invoice.extraction_confidence}` });
      } catch (err: any) {
        console.error("Scan error:", err);
        toast({ title: "Erro na digitalização", description: err.message || "Tente novamente.", variant: "destructive" });
      } finally {
        setScanning(false);
      }
    },
    [selectedCompany, toast]
  );

  const reset = useCallback(() => {
    setResult(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return { fileInputRef, scanning, result, imagePreview, openCamera, handleFileCapture, reset };
}
