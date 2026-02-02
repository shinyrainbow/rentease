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
import { Separator } from "@/components/ui/separator";
import { Plus, Send, FileDown, Eye, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

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

interface InvoiceDetail extends Invoice {
  discountAmount: number;
  lineItems: LineItem[] | null;
  notes: string | null;
  createdAt: string;
  project: {
    name: string;
    nameTh: string | null;
    companyName: string | null;
    companyNameTh: string | null;
    companyAddress: string | null;
    taxId: string | null;
  };
  unit: { unitNumber: string };
  tenant: {
    name: string;
    nameTh: string | null;
    phone: string | null;
    email: string | null;
    taxId: string | null;
  };
}

interface LineItem {
  description: string;
  amount: number;
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

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

  const handleViewInvoice = async (invoice: Invoice) => {
    setLoadingInvoice(true);
    setViewDialogOpen(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load invoice details",
          variant: "destructive",
        });
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice details",
        variant: "destructive",
      });
      setViewDialogOpen(false);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to load invoice for PDF",
          variant: "destructive",
        });
        return;
      }
      const data: InvoiceDetail = await res.json();
      generatePdf(data);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const generatePdf = (invoice: InvoiceDetail) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Company header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(invoice.project.companyName || invoice.project.name, pageWidth / 2, y, { align: "center" });
    y += 8;

    if (invoice.project.companyAddress) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    if (invoice.project.taxId) {
      doc.text(`Tax ID: ${invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 10;

    // Invoice title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", pageWidth / 2, y, { align: "center" });
    y += 12;

    // Invoice details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: ${invoice.invoiceNo}`, 20, y);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, pageWidth - 60, y);
    y += 6;
    doc.text(`Billing Month: ${invoice.billingMonth}`, 20, y);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, pageWidth - 60, y);
    y += 12;

    // Bill to section
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(invoice.tenant.name, 20, y);
    y += 5;
    doc.text(`Unit: ${invoice.unit.unitNumber}`, 20, y);
    y += 5;
    if (invoice.tenant.phone) {
      doc.text(`Phone: ${invoice.tenant.phone}`, 20, y);
      y += 5;
    }
    if (invoice.tenant.taxId) {
      doc.text(`Tax ID: ${invoice.tenant.taxId}`, 20, y);
      y += 5;
    }
    y += 10;

    // Line items table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, pageWidth - 40, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Description", 25, y + 6);
    doc.text("Amount", pageWidth - 45, y + 6, { align: "right" });
    y += 12;

    // Line items
    doc.setFont("helvetica", "normal");
    const lineItems = invoice.lineItems || [{ description: t(`types.${invoice.type}`), amount: invoice.subtotal }];
    lineItems.forEach((item: LineItem) => {
      doc.text(item.description, 25, y);
      doc.text(`${item.amount.toLocaleString()} THB`, pageWidth - 45, y, { align: "right" });
      y += 7;
    });

    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    // Totals
    doc.text("Subtotal:", pageWidth - 80, y);
    doc.text(`${invoice.subtotal.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
    y += 7;

    if (invoice.discountAmount > 0) {
      doc.text("Discount:", pageWidth - 80, y);
      doc.text(`-${invoice.discountAmount.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
      y += 7;
    }

    if (invoice.withholdingTax > 0) {
      doc.text("Withholding Tax:", pageWidth - 80, y);
      doc.text(`-${invoice.withholdingTax.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
      y += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Total:", pageWidth - 80, y);
    doc.text(`${invoice.totalAmount.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
    y += 10;

    if (invoice.paidAmount > 0) {
      doc.setFont("helvetica", "normal");
      doc.text("Paid Amount:", pageWidth - 80, y);
      doc.text(`${invoice.paidAmount.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
      y += 7;

      const balance = invoice.totalAmount - invoice.paidAmount;
      doc.setFont("helvetica", "bold");
      doc.text("Balance Due:", pageWidth - 80, y);
      doc.text(`${balance.toLocaleString()} THB`, pageWidth - 25, y, { align: "right" });
    }

    // Status badge
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.text(`Status: ${invoice.status}`, 20, y);

    // Notes
    if (invoice.notes) {
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 20, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.text(invoice.notes, 20, y);
    }

    // Download
    doc.save(`Invoice-${invoice.invoiceNo}.pdf`);
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t("viewInvoice")}
                          onClick={() => handleViewInvoice(invoice)}
                        >
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title={t("downloadPdf")}
                          onClick={() => handleDownloadPdf(invoice)}
                        >
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

      {/* Invoice Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("viewInvoice")}</DialogTitle>
          </DialogHeader>
          {loadingInvoice ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedInvoice ? (
            <div className="space-y-6">
              {/* Company Header */}
              <div className="text-center">
                <h3 className="text-xl font-bold">
                  {selectedInvoice.project.companyName || selectedInvoice.project.name}
                </h3>
                {selectedInvoice.project.companyAddress && (
                  <p className="text-sm text-muted-foreground">{selectedInvoice.project.companyAddress}</p>
                )}
                {selectedInvoice.project.taxId && (
                  <p className="text-sm text-muted-foreground">Tax ID: {selectedInvoice.project.taxId}</p>
                )}
              </div>

              <Separator />

              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("invoiceNo")}</p>
                  <p className="font-medium">{selectedInvoice.invoiceNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tCommon("status")}</p>
                  <Badge className={getStatusBadgeColor(selectedInvoice.status)}>
                    {t(`statuses.${selectedInvoice.status}`)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("billingMonth")}</p>
                  <p className="font-medium">{selectedInvoice.billingMonth}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("dueDate")}</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              <Separator />

              {/* Tenant Info */}
              <div>
                <h4 className="font-semibold mb-2">{t("billTo") || "Bill To"}</h4>
                <p className="font-medium">{selectedInvoice.tenant.name}</p>
                <p className="text-sm text-muted-foreground">Unit: {selectedInvoice.unit.unitNumber}</p>
                {selectedInvoice.tenant.phone && (
                  <p className="text-sm text-muted-foreground">Phone: {selectedInvoice.tenant.phone}</p>
                )}
                {selectedInvoice.tenant.taxId && (
                  <p className="text-sm text-muted-foreground">Tax ID: {selectedInvoice.tenant.taxId}</p>
                )}
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <h4 className="font-semibold mb-2">{t("lineItems") || "Items"}</h4>
                <div className="space-y-2">
                  {(selectedInvoice.lineItems || [{ description: t(`types.${selectedInvoice.type}`), amount: selectedInvoice.subtotal }]).map((item: LineItem, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.description}</span>
                      <span>฿{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{t("subtotal") || "Subtotal"}</span>
                  <span>฿{selectedInvoice.subtotal.toLocaleString()}</span>
                </div>
                {selectedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("discount") || "Discount"}</span>
                    <span>-฿{selectedInvoice.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.withholdingTax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("withholdingTax") || "Withholding Tax"}</span>
                    <span>-฿{selectedInvoice.withholdingTax.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>{t("totalAmount")}</span>
                  <span>฿{selectedInvoice.totalAmount.toLocaleString()}</span>
                </div>
                {selectedInvoice.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>{t("paidAmount")}</span>
                      <span>฿{selectedInvoice.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>{t("balanceDue") || "Balance Due"}</span>
                      <span>฿{(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {selectedInvoice.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">{t("notes") || "Notes"}</h4>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  {tCommon("close") || "Close"}
                </Button>
                <Button onClick={() => generatePdf(selectedInvoice)}>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t("downloadPdf")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
