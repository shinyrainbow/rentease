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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, X, Image, Plus, Trash2, Loader2, Search } from "lucide-react";

interface Project {
  id: string;
  name: string;
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

  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSlipsOpen, setIsSlipsOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [deletingSlipId, setDeletingSlipId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setPayments(paymentsData);
      setProjects(projectsData);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
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
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead>{t("slipUrl")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
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
                      {payment.status === "PENDING" && (
                        <div className="flex gap-1">
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
                        </div>
                      )}
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
    </div>
  );
}
