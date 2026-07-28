"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Layers } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BatchReceiptUpload, type BatchReceiptItem } from "@/components/BatchReceiptUpload";
import { batchCreateTransactionsAction } from "@/lib/actions/transaction-actions";
import { toast } from "sonner";

type Props = {
  projectId: string;
  projectName: string;
  currencyCode: string;
  currencySymbol: string;
  people: { id: string; name: string; colorHex: string }[];
  defaultPaidById: string | null;
};

export function BatchTransactionClient({
  projectId,
  projectName,
  currencyCode,
  currencySymbol,
  people,
  defaultPaidById,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async (items: BatchReceiptItem[]) => {
    setIsSubmitting(true);

    try {
      const transactions = items.map((item) => ({
        title: item.title,
        amount: item.amount,
        date: item.date,
        category: item.category || null,
        paidById: item.paidById,
        receiptImage: item.dataUrl,
      }));

      const result = await batchCreateTransactionsAction(projectId, transactions);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Created ${result.count} transaction${result.count !== 1 ? "s" : ""}!`);
        router.push(`/projects/${projectId}/transactions`);
        router.refresh();
      }
    } catch (err) {
      console.error("Batch creation error:", err);
      toast.error("Failed to create transactions");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold">Batch upload receipts</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload multiple receipts to create transactions in bulk • {currencyCode} ({currencySymbol})
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
          <BatchReceiptUpload
            projectId={projectId}
            people={people}
            defaultPaidById={defaultPaidById}
            currencySymbol={currencySymbol}
            currencyCode={currencyCode}
            onComplete={handleComplete}
          />

          {isSubmitting && (
            <div className="mt-4 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-brand-500 animate-pulse" />
                <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  Creating transactions...
                </span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
