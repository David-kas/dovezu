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

/** Сжимает большие фото с телефона для лимита Vercel (~4 MB). */
async function prepareUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !file.name.match(/\.(jpe?g|png|webp|heic)$/i)) {
    return file;
  }
  if (file.size <= 1.5 * 1024 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    let { width, height } = bitmap;
    if (width > maxSide || height > maxSide) {
      if (width > height) {
        height = Math.round((height * maxSide) / width);
        width = maxSide;
      } else {
        width = Math.round((width * maxSide) / height);
        height = maxSide;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ReceiptUploader({ documentId, onUploaded }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, pageNumber = 1) {
    setUploading(true);
    try {
      const prepared = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append("file", prepared);
      formData.append("pageNumber", String(pageNumber));

      const res = await fetch(`/api/documents/${documentId}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Ошибка", description: data.error || "Не удалось загрузить", variant: "destructive" });
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
    } catch {
      toast({ title: "Ошибка сети", description: "Проверьте интернет и попробуйте снова", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    void (async () => {
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i]!, i + 1);
      }
    })();
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
