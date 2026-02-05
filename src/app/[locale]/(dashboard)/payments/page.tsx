"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Image, Plus, Trash2, Loader2, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";

interface Project {
  id: string;
  name: string;
}

interface UnpaidInvoice {
  id: string;
  invoiceNo: string;
  totalAmount: number;
  paidAmount: number;
  project: { name: string };
  unit: { unitNumber: string };
  tenant: { name: string };
}

interface PaymentSlip {
  id: string;
  s3Key: string;
  fileName: string | null;
  source: string;
  presignedUrl: string;
  uploadedAt: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  slipUrl: string | null;
  transferRef: string | null;
  paidAt: string;
  invoice: {
    invoiceNo: string;
    project: { name: string };
    unit: { unitNumber: string };
  };
  tenant: { name: string };
  slips: PaymentSlip[];
}

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const { toast } = useToast();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("invoiceNo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isSlipsOpen, setIsSlipsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create payment state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    invoiceId: "",
    amount: "",
    method: "CASH" as "CASH" | "CHECK" | "TRANSFER",
    checkNo: "",
    checkBank: "",
    checkDate: "",
    transferRef: "",
    transferBank: "",
    notes: "",
    autoVerify: true,
  });

  // Edit payment state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [editFormData, setEditFormData] = useState({
    amount: "",
    method: "CASH" as "CASH" | "CHECK" | "TRANSFER",
    checkNo: "",
    checkBank: "",
    checkDate: "",
    transferRef: "",
    transferBank: "",
    notes: "",
  });

  // Delete payment state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const [paymentsRes, projectsRes] = await Promise.all([
        fetch(`/api/payments?${params.toString()}`),
        fetch("/api/projects"),
      ]);
      const [paymentsData, projectsData] = await Promise.all([
        paymentsRes.json(),
        projectsRes.json(),
      ]);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter payments by project and search query
  const filteredPayments = payments.filter((payment) => {
    // Project filter
    if (projectFilter && payment.invoice.project.name !== projectFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        payment.invoice.invoiceNo.toLowerCase().includes(query) ||
        payment.tenant.name.toLowerCase().includes(query) ||
        payment.invoice.unit.unitNumber.toLowerCase().includes(query) ||
        (payment.transferRef && payment.transferRef.toLowerCase().includes(query))
      );
    }
    return true;
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  // Fetch unpaid invoices when create dialog opens or project changes
  const fetchUnpaidInvoices = async (projectId?: string) => {
    try {
      const params = new URLSearchParams({ status: "PENDING,PARTIAL,OVERDUE" });
      if (projectId) params.append("projectId", projectId);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUnpaidInvoices(data);
      }
    } catch (error) {
      console.error("Error fetching unpaid invoices:", error);
    }
  };

  const handleOpenCreateDialog = () => {
    setCreateFormData({
      invoiceId: "",
      amount: "",
      method: "CASH",
      checkNo: "",
      checkBank: "",
      checkDate: "",
      transferRef: "",
      transferBank: "",
      notes: "",
      autoVerify: true,
    });
    setSelectedProjectId("");
    fetchUnpaidInvoices();
    setIsCreateOpen(true);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCreateFormData((prev) => ({ ...prev, invoiceId: "" }));
    if (projectId && projectId !== "__all__") {
      fetchUnpaidInvoices(projectId);
    } else {
      fetchUnpaidInvoices();
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.invoiceId || !createFormData.amount) return;

    setCreatingPayment(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: createFormData.invoiceId,
          amount: parseFloat(createFormData.amount),
          method: createFormData.method,
          checkNo: createFormData.method === "CHECK" ? createFormData.checkNo : undefined,
          checkBank: createFormData.method === "CHECK" ? createFormData.checkBank : undefined,
          checkDate: createFormData.method === "CHECK" ? createFormData.checkDate : undefined,
          transferRef: createFormData.method === "TRANSFER" ? createFormData.transferRef : undefined,
          transferBank: createFormData.method === "TRANSFER" ? createFormData.transferBank : undefined,
          notes: createFormData.notes || undefined,
          autoVerify: createFormData.autoVerify,
        }),
      });

      if (res.ok) {
        toast({
          title: t("paymentCreated") || "Payment Created",
          description: t("paymentCreatedDesc") || "Payment has been recorded successfully",
        });
        setIsCreateOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error") || "Error",
          description: data.error || "Failed to create payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setCreatingPayment(false);
    }
  };

  const selectedInvoice = unpaidInvoices.find((inv) => inv.id === createFormData.invoiceId);
  const remainingAmount = selectedInvoice
    ? selectedInvoice.totalAmount - selectedInvoice.paidAmount
    : 0;

  const handleVerify = async (id: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
    }
  };

  const handleOpenSlips = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsSlipsOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPayment) return;

    setUploadingSlip(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;

        const res = await fetch(`/api/payments/${selectedPayment.id}/slips`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Image: base64,
            fileName: file.name,
          }),
        });

        if (res.ok) {
          // Refresh data
          await fetchData();
          // Update selected payment
          const updatedPayment = payments.find((p) => p.id === selectedPayment.id);
          if (updatedPayment) {
            setSelectedPayment(updatedPayment);
          }
          // Refetch slips for this payment
          const slipsRes = await fetch(`/api/payments/${selectedPayment.id}/slips`);
          if (slipsRes.ok) {
            const slips = await slipsRes.json();
            setSelectedPayment((prev) => (prev ? { ...prev, slips } : null));
          }
        }
        setUploadingSlip(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading slip:", error);
      setUploadingSlip(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteSlip = async (slipId: string) => {
    if (!selectedPayment) return;

    setDeletingSlipId(slipId);
    try {
      const res = await fetch(`/api/payments/${selectedPayment.id}/slips/${slipId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Update local state
        setSelectedPayment((prev) =>
          prev ? { ...prev, slips: prev.slips.filter((s) => s.id !== slipId) } : null
        );
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting slip:", error);
    } finally {
      setDeletingSlipId(null);
    }
  };

  // Edit payment handlers
  const handleOpenEditDialog = (payment: Payment) => {
    setEditingPayment(payment);
    setEditFormData({
      amount: String(payment.amount),
      method: payment.method as "CASH" | "CHECK" | "TRANSFER",
      checkNo: "",
      checkBank: "",
      checkDate: "",
      transferRef: payment.transferRef || "",
      transferBank: "",
      notes: "",
    });
    setIsEditOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !editFormData.amount) return;

    setUpdatingPayment(true);
    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(editFormData.amount),
          method: editFormData.method,
          checkNo: editFormData.method === "CHECK" ? editFormData.checkNo : undefined,
          checkBank: editFormData.method === "CHECK" ? editFormData.checkBank : undefined,
          checkDate: editFormData.method === "CHECK" ? editFormData.checkDate : undefined,
          transferRef: editFormData.method === "TRANSFER" ? editFormData.transferRef : undefined,
          transferBank: editFormData.method === "TRANSFER" ? editFormData.transferBank : undefined,
          notes: editFormData.notes || undefined,
        }),
      });

      if (res.ok) {
        toast({
          title: t("paymentUpdated") || "Payment Updated",
          description: t("paymentUpdatedDesc") || "Payment has been updated successfully",
        });
        setIsEditOpen(false);
        setEditingPayment(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error") || "Error",
          description: data.error || "Failed to update payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating payment:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setUpdatingPayment(false);
    }
  };

  // Delete payment handlers
  const handleOpenDeleteDialog = (payment: Payment) => {
    setDeletingPayment(payment);
    setIsDeleteOpen(true);
  };

  const handleDeletePayment = async () => {
    if (!deletingPayment) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: t("paymentDeleted") || "Payment Deleted",
          description: t("paymentDeletedDesc") || "Payment has been deleted successfully",
        });
        setIsDeleteOpen(false);
        setDeletingPayment(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error") || "Error",
          description: data.error || "Failed to delete payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: tCommon("error") || "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "VERIFIED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "LINE_CHAT":
        return "LINE";
      case "LIFF":
        return "LIFF";
      case "MANUAL":
        return "Manual";
      default:
        return source;
    }
  };

  // Sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4 inline" />
    );
  };

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    switch (sortColumn) {
      case "invoiceNo":
        return direction * a.invoice.invoiceNo.localeCompare(b.invoice.invoiceNo);
      case "project":
        return direction * a.invoice.project.name.localeCompare(b.invoice.project.name);
      case "unit":
        return direction * a.invoice.unit.unitNumber.localeCompare(b.invoice.unit.unitNumber);
      case "tenant":
        return direction * a.tenant.name.localeCompare(b.tenant.name);
      case "amount":
        return direction * (a.amount - b.amount);
      case "method":
        return direction * a.method.localeCompare(b.method);
      case "status":
        return direction * a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  if (loading) {
    return <PageSkeleton columns={7} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Button onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createPayment") || "บันทึกการชำระ"}
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
              <SelectItem key={project.id} value={project.name}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter || "__all__"}
          onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tCommon("all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tCommon("all")}</SelectItem>
            <SelectItem value="PENDING">{t("statuses.PENDING")}</SelectItem>
            <SelectItem value="VERIFIED">{t("statuses.VERIFIED")}</SelectItem>
            <SelectItem value="REJECTED">{t("statuses.REJECTED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("invoiceNo")}>
                  Invoice <SortIcon column="invoiceNo" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project")}>
                  Project <SortIcon column="project" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                  Unit <SortIcon column="unit" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("tenant")}>
                  Tenant <SortIcon column="tenant" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                  {t("amount")} <SortIcon column="amount" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("method")}>
                  {t("method")} <SortIcon column="method" />
                </TableHead>
                <TableHead>{t("slipUrl")}</TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                  {tCommon("status")} <SortIcon column="status" />
                </TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.invoice.invoiceNo}</TableCell>
                    <TableCell>{payment.invoice.project.name}</TableCell>
                    <TableCell>{payment.invoice.unit.unitNumber}</TableCell>
                    <TableCell>{payment.tenant.name}</TableCell>
                    <TableCell>฿{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>{t(`methods.${payment.method}`)}</TableCell>
                    <TableCell>
                      {payment.slips && payment.slips.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleOpenSlips(payment)}
                        >
                          <Image className="h-4 w-4" />
                          <span>{payment.slips.length}</span>
                        </Button>
                      ) : payment.slipUrl ? (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={payment.slipUrl} target="_blank" rel="noopener noreferrer">
                            <Image className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => handleOpenSlips(payment)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(payment.status)}>
                        {t(`statuses.${payment.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {payment.status === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => handleVerify(payment.id, true)}
                              title={t("verifyPayment")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600"
                              onClick={() => handleVerify(payment.id, false)}
                              title={t("rejectPayment")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditDialog(payment)}
                              title={t("editPayment") || "Edit"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600"
                              onClick={() => handleOpenDeleteDialog(payment)}
                              title={t("deletePayment") || "Delete"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Slips Dialog */}
      <Dialog open={isSlipsOpen} onOpenChange={setIsSlipsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              สลิปการชำระเงิน - {selectedPayment?.invoice.invoiceNo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Slips Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedPayment?.slips.map((slip) => (
                <div key={slip.id} className="relative group">
                  <a href={slip.presignedUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={slip.presignedUrl}
                      alt={slip.fileName || "Payment slip"}
                      className="w-full h-32 object-cover rounded-lg border hover:opacity-90"
                    />
                  </a>
                  <div className="absolute bottom-1 left-1">
                    <Badge variant="secondary" className="text-xs">
                      {getSourceLabel(slip.source)}
                    </Badge>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteSlip(slip.id)}
                    disabled={deletingSlipId === slip.id}
                  >
                    {deletingSlipId === slip.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}

              {/* Add Slip Button */}
              <div
                className="w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary hover:bg-accent transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingSlip ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Plus className="h-6 w-6 mx-auto mb-1" />
                    <span className="text-sm">เพิ่มสลิป</span>
                  </div>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsSlipsOpen(false)}>
                ปิด
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Payment Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createPayment") || "บันทึกการชำระเงิน"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            {/* Project Filter */}
            <div className="space-y-2">
              <Label>{t("project") || "โครงการ"}</Label>
              <Select
                value={selectedProjectId || "__all__"}
                onValueChange={(v) => handleProjectChange(v === "__all__" ? "" : v)}
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
                  const inv = unpaidInvoices.find((i) => i.id === v);
                  setCreateFormData((prev) => ({
                    ...prev,
                    invoiceId: v,
                    amount: inv ? String(inv.totalAmount - inv.paidAmount) : "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectInvoicePlaceholder") || "เลือกใบแจ้งหนี้"} />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      {t("noUnpaidInvoices") || "ไม่มีใบแจ้งหนี้ค้างชำระ"}
                    </SelectItem>
                  ) : (
                    unpaidInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNo} - {inv.project.name} - {inv.unit.unitNumber} (฿{(inv.totalAmount - inv.paidAmount).toLocaleString()})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Invoice Info */}
            {selectedInvoice && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tenant") || "ผู้เช่า"}:</span>
                  <span>{selectedInvoice.tenant.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalAmount") || "ยอดรวม"}:</span>
                  <span>฿{selectedInvoice.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("paidAmount") || "ชำระแล้ว"}:</span>
                  <span>฿{selectedInvoice.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("remainingAmount") || "คงเหลือ"}:</span>
                  <span className="text-primary">฿{remainingAmount.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label>{t("amount") || "จำนวนเงิน"} *</Label>
              <Input
                type="number"
                step="0.01"
                value={createFormData.amount}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{t("method") || "วิธีชำระ"} *</Label>
              <Select
                value={createFormData.method}
                onValueChange={(v) => setCreateFormData((prev) => ({ ...prev, method: v as "CASH" | "CHECK" | "TRANSFER" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t("methods.CASH") || "เงินสด"}</SelectItem>
                  <SelectItem value="CHECK">{t("methods.CHECK") || "เช็ค"}</SelectItem>
                  <SelectItem value="TRANSFER">{t("methods.TRANSFER") || "โอนเงิน"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Check Fields */}
            {createFormData.method === "CHECK" && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("checkNo") || "เลขที่เช็ค"}</Label>
                    <Input
                      value={createFormData.checkNo}
                      onChange={(e) => setCreateFormData((prev) => ({ ...prev, checkNo: e.target.value }))}
                      placeholder="เลขที่เช็ค"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("checkBank") || "ธนาคาร"}</Label>
                    <Input
                      value={createFormData.checkBank}
                      onChange={(e) => setCreateFormData((prev) => ({ ...prev, checkBank: e.target.value }))}
                      placeholder="ชื่อธนาคาร"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("checkDate") || "วันที่เช็ค"}</Label>
                  <Input
                    type="date"
                    value={createFormData.checkDate}
                    onChange={(e) => setCreateFormData((prev) => ({ ...prev, checkDate: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Transfer Fields */}
            {createFormData.method === "TRANSFER" && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("transferRef") || "เลขอ้างอิง"}</Label>
                    <Input
                      value={createFormData.transferRef}
                      onChange={(e) => setCreateFormData((prev) => ({ ...prev, transferRef: e.target.value }))}
                      placeholder="เลขอ้างอิงการโอน"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transferBank") || "ธนาคาร"}</Label>
                    <Input
                      value={createFormData.transferBank}
                      onChange={(e) => setCreateFormData((prev) => ({ ...prev, transferBank: e.target.value }))}
                      placeholder="ชื่อธนาคาร"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t("notes") || "หมายเหตุ"}</Label>
              <Input
                value={createFormData.notes}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t("notesPlaceholder") || "หมายเหตุเพิ่มเติม (ถ้ามี)"}
              />
            </div>

            {/* Auto Verify Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoVerify"
                checked={createFormData.autoVerify}
                onChange={(e) => setCreateFormData((prev) => ({ ...prev, autoVerify: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="autoVerify" className="text-sm font-normal">
                {t("autoVerifyPayment") || "ยืนยันการชำระทันที (สร้างใบเสร็จอัตโนมัติถ้าครบยอด)"}
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creatingPayment}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={creatingPayment || !createFormData.invoiceId || !createFormData.amount}>
                {creatingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("savePayment") || "บันทึก"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editPayment") || "แก้ไขการชำระเงิน"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            {/* Invoice Info (read-only) */}
            {editingPayment && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("invoice") || "ใบแจ้งหนี้"}:</span>
                  <span>{editingPayment.invoice.invoiceNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("tenant") || "ผู้เช่า"}:</span>
                  <span>{editingPayment.tenant.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("unit") || "ห้อง"}:</span>
                  <span>{editingPayment.invoice.unit.unitNumber}</span>
                </div>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label>{t("amount") || "จำนวนเงิน"} *</Label>
              <Input
                type="number"
                step="0.01"
                value={editFormData.amount}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{t("method") || "วิธีชำระ"} *</Label>
              <Select
                value={editFormData.method}
                onValueChange={(v) => setEditFormData((prev) => ({ ...prev, method: v as "CASH" | "CHECK" | "TRANSFER" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t("methods.CASH") || "เงินสด"}</SelectItem>
                  <SelectItem value="CHECK">{t("methods.CHECK") || "เช็ค"}</SelectItem>
                  <SelectItem value="TRANSFER">{t("methods.TRANSFER") || "โอนเงิน"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Check Fields */}
            {editFormData.method === "CHECK" && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("checkNo") || "เลขที่เช็ค"}</Label>
                    <Input
                      value={editFormData.checkNo}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, checkNo: e.target.value }))}
                      placeholder="เลขที่เช็ค"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("checkBank") || "ธนาคาร"}</Label>
                    <Input
                      value={editFormData.checkBank}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, checkBank: e.target.value }))}
                      placeholder="ชื่อธนาคาร"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("checkDate") || "วันที่เช็ค"}</Label>
                  <Input
                    type="date"
                    value={editFormData.checkDate}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, checkDate: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Transfer Fields */}
            {editFormData.method === "TRANSFER" && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("transferRef") || "เลขอ้างอิง"}</Label>
                    <Input
                      value={editFormData.transferRef}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, transferRef: e.target.value }))}
                      placeholder="เลขอ้างอิงการโอน"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("transferBank") || "ธนาคาร"}</Label>
                    <Input
                      value={editFormData.transferBank}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, transferBank: e.target.value }))}
                      placeholder="ชื่อธนาคาร"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>{t("notes") || "หมายเหตุ"}</Label>
              <Input
                value={editFormData.notes}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t("notesPlaceholder") || "หมายเหตุเพิ่มเติม (ถ้ามี)"}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={updatingPayment}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={updatingPayment || !editFormData.amount}>
                {updatingPayment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("savePayment") || "บันทึก"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeletePayment") || "ยืนยันการลบ"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeletePaymentDesc") || "คุณแน่ใจหรือไม่ว่าต้องการลบการชำระเงินนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้"}
              {deletingPayment && (
                <div className="mt-2 p-2 bg-muted rounded text-foreground">
                  <div>{t("invoice") || "ใบแจ้งหนี้"}: {deletingPayment.invoice.invoiceNo}</div>
                  <div>{t("amount") || "จำนวน"}: ฿{deletingPayment.amount.toLocaleString()}</div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon("delete") || "ลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
