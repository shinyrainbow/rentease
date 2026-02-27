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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, FileDown, Eye, Loader2, Check, Search, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToCSV, formatDateForExport, formatCurrencyForExport } from "@/lib/export";
import { formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import { useCanMutate } from "@/hooks/use-role";

interface Project {
  id: string;
  name: string;
}

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
  dueDate: string;
  invoiceDate: string;
  subtotal: number;
  withholdingTax: number;
  totalAmount: number;
  paidAmount: number;
  sentViaLine: boolean;
  projectId: string;
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
  payments?: Array<{ id: string }>;
  receipt?: { id: string } | null;
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
    tenantType: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    withholdingTax: number;
  };
}

interface LineItem {
  description: string;
  amount: number;
}

interface MeterReading {
  id: string;
  type: string;
  previousReading: number;
  currentReading: number;
  usage: number;
  rate: number;
  amount: number;
  readingDate: string;
  unit: { unitNumber: string };
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const canMutate = useCanMutate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("invoiceNo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"th" | "en">("th");
  const [isCopy, setIsCopy] = useState(false);

  const [formData, setFormData] = useState({
    projectId: "",
    unitId: "",
    type: "RENT",
    dueDate: "",
    invoiceNo: "",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editFormData, setEditFormData] = useState({
    invoiceNo: "",
    type: "RENT",
    dueDate: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk generation state
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    projectId: "",
    type: "RENT",
    month: new Date().toISOString().slice(0, 7),
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString().slice(0, 10),
  });
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [lineSendDialogOpen, setLineSendDialogOpen] = useState(false);
  const [lineSendInvoice, setLineSendInvoice] = useState<Invoice | null>(null);
  const [lineSendCopy, setLineSendCopy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Meter reading picker state
  const [availableReadings, setAvailableReadings] = useState<MeterReading[]>([]);
  const [selectedReadingIds, setSelectedReadingIds] = useState<Set<string>>(new Set());
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [readingMonths, setReadingMonths] = useState<string[]>([]);
  const [selectedReadingMonth, setSelectedReadingMonth] = useState<string>("");
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const [invoicesRes, unitsRes, projectsRes] = await Promise.all([
        fetch(`/api/invoices?${params.toString()}`),
        fetch("/api/units"),
        fetch("/api/projects"),
      ]);
      const [invoicesData, unitsData, projectsData] = await Promise.all([
        invoicesRes.json(),
        unitsRes.json(),
        projectsRes.json(),
      ]);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setUnits(Array.isArray(unitsData) ? unitsData.filter((u: Unit) => u.tenant !== null) : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  // Fetch all uninvoiced meter readings for a unit, extract months, and show most recent
  const fetchMeterReadingMonths = async (unitId: string) => {
    if (!unitId) {
      setAvailableReadings([]);
      setSelectedReadingIds(new Set());
      setReadingMonths([]);
      setSelectedReadingMonth("");
      return;
    }
    setLoadingReadings(true);
    try {
      const res = await fetch(`/api/meters?unitId=${unitId}&uninvoiced=true`);
      const rawData = await res.json();
      const data: MeterReading[] = Array.isArray(rawData) ? rawData : [];
      // Extract unique months from readingDate
      const months = Array.from(new Set(
        data.map((r) => {
          const d = new Date(r.readingDate);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        })
      )).sort().reverse();
      setReadingMonths(months);
      // Auto-select the most recent month
      const defaultMonth = months[0] || "";
      setSelectedReadingMonth(defaultMonth);
      // Filter readings by that month
      if (defaultMonth) {
        const filtered = data.filter((r) => {
          const d = new Date(r.readingDate);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === defaultMonth;
        });
        setAvailableReadings(filtered);
        setSelectedReadingIds(new Set(filtered.map((r) => r.id)));
      } else {
        setAvailableReadings([]);
        setSelectedReadingIds(new Set());
      }
    } catch (error) {
      console.error("Error fetching meter readings:", error);
      setAvailableReadings([]);
      setReadingMonths([]);
    } finally {
      setLoadingReadings(false);
    }
  };

  // When reading month changes, fetch readings for that specific month
  const handleReadingMonthChange = async (month: string) => {
    setSelectedReadingMonth(month);
    if (!month || !formData.unitId) {
      setAvailableReadings([]);
      setSelectedReadingIds(new Set());
      return;
    }
    setLoadingReadings(true);
    try {
      const res = await fetch(`/api/meters?unitId=${formData.unitId}&uninvoiced=true&month=${month}`);
      const rawData = await res.json();
      const data: MeterReading[] = Array.isArray(rawData) ? rawData : [];
      setAvailableReadings(data);
      setSelectedReadingIds(new Set(data.map((r) => r.id)));
    } catch (error) {
      console.error("Error fetching meter readings:", error);
      setAvailableReadings([]);
    } finally {
      setLoadingReadings(false);
    }
  };

  useEffect(() => {
    if ((formData.type === "UTILITY" || formData.type === "COMBINED") && formData.unitId) {
      fetchMeterReadingMonths(formData.unitId);
    } else {
      setAvailableReadings([]);
      setSelectedReadingIds(new Set());
      setReadingMonths([]);
      setSelectedReadingMonth("");
    }
  }, [formData.unitId, formData.type]);

  useEffect(() => {
    setSelectedInvoices(new Set());
  }, [statusFilter, projectFilter, monthFilter, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: Record<string, unknown> = { ...formData };
      if ((formData.type === "UTILITY" || formData.type === "COMBINED") && selectedReadingIds.size > 0) {
        payload.meterReadingIds = Array.from(selectedReadingIds);
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to create invoice",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkGenerating(true);

    try {
      const res = await fetch("/api/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkFormData),
      });

      const result = await res.json();

      if (res.ok) {
        toast({
          title: t("bulkGenerateComplete"),
          description: t("bulkGenerateMessage").replace("{created}", result.created).replace("{skipped}", result.skipped),
        });
        setIsBulkDialogOpen(false);
        fetchData();
      } else {
        toast({
          title: tCommon("error"),
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error bulk generating invoices:", error);
      toast({
        title: tCommon("error"),
        description: "Failed to generate invoices",
        variant: "destructive",
      });
    } finally {
      setBulkGenerating(false);
    }
  };

  const resetForm = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(15);

    setFormData({
      projectId: "",
      unitId: "",
      type: "RENT",
      dueDate: nextMonth.toISOString().split("T")[0],
      invoiceNo: "",
    });
    setAvailableReadings([]);
    setSelectedReadingIds(new Set());
    setReadingMonths([]);
    setSelectedReadingMonth("");
  };

  // Get units filtered by selected project
  const filteredUnitsForCreate = formData.projectId
    ? units.filter((u) => u.projectId === formData.projectId)
    : units;

  const handleEdit = async (invoice: Invoice) => {
    // Fetch full invoice details
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`);
      if (res.ok) {
        const data = await res.json();
        setEditingInvoice(invoice);
        setEditFormData({
          invoiceNo: data.invoiceNo || "",
          type: data.type,
          dueDate: data.dueDate.split("T")[0],
          notes: data.notes || "",
        });
        setIsEditDialogOpen(true);
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/invoices/${editingInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: editFormData.invoiceNo || undefined,
          type: editFormData.type,
          dueDate: new Date(editFormData.dueDate).toISOString(),
          notes: editFormData.notes || null,
        }),
      });

      if (res.ok) {
        setIsEditDialogOpen(false);
        setEditingInvoice(null);
        fetchData();
        toast({
          title: t("invoiceUpdated") || "Invoice Updated",
          description: `${editingInvoice.invoiceNo} ${t("updated") || "has been updated"}`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update invoice",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to update invoice",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteDialog = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceToDelete.id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        toast({
          title: t("invoiceDeleted") || "Invoice Deleted",
          description: `${invoiceToDelete.invoiceNo} ${tCommon("deleted") || "has been deleted"}`,
        });
        setDeleteDialogOpen(false);
        setInvoiceToDelete(null);
        fetchData();
      } else {
        // Show specific error message for linked payments/receipts
        toast({
          title: tCommon("error") || "Error",
          description: data.error || "Failed to delete invoice",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Batch selection handlers
  const toggleInvoiceSelection = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleAllInvoices = () => {
    if (selectedInvoices.size === sortedInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(sortedInvoices.map((i) => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return;
    if (!window.confirm(`Delete ${selectedInvoices.size} selected invoices?`)) return;

    setBulkDeleting(true);
    try {
      const deletePromises = Array.from(selectedInvoices).map(async (id) => {
        const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
        const data = await response.json();
        return { response, data, id };
      });
      const results = await Promise.all(deletePromises);
      const successCount = results.filter((r) => r.response.ok).length;
      const failedWithLinks = results.filter((r) => !r.response.ok && (r.data.errorCode === "HAS_PAYMENTS" || r.data.errorCode === "HAS_RECEIPT"));

      let description = t("bulkDeleteMessage").replace("{count}", String(successCount));
      if (failedWithLinks.length > 0) {
        description += ` ${failedWithLinks.length} invoice(s) could not be deleted due to linked payments or receipts.`;
      }

      toast({
        title: t("bulkDeleteComplete"),
        description,
        variant: failedWithLinks.length > 0 ? "destructive" : "default",
      });
      setSelectedInvoices(new Set());
      fetchData();
    } catch (error) {
      console.error("Error bulk deleting:", error);
      toast({
        title: tCommon("error"),
        description: "Failed to delete some invoices",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const dataToExport = selectedInvoices.size > 0
      ? sortedInvoices.filter((i) => selectedInvoices.has(i.id))
      : sortedInvoices;

    exportToCSV(
      dataToExport.map((invoice) => ({
        invoiceNo: invoice.invoiceNo,
        project: invoice.project.companyName || invoice.project.name,
        unit: invoice.unit.unitNumber,
        tenant: invoice.tenant.name,
        type: invoice.type,
        invoiceDate: invoice.invoiceDate?.split("T")[0] || "",
        subtotal: invoice.subtotal,
        withholdingTax: invoice.withholdingTax,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        status: invoice.status,
        dueDate: invoice.dueDate,
      })),
      [
        { key: "invoiceNo", header: "Invoice No" },
        { key: "project", header: "Project" },
        { key: "unit", header: "Unit" },
        { key: "tenant", header: "Tenant" },
        { key: "type", header: "Type" },
        { key: "invoiceDate", header: "Invoice Date" },
        { key: "subtotal", header: "Subtotal" },
        { key: "withholdingTax", header: "WHT" },
        { key: "totalAmount", header: "Total Amount" },
        { key: "paidAmount", header: "Paid Amount" },
        { key: "status", header: "Status" },
        { key: "dueDate", header: "Due Date" },
      ],
      `invoices-${new Date().toISOString().slice(0, 10)}`
    );

    toast({
      title: "Export Complete",
      description: `Exported ${dataToExport.length} invoices to CSV`,
    });
  };

  const openLineSendDialog = (invoice: Invoice) => {
    setLineSendInvoice(invoice);
    setLineSendCopy(false);
    setLineSendDialogOpen(true);
  };

  const handleSendViaLine = async () => {
    if (!lineSendInvoice) return;

    setSendingInvoiceId(lineSendInvoice.id);
    setLineSendDialogOpen(false);

    try {
      const res = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: lineSendInvoice.id, lang: "th", format: "image", copy: lineSendCopy }),
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
        description: `${lineSendInvoice.invoiceNo} ${t("sentToLine")}`,
      });

      // Update local state to reflect sent status
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === lineSendInvoice.id ? { ...inv, sentViaLine: true } : inv
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

  // Get unique invoice date months from invoices
  const uniqueMonths = Array.from(new Set(invoices.map((inv) => {
    if (!inv.invoiceDate) return "";
    const d = new Date(inv.invoiceDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }).filter(Boolean)))
    .sort()
    .reverse();

  // Filter invoices by project, billing month, and search query
  const filteredInvoices = invoices.filter((invoice) => {
    // Project filter
    if (projectFilter && invoice.projectId !== projectFilter) {
      return false;
    }
    // Month filter (by invoiceDate)
    if (monthFilter) {
      if (!invoice.invoiceDate) return false;
      const d = new Date(invoice.invoiceDate);
      const invMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (invMonth !== monthFilter) return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        invoice.invoiceNo.toLowerCase().includes(query) ||
        invoice.tenant.name.toLowerCase().includes(query) ||
        invoice.unit.unitNumber.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Sort filtered invoices
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "invoiceNo":
        aVal = a.invoiceNo;
        bVal = b.invoiceNo;
        break;
      case "project":
        aVal = a.project.companyName || a.project.name;
        bVal = b.project.companyName || b.project.name;
        break;
      case "unit":
        aVal = a.unit.unitNumber;
        bVal = b.unit.unitNumber;
        break;
      case "tenant":
        aVal = a.tenant.name;
        bVal = b.tenant.name;
        break;
      case "type":
        aVal = a.type;
        bVal = b.type;
        break;
      case "invoiceDate":
        aVal = a.invoiceDate || "";
        bVal = b.invoiceDate || "";
        break;
      case "totalAmount":
        aVal = a.totalAmount;
        bVal = b.totalAmount;
        break;
      case "paidAmount":
        aVal = a.paidAmount;
        bVal = b.paidAmount;
        break;
      case "status":
        aVal = a.status;
        bVal = b.status;
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

  const fetchPdfPreview = async (invoiceId: string, lang: "th" | "en", copy: boolean) => {
    setPdfPreviewUrl(null);
    try {
      const pdfRes = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, copy }),
      });

      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData.url) {
          setPdfPreviewUrl(pdfData.url);
        }
      }
    } catch (error) {
      console.error("Error fetching PDF:", error);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setLoadingInvoice(true);
    setViewDialogOpen(true);
    setPdfPreviewUrl(null);
    setPreviewLang("th");
    setIsCopy(false);
    try {
      // Fetch invoice details first
      const detailRes = await fetch(`/api/invoices/${invoice.id}`);

      if (detailRes.ok) {
        const data = await detailRes.json();
        setSelectedInvoice(data);

        // Generate PDF preview
        await fetchPdfPreview(invoice.id, "th", false);
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

  const handleDownloadPdf = async (invoice: Invoice, lang: "th" | "en" = previewLang, copy: boolean = isCopy) => {
    try {
      // Use server-side PDF generation with Thai font support
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, copy }),
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
      if (data.url) {
        // Open PDF in new tab or trigger download
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <PageSkeleton columns={8} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <div className="flex gap-2">
          {/* Bulk Generate Button */}
          {canMutate && (
            <Dialog open={isBulkDialogOpen} onOpenChange={(open) => {
              setIsBulkDialogOpen(open);
              if (!open) setBulkFormData({ projectId: "", type: "RENT", month: new Date().toISOString().slice(0, 7), dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString().slice(0, 10) });
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("bulkGenerate")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("bulkGenerateTitle")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBulkGenerate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("project")}</Label>
                    <Select
                      value={bulkFormData.projectId || "__all__"}
                      onValueChange={(value) => setBulkFormData({ ...bulkFormData, projectId: value === "__all__" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("allProjects")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("allProjects")}</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("type")}</Label>
                    <Select
                      value={bulkFormData.type}
                      onValueChange={(value) => setBulkFormData({ ...bulkFormData, type: value })}
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
                  {/* Month selector for UTILITY/COMBINED */}
                  {(bulkFormData.type === "UTILITY" || bulkFormData.type === "COMBINED") && (
                    <div className="space-y-2">
                      <Label>{t("readingMonth") || "Meter Reading Month"}</Label>
                      <Input
                        type="month"
                        value={bulkFormData.month}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, month: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("bulkMonthHint") || "Uninvoiced meter readings from this month will be used"}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t("dueDate")} <span className="text-muted-foreground text-xs">(วัน เดือน ปี)</span></Label>
                    <DateInput
                      value={bulkFormData.dueDate}
                      onChange={(v) => setBulkFormData({ ...bulkFormData, dueDate: v })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                      {tCommon("cancel")}
                    </Button>
                    <Button type="submit" disabled={bulkGenerating}>
                      {bulkGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t("generate")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Single Invoice Create Button */}
          {canMutate && (
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
                  {/* Project Selection */}
                  <div className="space-y-2">
                    <Label>{t("project") || "โครงการ"}</Label>
                    <Select
                      value={formData.projectId || undefined}
                      onValueChange={(value) => setFormData({ ...formData, projectId: value, unitId: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectProject") || "เลือกโครงการ"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unit Selection */}
                  <div className="space-y-2">
                    <Label>{t("unit") || "ห้อง/ยูนิต"}</Label>
                    <Select
                      value={formData.unitId || undefined}
                      onValueChange={(value) => {
                        const selectedUnit = units.find((u) => u.id === value);
                        const now = new Date();
                        const mm = String(now.getMonth() + 1).padStart(2, "0");
                        const yyyy = now.getFullYear();
                        const projCode = selectedUnit?.project?.name?.substring(0, 3).toUpperCase() || "PRJ";
                        const defaultNo = `INV-${projCode}-${mm}-${yyyy}-${selectedUnit?.unitNumber || ""}`;
                        setFormData({ ...formData, unitId: value, invoiceNo: defaultNo });
                      }}
                      disabled={!formData.projectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.projectId ? (t("selectUnit") || "เลือกห้อง") : (t("selectProjectFirst") || "กรุณาเลือกโครงการก่อน")} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUnitsForCreate.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            {t("noUnitsWithTenant") || "ไม่มีห้องที่มีผู้เช่า"}
                          </SelectItem>
                        ) : (
                          filteredUnitsForCreate.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.unitNumber} - {unit.tenant?.name}
                            </SelectItem>
                          ))
                        )}
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

                  {/* Meter Reading Picker - shown for UTILITY and COMBINED */}
                  {(formData.type === "UTILITY" || formData.type === "COMBINED") && formData.unitId && (
                    <>
                      {/* Month selector */}
                      <div className="space-y-2">
                        <Label>{t("readingMonth") || "Meter Reading Month"}</Label>
                        {loadingReadings && readingMonths.length === 0 ? (
                          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {tCommon("loading") || "Loading..."}
                          </div>
                        ) : readingMonths.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            {t("noMeterReadings") || "No uninvoiced meter readings found for this unit"}
                          </p>
                        ) : (
                          <Select
                            value={selectedReadingMonth}
                            onValueChange={handleReadingMonthChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectMonth") || "Select month"} />
                            </SelectTrigger>
                            <SelectContent>
                              {readingMonths.map((month) => (
                                <SelectItem key={month} value={month}>
                                  {month}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Meter readings list */}
                      {selectedReadingMonth && (
                        <div className="space-y-2">
                          <Label>{t("selectMeterReadings") || "Select Meter Readings"}</Label>
                          {loadingReadings ? (
                            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : availableReadings.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">
                              {t("noMeterReadings") || "No uninvoiced meter readings found for this unit"}
                            </p>
                          ) : (
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                              {availableReadings.map((reading) => (
                                <label
                                  key={reading.id}
                                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                                >
                                  <Checkbox
                                    checked={selectedReadingIds.has(reading.id)}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set(selectedReadingIds);
                                      if (checked) {
                                        newSet.add(reading.id);
                                      } else {
                                        newSet.delete(reading.id);
                                      }
                                      setSelectedReadingIds(newSet);
                                    }}
                                  />
                                  <div className="flex-1 text-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">
                                        {reading.type === "ELECTRICITY" ? "⚡ " : "💧 "}
                                        {reading.type === "ELECTRICITY"
                                          ? (t("electricity") || "Electricity")
                                          : (t("water") || "Water")}
                                      </span>
                                      <span className="font-semibold">฿{reading.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                      {reading.usage} units × ฿{reading.rate} | {formatDate(reading.readingDate)}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                          {availableReadings.length > 0 && selectedReadingIds.size > 0 && (
                            <div className="text-sm text-right font-medium">
                              {t("selectedTotal") || "Total"}: ฿{availableReadings
                                .filter((r) => selectedReadingIds.has(r.id))
                                .reduce((sum, r) => sum + r.amount, 0)
                                .toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>{t("dueDate")} <span className="text-muted-foreground text-xs">(วัน เดือน ปี)</span></Label>
                    <DateInput
                      value={formData.dueDate}
                      onChange={(v) => setFormData({ ...formData, dueDate: v })}
                      required
                    />
                  </div>

                  {/* Editable Invoice Number */}
                  <div className="space-y-2">
                    <Label>{t("invoiceNo") || "เลขที่ใบแจ้งหนี้ / Invoice No."}</Label>
                    <Input
                      value={formData.invoiceNo}
                      onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                      placeholder="INV-XXX-MM-YYYY-Unit"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("invoiceNoHint") || "แก้ไขได้ตามต้องการ / Editable, auto-generated when unit is selected"}
                    </p>
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
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("")}
        >
          All
        </Button>
        <Button
          variant={statusFilter === "OVERDUE" ? "destructive" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "OVERDUE" ? "" : "OVERDUE")}
        >
          Overdue
        </Button>
        <Button
          variant={statusFilter === "PENDING" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "PENDING" ? "" : "PENDING")}
        >
          Pending
        </Button>
        <Button
          variant={statusFilter === "PAID" ? "default" : "outline"}
          size="sm"
          className={statusFilter === "PAID" ? "bg-green-600 hover:bg-green-700" : ""}
          onClick={() => setStatusFilter(statusFilter === "PAID" ? "" : "PAID")}
        >
          Paid
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder") || "Search invoice, tenant, unit..."}
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
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("billingMonth") || "เดือนที่ออกบิล"}</Label>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          {tCommon("export")}
        </Button>
      </div>

      {/* Batch Action Bar */}
      {canMutate && selectedInvoices.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedInvoices.size} {tCommon("select")}</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            {bulkDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("deleteSelected")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            {tCommon("export")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedInvoices(new Set())}
          >
            {tCommon("cancel")}
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {canMutate && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedInvoices.size === sortedInvoices.length && sortedInvoices.length > 0}
                      onCheckedChange={toggleAllInvoices}
                    />
                  </TableHead>
                )}
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("invoiceNo")}>
                  <div className="flex items-center">{t("invoiceNo")}<SortIcon column="invoiceNo" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project")}>
                  <div className="flex items-center">{t("projectCompany") || "Project/Company"}<SortIcon column="project" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                  <div className="flex items-center">{t("unit")}<SortIcon column="unit" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("tenant")}>
                  <div className="flex items-center">{t("tenantCompany") || "Tenant/Company"}<SortIcon column="tenant" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("type")}>
                  <div className="flex items-center">{t("type")}<SortIcon column="type" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("invoiceDate")}>
                  <div className="flex items-center">{t("dueDate")}<SortIcon column="invoiceDate" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("totalAmount")}>
                  <div className="flex items-center">{t("totalAmount")}<SortIcon column="totalAmount" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("paidAmount")}>
                  <div className="flex items-center">{t("paidAmount")}<SortIcon column="paidAmount" /></div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                  <div className="flex items-center">{tCommon("status")}<SortIcon column="status" /></div>
                </TableHead>
                {canMutate && <TableHead className="sticky right-0 bg-background">{tCommon("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className={selectedInvoices.has(invoice.id) ? "bg-muted/50" : ""}>
                    {canMutate && (
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.has(invoice.id)}
                          onCheckedChange={() => toggleInvoiceSelection(invoice.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.project.companyName || invoice.project.name}</div>
                        {invoice.project.taxId && (
                          <div className="text-xs text-muted-foreground">{t("taxId") || "Tax ID"}: {invoice.project.taxId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{invoice.unit.unitNumber}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.tenant.name}</div>
                        {invoice.tenant.taxId && (
                          <div className="text-xs text-muted-foreground">{t("taxId") || "Tax ID"}: {invoice.tenant.taxId}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{t(`types.${invoice.type}`)}</TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>฿{invoice.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>฿{invoice.paidAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(invoice.status)}>
                        {t(`statuses.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    {canMutate && (
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
                            onClick={() => openLineSendDialog(invoice)}
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
                            title={t("editInvoice") || "Edit Invoice"}
                            onClick={() => handleEdit(invoice)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={t("deleteInvoice") || "Delete Invoice"}
                            onClick={() => openDeleteDialog(invoice)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Invoice Dialog */}
      {canMutate && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) setEditingInvoice(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("editInvoice") || "Edit Invoice"} - {editingInvoice?.invoiceNo}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("invoiceNo") || "เลขที่ใบแจ้งหนี้ / Invoice No."}</Label>
                <Input
                  value={editFormData.invoiceNo}
                  onChange={(e) => setEditFormData({ ...editFormData, invoiceNo: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("type")}</Label>
                <Select
                  value={editFormData.type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, type: value })}
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

              <div className="space-y-2">
                <Label>{t("dueDate")} <span className="text-muted-foreground text-xs">(วัน เดือน ปี)</span></Label>
                <DateInput
                  value={editFormData.dueDate}
                  onChange={(v) => setEditFormData({ ...editFormData, dueDate: v })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t("notes") || "Notes"}</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editFormData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={savingEdit}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => {
        setViewDialogOpen(open);
        if (!open) {
          setPdfPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("viewInvoice")}</DialogTitle>
          </DialogHeader>
          {loadingInvoice ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedInvoice ? (
            <Tabs defaultValue="pdf" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="grid grid-cols-2 w-auto">
                  <TabsTrigger value="pdf">{t("pdfPreview") || "PDF"}</TabsTrigger>
                  <TabsTrigger value="details">{t("details") || "Details"}</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-4">
                  {/* Language Toggle - commented out until English address support is ready
                  <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                    <Button
                      variant={previewLang === "th" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => {
                        setPreviewLang("th");
                        fetchPdfPreview(selectedInvoice.id, "th", isCopy);
                      }}
                    >
                      TH
                    </Button>
                    <Button
                      variant={previewLang === "en" ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => {
                        setPreviewLang("en");
                        fetchPdfPreview(selectedInvoice.id, "en", isCopy);
                      }}
                    >
                      EN
                    </Button>
                  </div>
                  */}
                  {/* Copy Toggle */}
                  <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                    <Button
                      variant={!isCopy ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => {
                        setIsCopy(false);
                        fetchPdfPreview(selectedInvoice.id, previewLang, false);
                      }}
                    >
                      ต้นฉบับ
                    </Button>
                    <Button
                      variant={isCopy ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => {
                        setIsCopy(true);
                        fetchPdfPreview(selectedInvoice.id, previewLang, true);
                      }}
                    >
                      สำเนา
                    </Button>
                  </div>
                </div>
              </div>

              <TabsContent value="pdf" className="flex-1 overflow-hidden mt-4">
                {pdfPreviewUrl ? (
                  <iframe
                    src={`${pdfPreviewUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    className="w-full h-[55vh] border rounded-lg"
                    title="Invoice PDF Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[55vh]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
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
                      <p className="text-sm text-muted-foreground">{t("dueDate")}</p>
                      <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
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
                        <span>{t("withholdingTax") || "Withholding Tax"} ({selectedInvoice.tenant.withholdingTax}%)</span>
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
                </div>
              </TabsContent>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  {tCommon("close") || "Close"}
                </Button>
                <Button onClick={() => selectedInvoice && handleDownloadPdf(selectedInvoice)}>
                  <FileDown className="h-4 w-4 mr-2" />
                  {t("downloadPdf")}
                </Button>
              </div>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* LINE Send Language Selection Dialog */}
      <Dialog open={lineSendDialogOpen} onOpenChange={setLineSendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sendViaLine")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("invoiceVersion") || "Version"}</Label>
              <Select value={lineSendCopy ? "copy" : "original"} onValueChange={(v) => setLineSendCopy(v === "copy")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">{t("originalVersion") || "Original"}</SelectItem>
                  <SelectItem value="copy">{t("copyVersion") || "Copy"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {lineSendInvoice && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">{lineSendInvoice.invoiceNo}</p>
                <p className="text-xs text-muted-foreground">
                  {lineSendInvoice.tenant.name} - {lineSendInvoice.unit.unitNumber}
                </p>
                <p className="text-sm font-semibold mt-1">
                  ฿{lineSendInvoice.totalAmount.toLocaleString()}
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

      {/* Delete Invoice AlertDialog */}
      {canMutate && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteInvoice") || "Delete Invoice"}</AlertDialogTitle>
              <AlertDialogDescription>
                {invoiceToDelete?.payments && invoiceToDelete.payments.length > 0 ? (
                  <span className="text-destructive font-medium">
                    {t("cannotDeleteHasPayments") || "Cannot delete invoice with linked payments. Please remove all payments first."}
                  </span>
                ) : invoiceToDelete?.receipt ? (
                  <span className="text-destructive font-medium">
                    {t("cannotDeleteHasReceipt") || "Cannot delete invoice with linked receipt. Please remove the receipt first."}
                  </span>
                ) : (
                  <>
                    {t("confirmDelete")} {invoiceToDelete?.invoiceNo}?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting || (invoiceToDelete?.payments && invoiceToDelete.payments.length > 0) || !!invoiceToDelete?.receipt}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tCommon("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
