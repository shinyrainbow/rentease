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
import { Input } from "@/components/ui/input";
import { Send, FileDown, Loader2, Check, Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
}

interface PaidInvoice {
  id: string;
  invoiceNo: string;
  totalAmount: number;
  project: { name: string };
  unit: { unitNumber: string };
  tenant: { name: string };
  receipt: { id: string } | null;
}

interface Receipt {
  id: string;
  receiptNo: string;
  amount: number;
  issuedAt: string;
  sentViaLine: boolean;
  invoice: {
    invoiceNo: string;
    tenantId: string;
    project: {
      name: string;
      companyName: string | null;
      companyNameTh: string | null;
      taxId: string | null;
    };
    unit: { unitNumber: string };
    tenant: {
      name: string;
      tenantType: string;
      taxId: string | null;
    };
  };
}

interface ReceiptDetail {
  id: string;
  receiptNo: string;
  amount: number;
  issuedAt: string;
  sentViaLine: boolean;
  createdAt: string;
  invoice: {
    invoiceNo: string;
    type: string;
    billingMonth: string;
    subtotal: number;
    withholdingTax: number;
    totalAmount: number;
    lineItems: { description: string; amount: number }[] | null;
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
      tenantType: string;
      phone: string | null;
      email: string | null;
      taxId: string | null;
    };
  };
}

export default function ReceiptsPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [lineSendDialogOpen, setLineSendDialogOpen] = useState(false);
  const [lineSendReceipt, setLineSendReceipt] = useState<Receipt | null>(null);
  const [lineSendLang, setLineSendLang] = useState<"th" | "en">("th");
  const [lineSendFormat, setLineSendFormat] = useState<"image" | "pdf">("image");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("receiptNo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetail | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Create receipt state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    invoiceId: "",
    amount: "",
    issuedAt: new Date().toISOString().split("T")[0],
  });

  const fetchData = async () => {
    try {
      const [receiptsRes, projectsRes] = await Promise.all([
        fetch("/api/receipts"),
        fetch("/api/projects"),
      ]);
      const [receiptsData, projectsData] = await Promise.all([
        receiptsRes.json(),
        projectsRes.json(),
      ]);
      setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  // Filter receipts by project and search query
  const filteredReceipts = receipts.filter((receipt) => {
    // Project filter
    if (projectFilter && receipt.invoice.project.name !== projectFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        receipt.receiptNo.toLowerCase().includes(query) ||
        receipt.invoice.invoiceNo.toLowerCase().includes(query) ||
        receipt.invoice.tenant.name.toLowerCase().includes(query) ||
        receipt.invoice.unit.unitNumber.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Sort filtered receipts
  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "receiptNo":
        aVal = a.receiptNo;
        bVal = b.receiptNo;
        break;
      case "invoiceNo":
        aVal = a.invoice.invoiceNo;
        bVal = b.invoice.invoiceNo;
        break;
      case "project":
        aVal = a.invoice.project.companyName || a.invoice.project.name;
        bVal = b.invoice.project.companyName || b.invoice.project.name;
        break;
      case "unit":
        aVal = a.invoice.unit.unitNumber;
        bVal = b.invoice.unit.unitNumber;
        break;
      case "tenant":
        aVal = a.invoice.tenant.name;
        bVal = b.invoice.tenant.name;
        break;
      case "amount":
        aVal = a.amount;
        bVal = b.amount;
        break;
      case "issuedAt":
        aVal = new Date(a.issuedAt).getTime();
        bVal = new Date(b.issuedAt).getTime();
        break;
      default:
        return 0;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === "asc"
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch paid invoices without receipts
  const fetchPaidInvoices = async (projectId?: string) => {
    try {
      const params = new URLSearchParams({ status: "PAID" });
      if (projectId) params.append("projectId", projectId);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out invoices that already have receipts
        const invoicesWithoutReceipts = data.filter((inv: PaidInvoice) => !inv.receipt);
        setPaidInvoices(invoicesWithoutReceipts);
      }
    } catch (error) {
      console.error("Error fetching paid invoices:", error);
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateFormData({
      invoiceId: "",
      amount: "",
      issuedAt: new Date().toISOString().split("T")[0],
    });
    setSelectedProjectId("");
    fetchPaidInvoices();
    setIsCreateOpen(true);
  };

  const handleProjectChangeForCreate = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCreateFormData((prev) => ({ ...prev, invoiceId: "" }));
    if (projectId && projectId !== "__all__") {
      fetchPaidInvoices(projectId);
    } else {
      fetchPaidInvoices();
    }
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.invoiceId) return;

    setCreatingReceipt(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: createFormData.invoiceId,
          amount: createFormData.amount ? parseFloat(createFormData.amount) : undefined,
          issuedAt: createFormData.issuedAt,
        }),
      });

      if (res.ok) {
        toast({
          title: t("receiptCreated") || "Receipt Created",
          description: t("receiptCreatedDesc") || "Receipt has been created successfully",
        });
        setIsCreateOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error") || "Error",
          description: data.error || "Failed to create receipt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating receipt:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setCreatingReceipt(false);
    }
  };

  const selectedInvoiceForReceipt = paidInvoices.find((inv) => inv.id === createFormData.invoiceId);

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

  const handleViewReceipt = async (receipt: Receipt) => {
    setLoadingReceipt(true);
    setViewDialogOpen(true);
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReceipt(data);
      } else {
        toast({
          title: tCommon("error") || "Error",
          description: "Failed to load receipt details",
          variant: "destructive",
        });
        setViewDialogOpen(false);
      }
    } catch (error) {
      console.error("Error fetching receipt:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Failed to load receipt details",
        variant: "destructive",
      });
      setViewDialogOpen(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  if (loading) {
    return <PageSkeleton columns={7} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createReceipt") || "สร้างใบเสร็จ"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder") || "Search receipt, invoice, tenant..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter || "__all__"} onValueChange={(v) => setProjectFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allProjects") || "All Projects"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allProjects") || "All Projects"}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.name}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("receiptNo")}>
                  <div className="flex items-center">{t("receiptNo")}<SortIcon column="receiptNo" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("invoiceNo")}>
                  <div className="flex items-center">{t("invoice")}<SortIcon column="invoiceNo" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project")}>
                  <div className="flex items-center">{t("projectCompany")}<SortIcon column="project" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                  <div className="flex items-center">{t("unit")}<SortIcon column="unit" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("tenant")}>
                  <div className="flex items-center">{t("tenantCompany")}<SortIcon column="tenant" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                  <div className="flex items-center">{t("amount")}<SortIcon column="amount" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("issuedAt")}>
                  <div className="flex items-center">{t("issuedAt")}<SortIcon column="issuedAt" /></div>
                </TableHead>
                <TableHead>LINE</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedReceipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedReceipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.receiptNo}</TableCell>
                    <TableCell>{receipt.invoice.invoiceNo}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{receipt.invoice.project.companyName || receipt.invoice.project.name}</div>
                        {receipt.invoice.project.taxId && (
                          <div className="text-xs text-muted-foreground">{t("taxId") || "Tax ID"}: {receipt.invoice.project.taxId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{receipt.invoice.unit.unitNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{receipt.invoice.tenant.name}</div>
                        {receipt.invoice.tenant.tenantType === "COMPANY" && (
                          <div className="text-xs text-muted-foreground">{t("company") || "Company"}</div>
                        )}
                        {receipt.invoice.tenant.taxId && (
                          <div className="text-xs text-muted-foreground">{t("taxId") || "Tax ID"}: {receipt.invoice.tenant.taxId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>฿{receipt.amount.toLocaleString()}</TableCell>
                    <TableCell>{formatDate(receipt.issuedAt)}</TableCell>
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
                          title={t("viewReceipt") || "View Receipt"}
                          onClick={() => handleViewReceipt(receipt)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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

      {/* Create Receipt Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createReceipt") || "สร้างใบเสร็จรับเงิน"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateReceipt} className="space-y-4">
            {/* Project Filter */}
            <div className="space-y-2">
              <Label>{t("project") || "โครงการ"}</Label>
              <Select
                value={selectedProjectId || "__all__"}
                onValueChange={(v) => handleProjectChangeForCreate(v === "__all__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("allProjects") || "ทุกโครงการ"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("allProjects") || "ทุกโครงการ"}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Selection */}
            <div className="space-y-2">
              <Label>{t("selectInvoice") || "เลือกใบแจ้งหนี้"} *</Label>
              <Select
                value={createFormData.invoiceId || undefined}
                onValueChange={(v) => {
                  const inv = paidInvoices.find((i) => i.id === v);
                  setCreateFormData((prev) => ({
                    ...prev,
                    invoiceId: v,
                    amount: inv ? String(inv.totalAmount) : "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectInvoicePlaceholder") || "เลือกใบแจ้งหนี้ที่ชำระแล้ว"} />
                </SelectTrigger>
                <SelectContent>
                  {paidInvoices.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {t("noPaidInvoicesWithoutReceipt") || "ไม่มีใบแจ้งหนี้ที่ยังไม่มีใบเสร็จ"}
                    </SelectItem>
                  ) : (
                    paidInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNo} - {inv.project.name} - {inv.unit.unitNumber} (฿{inv.totalAmount.toLocaleString()})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Invoice Info */}
            {selectedInvoiceForReceipt && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tenant") || "ผู้เช่า"}:</span>
                  <span>{selectedInvoiceForReceipt.tenant.name}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("totalAmount") || "ยอดรวม"}:</span>
                  <span className="text-green-600">฿{selectedInvoiceForReceipt.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label>{t("amount") || "จำนวนเงิน"}</Label>
              <Input
                type="number"
                step="0.01"
                value={createFormData.amount}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                {t("amountHint") || "ถ้าไม่กรอก จะใช้ยอดรวมจากใบแจ้งหนี้"}
              </p>
            </div>

            {/* Issued Date */}
            <div className="space-y-2">
              <Label>{t("issuedAt") || "วันที่ออกใบเสร็จ"}</Label>
              <Input
                type="date"
                value={createFormData.issuedAt}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, issuedAt: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creatingReceipt}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={creatingReceipt || !createFormData.invoiceId}>
                {creatingReceipt && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("createReceipt") || "สร้างใบเสร็จ"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("viewReceipt") || "View Receipt"}</DialogTitle>
          </DialogHeader>
          {loadingReceipt ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedReceipt ? (
            <div className="space-y-6">
              {/* Company Header */}
              <div className="text-center">
                <h3 className="text-xl font-bold">
                  {selectedReceipt.invoice.project.companyName || selectedReceipt.invoice.project.name}
                </h3>
                {selectedReceipt.invoice.project.companyAddress && (
                  <p className="text-sm text-muted-foreground">{selectedReceipt.invoice.project.companyAddress}</p>
                )}
                {selectedReceipt.invoice.project.taxId && (
                  <p className="text-sm text-muted-foreground">{t("taxId") || "Tax ID"}: {selectedReceipt.invoice.project.taxId}</p>
                )}
              </div>

              <div className="text-center">
                <h4 className="text-lg font-semibold">{t("receiptTitle") || "RECEIPT"}</h4>
              </div>

              <Separator />

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("receiptNo")}</p>
                  <p className="font-medium">{selectedReceipt.receiptNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("issuedAt")}</p>
                  <p className="font-medium">{formatDate(selectedReceipt.issuedAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("invoiceRef") || "Invoice Ref"}</p>
                  <p className="font-medium">{selectedReceipt.invoice.invoiceNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("billingMonth") || "Billing Month"}</p>
                  <p className="font-medium">{selectedReceipt.invoice.billingMonth}</p>
                </div>
              </div>

              <Separator />

              {/* Tenant Info */}
              <div>
                <h4 className="font-semibold mb-2">{t("receivedFrom") || "Received From"}</h4>
                <p className="font-medium">{selectedReceipt.invoice.tenant.name}</p>
                {selectedReceipt.invoice.tenant.tenantType === "COMPANY" && (
                  <p className="text-sm text-muted-foreground">{t("company") || "Company"}</p>
                )}
                <p className="text-sm text-muted-foreground">{t("unit") || "Unit"}: {selectedReceipt.invoice.unit.unitNumber}</p>
                {selectedReceipt.invoice.tenant.phone && (
                  <p className="text-sm text-muted-foreground">{t("phone") || "Phone"}: {selectedReceipt.invoice.tenant.phone}</p>
                )}
                {selectedReceipt.invoice.tenant.taxId && (
                  <p className="text-sm text-muted-foreground">{t("taxId") || "Tax ID"}: {selectedReceipt.invoice.tenant.taxId}</p>
                )}
              </div>

              <Separator />

              {/* Line Items */}
              {selectedReceipt.invoice.lineItems && selectedReceipt.invoice.lineItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">{t("paymentFor") || "Payment For"}</h4>
                  <div className="space-y-2">
                    {selectedReceipt.invoice.lineItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-sm">{item.description}</span>
                        <span className="text-sm">฿{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span>{t("subtotal") || "Subtotal"}</span>
                  <span>฿{selectedReceipt.invoice.subtotal.toLocaleString()}</span>
                </div>
                {selectedReceipt.invoice.withholdingTax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("withholdingTax") || "Withholding Tax"}</span>
                    <span>-฿{selectedReceipt.invoice.withholdingTax.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg text-green-600">
                  <span>{t("amountReceived") || "Amount Received"}</span>
                  <span>฿{selectedReceipt.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  {tCommon("close") || "Close"}
                </Button>
                <Button onClick={() => handleDownloadPdf(selectedReceipt as unknown as Receipt)}>
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
