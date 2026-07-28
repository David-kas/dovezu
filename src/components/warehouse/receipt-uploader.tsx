"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface ReceiptUploaderProps {
  documentId: string;
  onUploaded: () => void;
}

export function ReceiptUploader({ documentId, onUploaded }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, pageNumber = 1) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pageNumber", String(pageNumber));

    try {
      const res = await fetch(`/api/documents/${documentId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Ошибка", description: data.error, variant: "destructive" });
        return;
      }

      if (data.needsManualEntry) {
        toast({
          title: "Чек загружен",
          description: "OCR не распознал строки — добавьте их на экране проверки",
        });
      } else {
        toast({
          title: "Чек обработан",
          description: `Распознано строк: ${data.ocr?.linesCount ?? 0}`,
        });
      }
      onUploaded();
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach((f, i) => uploadFile(f, i + 1));
    e.target.value = "";
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">Загрузить чек</p>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFiles} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <input ref={pdfRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={handleFiles} />

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-xs">Камера</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            disabled={uploading}
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs">Галерея</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-col h-auto py-4 gap-2"
            disabled={uploading}
            onClick={() => pdfRef.current?.click()}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">PDF / файл</span>
          </Button>
        </div>

        {uploading && (
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
            <Upload className="h-3 w-3" /> Обработка чека...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
