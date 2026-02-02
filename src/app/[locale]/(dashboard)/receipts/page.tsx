"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, FileDown } from "lucide-react";

interface Receipt {
  id: string;
  receiptNo: string;
  amount: number;
  issuedAt: string;
  sentViaLine: boolean;
  invoice: {
    invoiceNo: string;
    project: { name: string };
    unit: { unitNumber: string };
    tenant: { name: string };
  };
}

export default function ReceiptsPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/receipts");
      const data = await res.json();
      setReceipts(data);
    } catch (error) {
      console.error("Error fetching receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("receiptNo")}</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("issuedAt")}</TableHead>
                <TableHead>LINE</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.receiptNo}</TableCell>
                    <TableCell>{receipt.invoice.invoiceNo}</TableCell>
                    <TableCell>{receipt.invoice.project.name}</TableCell>
                    <TableCell>{receipt.invoice.unit.unitNumber}</TableCell>
                    <TableCell>{receipt.invoice.tenant.name}</TableCell>
                    <TableCell>฿{receipt.amount.toLocaleString()}</TableCell>
                    <TableCell>{new Date(receipt.issuedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={receipt.sentViaLine ? "default" : "secondary"}>
                        {receipt.sentViaLine ? "Sent" : "Not Sent"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title={t("sendViaLine")}>
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("downloadPdf")}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
