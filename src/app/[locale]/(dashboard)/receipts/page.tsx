"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, FileDown, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Receipt {
  id: string;
  receiptNo: string;
  amount: number;
  issuedAt: string;
  sentViaLine: boolean;
  invoice: {
    invoiceNo: string;
    tenantId: string;
    project: { name: string };
    unit: { unitNumber: string };
    tenant: { name: string };
  };
}

export default function ReceiptsPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [lineSendDialogOpen, setLineSendDialogOpen] = useState(false);
  const [lineSendReceipt, setLineSendReceipt] = useState<Receipt | null>(null);
  const [lineSendLang, setLineSendLang] = useState<"th" | "en">("th");
  const [lineSendFormat, setLineSendFormat] = useState<"image" | "pdf">("image");

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

  const openLineSendDialog = (receipt: Receipt) => {
    setLineSendReceipt(receipt);
    setLineSendLang("th");
    setLineSendFormat("image");
    setLineSendDialogOpen(true);
  };

  const handleSendViaLine = async () => {
    if (!lineSendReceipt) return;

    setSendingReceiptId(lineSendReceipt.id);
    setLineSendDialogOpen(false);

    try {
      const res = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptId: lineSendReceipt.id,
          lang: lineSendLang,
          format: lineSendFormat,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === "NO_LINE_CONTACT") {
          toast({
            title: t("sendError") || "Send Error",
            description: t("noLineContact") || "No LINE contact linked to this tenant",
            variant: "destructive",
          });
        } else {
          toast({
            title: t("sendError") || "Send Error",
            description: data.error || "Failed to send",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: t("sendSuccess") || "Sent Successfully",
        description: `${lineSendReceipt.receiptNo} ${t("sentToLine") || "sent via LINE"}`,
      });

      // Update local state
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === lineSendReceipt.id ? { ...r, sentViaLine: true } : r
        )
      );
    } catch (error) {
      console.error("Error sending via LINE:", error);
      toast({
        title: t("sendError") || "Send Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSendingReceiptId(null);
    }
  };

  const handleDownloadPdf = async (receipt: Receipt) => {
    setDownloadingReceiptId(receipt.id);

    try {
      const res = await fetch(`/api/receipts/${receipt.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: "th" }),
      });

      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to generate PDF",
          variant: "destructive",
        });
        return;
      }

      const data = await res.json();

      // Open the PDF URL in a new tab
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

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
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("sendViaLine")}
                          onClick={() => openLineSendDialog(receipt)}
                          disabled={sendingReceiptId === receipt.id}
                        >
                          {sendingReceiptId === receipt.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : receipt.sentViaLine ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("downloadPdf")}
                          onClick={() => handleDownloadPdf(receipt)}
                          disabled={downloadingReceiptId === receipt.id}
                        >
                          {downloadingReceiptId === receipt.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4" />
                          )}
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

      {/* LINE Send Dialog */}
      <Dialog open={lineSendDialogOpen} onOpenChange={setLineSendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sendViaLine")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("receiptFormat") || "Format"}</Label>
              <Select value={lineSendFormat} onValueChange={(v) => setLineSendFormat(v as "image" | "pdf")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">{t("sendAsImage") || "Image"}</SelectItem>
                  <SelectItem value="pdf">{t("sendAsPdf") || "PDF"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("receiptLanguage") || "Language"}</Label>
              <Select value={lineSendLang} onValueChange={(v) => setLineSendLang(v as "th" | "en")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="th">ไทย (Thai)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {lineSendReceipt && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">{lineSendReceipt.receiptNo}</p>
                <p className="text-xs text-muted-foreground">
                  {lineSendReceipt.invoice.tenant.name} - {lineSendReceipt.invoice.unit.unitNumber}
                </p>
                <p className="text-sm font-semibold mt-1 text-green-600">
                  ฿{lineSendReceipt.amount.toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLineSendDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSendViaLine}>
                <Send className="h-4 w-4 mr-2" />
                {t("sendViaLine")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
