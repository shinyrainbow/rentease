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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Plus, Send, FileDown, Eye, Loader2, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Unit {
  id: string;
  unitNumber: string;
  projectId: string;
  project: { name: string };
  tenant: { name: string } | null;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  status: string;
  billingMonth: string;
  dueDate: string;
  subtotal: number;
  withholdingTax: number;
  totalAmount: number;
  paidAmount: number;
  sentViaLine: boolean;
  project: { name: string };
  unit: { unitNumber: string };
  tenant: { name: string };
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [formData, setFormData] = useState({
    unitId: "",
    type: "RENT",
    billingMonth: new Date().toISOString().slice(0, 7),
    dueDate: "",
  });
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const [invoicesRes, unitsRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`),
        fetch("/api/units"),
      ]);
      const [invoicesData, unitsData] = await Promise.all([invoicesRes.json(), unitsRes.json()]);
      setInvoices(invoicesData);
      setUnits(unitsData.filter((u: Unit) => u.tenant !== null));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    }
  };

  const resetForm = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(15);

    setFormData({
      unitId: "",
      type: "RENT",
      billingMonth: new Date().toISOString().slice(0, 7),
      dueDate: nextMonth.toISOString().split("T")[0],
    });
  };

  const handleSendViaLine = async (invoice: Invoice) => {
    setSendingInvoiceId(invoice.id);
    try {
      const res = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === "NO_LINE_CONTACT") {
          toast({
            title: t("sendError"),
            description: t("noLineContact"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("sendError"),
            description: data.error || "Failed to send",
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: t("sendSuccess"),
        description: `${invoice.invoiceNo} ${t("sentToLine")}`,
      });

      // Update local state to reflect sent status
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id ? { ...inv, sentViaLine: true } : inv
        )
      );
    } catch (error) {
      console.error("Error sending via LINE:", error);
      toast({
        title: t("sendError"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "PARTIAL": return "bg-blue-100 text-blue-800";
      case "PAID": return "bg-green-100 text-green-800";
      case "OVERDUE": return "bg-red-100 text-red-800";
      case "CANCELLED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <div className="flex gap-4">
          <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tCommon("all")}</SelectItem>
              <SelectItem value="PENDING">{t("statuses.PENDING")}</SelectItem>
              <SelectItem value="PARTIAL">{t("statuses.PARTIAL")}</SelectItem>
              <SelectItem value="PAID">{t("statuses.PAID")}</SelectItem>
              <SelectItem value="OVERDUE">{t("statuses.OVERDUE")}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                {t("createInvoice")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createInvoice")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.unitId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.project.name} - {unit.unitNumber} ({unit.tenant?.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RENT">{t("types.RENT")}</SelectItem>
                      <SelectItem value="UTILITY">{t("types.UTILITY")}</SelectItem>
                      <SelectItem value="COMBINED">{t("types.COMBINED")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("billingMonth")}</Label>
                    <Input
                      type="month"
                      value={formData.billingMonth}
                      onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("dueDate")}</Label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="submit">{tCommon("create")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceNo")}</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("billingMonth")}</TableHead>
                <TableHead>{t("totalAmount")}</TableHead>
                <TableHead>{t("paidAmount")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead className="sticky right-0 bg-background">{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                    <TableCell>{invoice.project.name}</TableCell>
                    <TableCell>{invoice.unit.unitNumber}</TableCell>
                    <TableCell>{invoice.tenant.name}</TableCell>
                    <TableCell>{t(`types.${invoice.type}`)}</TableCell>
                    <TableCell>{invoice.billingMonth}</TableCell>
                    <TableCell>฿{invoice.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>฿{invoice.paidAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(invoice.status)}>
                        {t(`statuses.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background">
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" title={t("viewInvoice")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t("sendViaLine")}
                          onClick={() => handleSendViaLine(invoice)}
                          disabled={sendingInvoiceId === invoice.id}
                        >
                          {sendingInvoiceId === invoice.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : invoice.sentViaLine ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" title={t("downloadPdf")}>
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
