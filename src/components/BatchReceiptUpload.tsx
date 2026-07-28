"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileImage, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { parseReceiptText } from "@/lib/ocr/parse-receipt";
import type { SplitFormPerson } from "@/components/SplitForm";

export type BatchReceiptItem = {
  id: string;
  file: File;
  dataUrl: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  // Extracted data (editable)
  title: string;
  amount: string; // display string (e.g., "45.00")
  date: string; // YYYY-MM-DD
  category: string;
  paidById: string;
  // Raw OCR text for reference
  rawText?: string;
};

type Props = {
  projectId: string;
  people: SplitFormPerson[];
  defaultPaidById: string | null;
  currencySymbol: string;
  currencyCode: string;
  onComplete: (items: BatchReceiptItem[]) => void;
};

export function BatchReceiptUpload({
  projectId,
  people,
  defaultPaidById,
  currencySymbol,
  currencyCode,
  onComplete,
}: Props) {
  const [items, setItems] = useState<BatchReceiptItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File, worker: any): Promise<BatchReceiptItem> => {
    const id = crypto.randomUUID();

    // Create data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const baseItem: BatchReceiptItem = {
      id,
      file,
      dataUrl,
      status: "processing",
      title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      category: "",
      paidById: defaultPaidById ?? people[0]?.id ?? "",
    };

    try {
      const { data } = await worker.recognize(file);

      const rawText = data.text;
      if (!rawText || rawText.trim().length < 5) {
        return { ...baseItem, status: "error", error: "Could not read text from image", rawText };
      }

      const parsed = parseReceiptText(rawText);

      // Convert cents to display string
      let amountStr = "";
      if (parsed.amount != null && parsed.amount > 0) {
        const whole = Math.floor(parsed.amount / 100);
        const frac = parsed.amount % 100;
        amountStr = frac === 0 && whole > 0 ? String(whole) : `${whole}.${frac.toString().padStart(2, "0")}`;
      }

      return {
        ...baseItem,
        status: "done",
        title: parsed.title ?? baseItem.title,
        amount: amountStr,
        date: parsed.date ?? baseItem.date,
        category: parsed.category ?? "",
        rawText,
      };
    } catch (err) {
      console.error("OCR error:", err);
      return { ...baseItem, status: "error", error: "Failed to process image" };
    }
  }, [defaultPaidById, people]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Please select image files (JPG, PNG, etc.)");
      return;
    }

    setIsProcessing(true);
    const newItems: BatchReceiptItem[] = [];

    try {
      // Create a single worker and reuse for all files
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");

      // Process files sequentially to avoid memory issues
      for (const file of imageFiles) {
        const item = await processFile(file, worker);
        newItems.push(item);
        // Update state incrementally so user sees progress
        setItems((prev) => [...prev, item]);
      }

      await worker.terminate();

      const successCount = newItems.filter((i) => i.status === "done").length;
      const errorCount = newItems.filter((i) => i.status === "error").length;

      if (successCount > 0) {
        toast.success(`Processed ${successCount} receipt${successCount > 1 ? "s" : ""}${errorCount > 0 ? ` (${errorCount} failed)` : ""}`);
      } else {
        toast.error("Failed to process any receipts");
      }
    } catch (err) {
      console.error("Batch OCR error:", err);
      toast.error("Failed to process receipts");
    } finally {
      setIsProcessing(false);
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = "";
  }, [handleFiles]);

  const updateItem = useCallback((id: string, updates: Partial<BatchReceiptItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleSubmitAll = useCallback(() => {
    const validItems = items.filter((i) => i.status === "done" && i.title && i.amount);
    if (validItems.length === 0) {
      toast.error("No valid transactions to create");
      return;
    }
    onComplete(validItems);
  }, [items, onComplete]);

  const allDone = items.length > 0 && items.every((i) => i.status !== "processing");
  const validCount = items.filter((i) => i.status === "done" && i.title && i.amount).length;

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isProcessing
            ? "border-brand-300 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-900/10"
            : "border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Scanning receipts...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Processing {items.length} receipt{items.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload multiple receipts
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Drag & drop or click to browse • Select multiple files • JPG, PNG up to 10 MB each
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Receipt List */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {items.length} receipt{items.length !== 1 ? "s" : ""} uploaded
            </h3>
            {allDone && (
              <Button
                onClick={handleSubmitAll}
                disabled={validCount === 0}
                size="sm"
              >
                Create {validCount} Transaction{validCount !== 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {items.map((item) => (
            <ReceiptCard
              key={item.id}
              item={item}
              people={people}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              isExpanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onUpdate={(updates) => updateItem(item.id, updates)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Individual Receipt Card
// ============================================================

function ReceiptCard({
  item,
  people,
  currencySymbol,
  currencyCode,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  item: BatchReceiptItem;
  people: SplitFormPerson[];
  currencySymbol: string;
  currencyCode: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<BatchReceiptItem>) => void;
  onRemove: () => void;
}) {
  const statusIcon = item.status === "done"
    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    : item.status === "error"
      ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      : item.status === "processing"
        ? <Loader2 className="w-4 h-4 text-brand-500 animate-spin shrink-0" />
        : <FileImage className="w-4 h-4 text-gray-400 shrink-0" />;

  return (
    <Card className={item.status === "error" ? "border-red-200 dark:border-red-800" : ""}>
      <CardBody className="p-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {item.title || "Untitled"}
              </span>
              {item.amount && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currencySymbol}{item.amount}
                </span>
              )}
            </div>
            {item.status === "error" && item.error && (
              <p className="text-xs text-red-500 dark:text-red-400">{item.error}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded Edit Form */}
        {isExpanded && item.status !== "processing" && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Title</Label>
                <Input
                  value={item.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  placeholder="Transaction title"
                />
              </div>
              <div>
                <Label>Amount ({currencyCode})</Label>
                <Input
                  value={item.amount}
                  onChange={(e) => onUpdate({ amount: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={item.date}
                  onChange={(e) => onUpdate({ date: e.target.value })}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={item.category}
                  onChange={(e) => onUpdate({ category: e.target.value })}
                  placeholder="Food, Travel..."
                />
              </div>
              <div className="col-span-2">
                <Label>Paid by</Label>
                <Select
                  value={item.paidById}
                  onChange={(e) => onUpdate({ paidById: e.target.value })}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Preview thumbnail */}
            <div className="flex items-center gap-3">
              <img
                src={item.dataUrl}
                alt={item.title}
                className="w-16 h-16 rounded object-cover border border-gray-200 dark:border-gray-700"
              />
              {item.rawText && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">OCR Text:</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.rawText.slice(0, 100)}...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
