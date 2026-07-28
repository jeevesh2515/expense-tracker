"use client";

import { useState } from "react";
import { Download, FileImage, AlertCircle } from "lucide-react";

type Props = {
  receiptImage: string;
  title: string;
};

export function ReceiptImageThumbnail({ receiptImage, title }: Props) {
  const [hasError, setHasError] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = receiptImage;
    link.download = `receipt-${title.replace(/[^a-zA-Z0-9]/g, "-")}.png`;
    link.click();
  };

  if (hasError) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <p className="text-xs">Receipt image could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileImage className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Receipt Image
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          Download
        </button>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="block text-left group"
      >
        <img
          src={receiptImage}
          alt={`Receipt for ${title}`}
          className="max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 object-contain cursor-pointer hover:shadow-md transition-shadow group-hover:opacity-90"
          onError={() => setHasError(true)}
        />
      </button>
    </div>
  );
}
