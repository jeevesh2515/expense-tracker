"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ScanLine } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SplitForm, type OcrPrefill } from "@/components/SplitForm";
import { ImageUpload } from "@/components/ImageUpload";

type Props = {
  projectId: string;
  projectName: string;
  currencyCode: string;
  currencySymbol: string;
  people: { id: string; name: string; colorHex: string }[];
  defaultPaidById: string | null;
};

export function NewTransactionClient({
  projectId,
  projectName,
  currencyCode,
  currencySymbol,
  people,
  defaultPaidById,
}: Props) {
  const [ocrData, setOcrData] = useState<OcrPrefill | null>(null);
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold">New transaction</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Currency: {currencyCode} ({currencySymbol})
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/transactions`}
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </CardHeader>
        <CardBody>
          {/* OCR Image Upload */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ScanLine className="w-4 h-4 text-brand-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick scan (optional)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Upload a receipt or screenshot to auto-fill the fields below
            </p>
            <ImageUpload
              onExtracted={(data) => setOcrData(data)}
              onImageReady={(dataUrl) => setReceiptImageData(dataUrl)}
            />
          </div>

          {/* Transaction Form */}
          <SplitForm
            projectId={projectId}
            people={people}
            currencySymbol={currencySymbol}
            currencyCode={currencyCode}
            defaultPaidById={defaultPaidById}
            ocrData={ocrData}
            receiptImage={receiptImageData}
          />
        </CardBody>
      </Card>
    </div>
  );
}
