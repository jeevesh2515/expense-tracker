"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Upload, FileImage, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { parseReceiptText } from "@/lib/ocr/parse-receipt";

type Props = {
  onExtracted: (data: {
    title: string | null;
    amount: number | null;
    date: string | null;
    category: string | null;
  }) => void;
  onImageReady?: (dataUrl: string) => void;
  disabled?: boolean;
};

export function ImageUpload({ onExtracted, onImageReady, disabled }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }

    // Show preview and pass image data to parent
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      onImageReady?.(dataUrl);
    };
    reader.readAsDataURL(file);

    setIsProcessing(true);
    setIsDone(false);

    try {
      // Dynamically import Tesseract.js to avoid SSR issues
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");

      const { data } = await worker.recognize(file);
      await worker.terminate();

      const rawText = data.text;

      if (!rawText || rawText.trim().length < 5) {
        toast.info("Screenshot attached! OCR text wasn't clear, please enter details manually.");
        setIsProcessing(false);
        setIsDone(true);
        return;
      }

      // Parse the OCR text to extract transaction details
      const parsed = parseReceiptText(rawText);

      onExtracted({
        title: parsed.title,
        amount: parsed.amount,
        date: parsed.date,
        category: parsed.category,
      });

      setIsProcessing(false);
      setIsDone(true);
      toast.success("Receipt scanned! Check the form fields below.");
    } catch (err) {
      console.error("OCR error:", err);
      toast.error("Failed to process image. Please try again.");
      setIsProcessing(false);
    }
  }, [onExtracted, onImageReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }, [handleFile]);

  const clearImage = useCallback(() => {
    setPreview(null);
    setIsDone(false);
    setIsProcessing(false);
    onImageReady?.("");
    onExtracted({ title: null, amount: null, date: null, category: null });
  }, [onImageReady, onExtracted]);

  if (isDone && preview) {
    return (
      <div className="border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            Receipt scanned successfully! Fields have been pre-filled below.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearImage}
            className="ml-auto text-green-600 hover:text-green-800 dark:text-green-400"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !isProcessing && !disabled && fileInputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
        ${isProcessing
          ? "border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10"
          : "border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Scanning receipt...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Extracting text and transaction details
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {preview ? (
            <FileImage className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          ) : (
            <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {preview ? "Processing..." : "Upload receipt or screenshot"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Drag & drop or click to browse • JPG, PNG up to 10 MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


