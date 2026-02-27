"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DateInput } from "@/components/ui/date-input";
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
import { Plus, Edit, Trash2, Search, Loader2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Camera, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { CalendarView } from "@/components/ui/calendar-view";
import { LayoutList, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Image from "next/image";

interface Project {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  projectId: string;
  project: { name: string };
  tenant: {
    name: string;
    contractStart: string;
    contractEnd: string;
  } | null;
}

interface Tenant {
  id: string;
  unitId: string;
  name: string;
  nameTh: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  idCard: string | null;
  taxId: string | null;
  tenantType: string;
  withholdingTax: number;
  // Contract pricing
  baseRent: number;
  contractStart: string;
  contractEnd: string;
  imageUrl: string | null;
  unit: {
    unitNumber: string;
    projectId: string;
    project: { name: string };
  };
  invoices?: Array<{ id: string; invoiceNo: string }>;
}

export default function TenantsPage() {
  const t = useTranslations("tenants");
  const tCommon = useTranslations("common");

  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dateError, setDateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const [formProjectFilter, setFormProjectFilter] = useState<string>("");

  const [formData, setFormData] = useState({
    unitId: "",
    name: "",
    nameTh: "",
    companyName: "",
    companyNameTh: "",
    email: "",
    phone: "",
    address: "",
    idCard: "",
    taxId: "",
    tenantType: "INDIVIDUAL",
    withholdingTax: "0",
    // Contract pricing
    baseRent: "",
    contractStart: "",
    contractEnd: "",
  });

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const [tenantsRes, unitsRes, projectsRes] = await Promise.all([
        fetch(`/api/tenants?${params.toString()}`),
        fetch("/api/units"),
        fetch("/api/projects"),
      ]);
      const [tenantsData, unitsData, projectsData] = await Promise.all([
        tenantsRes.json(),
        unitsRes.json(),
        projectsRes.json(),
      ]);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      // Show all units (not just vacant) - allow selecting units with existing tenants
      setAllUnits(Array.isArray(unitsData) ? unitsData : []);
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

  // Filter tenants by project and search query (client-side filtering)
  const filteredTenants = tenants.filter((tenant) => {
    // Project filter
    if (projectFilter && tenant.unit.project.name !== projectFilter) {
      return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tenant.name.toLowerCase().includes(query) ||
        (tenant.nameTh && tenant.nameTh.toLowerCase().includes(query)) ||
        (tenant.phone && tenant.phone.includes(query)) ||
        (tenant.email && tenant.email.toLowerCase().includes(query)) ||
        tenant.unit.unitNumber.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    setFormError(null);

    // contractStart and contractEnd are required
    if (!formData.contractStart || !formData.contractEnd) {
      const errorMsg = t("contractDatesRequired") || "Contract start and end dates are required";
      setDateError(errorMsg);
      toast({
        title: tCommon("error"),
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Validate contract start date is less than contract end date
    const startDate = new Date(formData.contractStart);
    const endDate = new Date(formData.contractEnd);

    if (startDate >= endDate) {
      const errorMsg = t("contractStartMustBeLessThanEnd") || "Contract start date must be less than contract end date";
      setDateError(errorMsg);
      toast({
        title: tCommon("error"),
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingTenant ? `/api/tenants/${editingTenant.id}` : "/api/tenants";
      const method = editingTenant ? "PUT" : "POST";

      // Set name based on tenant type
      const name = formData.tenantType === "INDIVIDUAL" ? formData.name : formData.companyName;
      const nameTh = formData.tenantType === "INDIVIDUAL" ? formData.nameTh : formData.companyNameTh;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          name,
          nameTh,
          withholdingTax: parseFloat(formData.withholdingTax),
          baseRent: formData.baseRent ? parseFloat(formData.baseRent) : 0,
          contractStart: formData.contractStart,
          contractEnd: formData.contractEnd,
        }),
      });

      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: editingTenant
            ? `${name} ${tCommon("updated")}`
            : `${name} ${tCommon("created")}`,
        });
        setIsDialogOpen(false);
        setEditingTenant(null);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        const errorMsg = data.error || "Failed to save tenant";
        setFormError(errorMsg);
        toast({
          title: tCommon("error"),
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving tenant:", error);
      const errorMsg = "Network error";
      setFormError(errorMsg);
      toast({
        title: tCommon("error"),
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setDateError(null);
    setEditingTenant(tenant);
    setFormData({
      unitId: "",
      name: tenant.tenantType === "INDIVIDUAL" ? tenant.name : "",
      nameTh: tenant.tenantType === "INDIVIDUAL" ? (tenant.nameTh || "") : "",
      companyName: tenant.tenantType === "COMPANY" ? tenant.name : "",
      companyNameTh: tenant.tenantType === "COMPANY" ? (tenant.nameTh || "") : "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      address: tenant.address || "",
      idCard: tenant.idCard || "",
      taxId: tenant.taxId || "",
      tenantType: tenant.tenantType,
      withholdingTax: tenant.withholdingTax.toString(),
      baseRent: tenant.baseRent?.toString() || "",
      contractStart: tenant.contractStart ? tenant.contractStart.split("T")[0] : "",
      contractEnd: tenant.contractEnd ? tenant.contractEnd.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = async (tenant: Tenant) => {
    // First check if the tenant has linked invoices
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`);
      if (res.ok) {
        const data = await res.json();
        const hasInvoices = data.invoices && data.invoices.length > 0;

        if (hasInvoices) {
          toast({
            title: "Cannot Delete Tenant",
            description: `This tenant has ${data.invoices.length} invoice(s) linked. Historical data must be preserved and cannot be deleted.`,
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      console.error("Error checking tenant data:", error);
    }

    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!tenantToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${tenantToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: `${tenantToDelete.name} ${tCommon("deleted")}`,
        });
        setDeleteDialogOpen(false);
        setTenantToDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.details || data.error || "Failed to delete tenant",
          variant: "destructive",
        });
        setDeleteDialogOpen(false);
        setTenantToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleImageUpload = async (tenantId: string, file: File) => {
    setUploadingImageFor(tenantId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "tenant");
      formData.append("tenantId", tenantId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: tCommon("success"),
          description: "Image uploaded",
        });
        // Update editingTenant if we're editing this tenant
        if (editingTenant && editingTenant.id === tenantId && data.url) {
          setEditingTenant({ ...editingTenant, imageUrl: data.url });
        }
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to upload image",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setUploadingImageFor(null);
    }
  };

  const getStatusBadgeColor = (status: "ACTIVE" | "EXPIRED" | "UPCOMING") => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800";
      case "UPCOMING": return "bg-blue-100 text-blue-800";
      case "EXPIRED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Format number with commas for display, store raw value
  const fmtNum = (val: string) => {
    const raw = val.replace(/,/g, "");
    if (raw === "" || raw === "-") return raw;
    const parts = raw.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  };

  const onNumChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
    setFormData((prev) => ({ ...prev, [field]: raw }));
  };

  const resetForm = () => {
    setFormData({
      unitId: "",
      name: "",
      nameTh: "",
      companyName: "",
      companyNameTh: "",
      email: "",
      phone: "",
      address: "",
      idCard: "",
      taxId: "",
      tenantType: "INDIVIDUAL",
      withholdingTax: "0",
      baseRent: "",
      contractStart: "",
      contractEnd: "",
    });
    setFormProjectFilter("");
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

  const sortedTenants = [...filteredTenants].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    switch (sortColumn) {
      case "name":
        return direction * a.name.localeCompare(b.name);
      case "unit":
        return direction * a.unit.unitNumber.localeCompare(b.unit.unitNumber);
      case "project":
        return direction * a.unit.project.name.localeCompare(b.unit.project.name);
      case "tenantType":
        return direction * a.tenantType.localeCompare(b.tenantType);
      case "status":
        return direction * getDisplayStatus(a).localeCompare(getDisplayStatus(b));
      case "contractStart":
        return direction * ((a.contractStart ? new Date(a.contractStart).getTime() : 0) - (b.contractStart ? new Date(b.contractStart).getTime() : 0));
      case "contractEnd":
        return direction * ((a.contractEnd ? new Date(a.contractEnd).getTime() : 0) - (b.contractEnd ? new Date(b.contractEnd).getTime() : 0));
      default:
        return 0;
    }
  });

  // Client-side status calculation based on contract dates
  const getDisplayStatus = (tenant: Tenant): "ACTIVE" | "EXPIRED" | "UPCOMING" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If no start date, assume active
    if (!tenant.contractStart) {
      // If no end date either, assume active
      if (!tenant.contractEnd) return "ACTIVE";
      const endDate = new Date(tenant.contractEnd);
      endDate.setHours(0, 0, 0, 0);
      return today <= endDate ? "ACTIVE" : "EXPIRED";
    }

    // Check if contract hasn't started yet
    const startDate = new Date(tenant.contractStart);
    startDate.setHours(0, 0, 0, 0);
    if (today < startDate) {
      return "UPCOMING";
    }

    // If no end date, assume still active (no end = indefinite)
    if (!tenant.contractEnd) return "ACTIVE";

    // Compare today with contract end date
    const endDate = new Date(tenant.contractEnd);
    endDate.setHours(0, 0, 0, 0);

    return today <= endDate ? "ACTIVE" : "EXPIRED";
  };

  if (loading) {
    return <PageSkeleton columns={7} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setFormError(null); setDateError(null); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingTenant(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addTenant")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTenant ? t("editTenant") : t("addTenant")}</DialogTitle>
            </DialogHeader>

            {/* Image upload section - only when editing */}
            {editingTenant && (
              <div className="flex items-center gap-4 pb-2 border-b">
                <label className="cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && editingTenant) handleImageUpload(editingTenant.id, file);
                    }}
                  />
                  {editingTenant.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                      <Image
                        src={editingTenant.imageUrl}
                        alt={editingTenant.name}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {uploadingImageFor === editingTenant.id ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                      {uploadingImageFor === editingTenant.id ? (
                        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </label>
                <div className="text-sm text-muted-foreground">
                  {t("clickToUploadImage") || "Click to upload photo"}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-2">
              {formError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              {!editingTenant && (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">โครงการ / Project</Label>
                      <Select
                        value={formProjectFilter || undefined}
                        onValueChange={(v) => {
                          setFormProjectFilter(v);
                          setFormData({ ...formData, unitId: "" });
                          setDateError(null);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="เลือกโครงการ" />
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
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={formData.unitId || undefined}
                        onValueChange={(value) => {
                          setFormData({ ...formData, unitId: value });
                          setDateError(null);
                        }}
                        disabled={!formProjectFilter}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={formProjectFilter ? "เลือกห้อง" : "กรุณาเลือกโครงการก่อน"} />
                        </SelectTrigger>
                        <SelectContent>
                          {allUnits
                            .filter((unit) => unit.projectId === formProjectFilter)
                            .map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.unitNumber}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("tenantType")}</Label>
                  <Select
                    value={formData.tenantType}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        tenantType: value,
                        withholdingTax: value === "COMPANY" ? "5" : "0",
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">{t("types.INDIVIDUAL")}</SelectItem>
                      <SelectItem value="COMPANY">{t("types.COMPANY")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("withholdingTax")} %</Label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    value={formData.withholdingTax}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); setFormData({ ...formData, withholdingTax: v }); }}
                  />
                </div>
              </div>

              {/* Name fields */}
              {formData.tenantType === "INDIVIDUAL" ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("name")} *</Label>
                    <Input className="h-9" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    <p className="text-xs text-muted-foreground">ชื่อภาษาอังกฤษ (ใช้ในระบบ)</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("nameTh")}</Label>
                    <Input className="h-9" value={formData.nameTh} onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })} />
                    <p className="text-xs text-muted-foreground">ชื่อภาษาไทย (แสดงในใบแจ้งหนี้)</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("idCard")}</Label>
                    <Input className="h-9" value={formData.idCard} onChange={(e) => setFormData({ ...formData, idCard: e.target.value })} placeholder="X-XXXX-XXXXX-XX-X" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("companyName")} *</Label>
                    <Input className="h-9" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} required />
                    <p className="text-xs text-muted-foreground">ชื่อบริษัทภาษาอังกฤษ</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("companyNameTh")}</Label>
                    <Input className="h-9" value={formData.companyNameTh} onChange={(e) => setFormData({ ...formData, companyNameTh: e.target.value })} />
                    <p className="text-xs text-muted-foreground">ชื่อบริษัทภาษาไทย (แสดงในใบแจ้งหนี้)</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("taxId")}</Label>
                    <Input className="h-9" value={formData.taxId} onChange={(e) => setFormData({ ...formData, taxId: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Contact */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("email")}</Label>
                  <Input className="h-9" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("phone")}</Label>
                  <Input className="h-9" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <Label className="text-xs">Address / ที่อยู่</Label>
                <Input className="h-9" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Address for invoice" />
                <p className="text-xs text-muted-foreground">ที่อยู่สำหรับออกใบแจ้งหนี้/ใบเสร็จ</p>
              </div>

              {/* Contract Pricing */}
              <div className="border-t pt-2">
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("contractPricing")}</h4>
                <div className="space-y-1">
                  <Label className="text-xs">{t("baseRent")} *</Label>
                  <Input className="h-9" inputMode="decimal" value={fmtNum(formData.baseRent)} onChange={onNumChange("baseRent")} required />
                  <p className="text-xs text-muted-foreground">{t("baseRentHint")}</p>
                </div>
              </div>

              {/* Contract */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("contractStart")} <span className="text-red-500">*</span> <span className="text-muted-foreground">(วัน เดือน ปี)</span></Label>
                  <DateInput className="h-9" required value={formData.contractStart} onChange={(v) => setFormData({ ...formData, contractStart: v })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("contractEnd")} <span className="text-red-500">*</span> <span className="text-muted-foreground">(วัน เดือน ปี)</span></Label>
                  <DateInput className="h-9" required value={formData.contractEnd} onChange={(v) => setFormData({ ...formData, contractEnd: v })} />
                </div>
              </div>
              {dateError && <p className="text-xs text-red-600">{dateError}</p>}
              {(formData.contractStart || formData.contractEnd) && formData.unitId && (() => {
                const selectedUnit = allUnits.find(u => u.id === formData.unitId);
                if (selectedUnit?.tenant) {
                  return (
                    <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs">
                      <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-yellow-800">Unit has active tenant: {selectedUnit.tenant.name}</p>
                        <p className="text-yellow-600">Ends {formatDate(selectedUnit.tenant.contractEnd)}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setIsDialogOpen(false); setDateError(null); setFormError(null); }} disabled={saving}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("")}
        >
          {tCommon("all")}
        </Button>
        <Button
          variant={statusFilter === "ACTIVE" ? "default" : "outline"}
          size="sm"
          className={statusFilter === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}
          onClick={() => setStatusFilter(statusFilter === "ACTIVE" ? "" : "ACTIVE")}
        >
          {t("statuses.ACTIVE")}
        </Button>
        <Button
          variant={statusFilter === "UPCOMING" ? "default" : "outline"}
          size="sm"
          className={statusFilter === "UPCOMING" ? "bg-blue-600 hover:bg-blue-700" : ""}
          onClick={() => setStatusFilter(statusFilter === "UPCOMING" ? "" : "UPCOMING")}
        >
          {t("statuses.UPCOMING")}
        </Button>
        <Button
          variant={statusFilter === "EXPIRED" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "EXPIRED" ? "" : "EXPIRED")}
        >
          {t("statuses.EXPIRED")}
        </Button>
        <Button
          variant={statusFilter === "TERMINATED" ? "destructive" : "outline"}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === "TERMINATED" ? "" : "TERMINATED")}
        >
          {t("statuses.TERMINATED")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={projectFilter || "__all__"} onValueChange={(v) => setProjectFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allProjects")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allProjects")}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.name}>
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
            <SelectItem value="ACTIVE">{t("statuses.ACTIVE")}</SelectItem>
            <SelectItem value="UPCOMING">{t("statuses.UPCOMING")}</SelectItem>
            <SelectItem value="EXPIRED">{t("statuses.EXPIRED")}</SelectItem>
            <SelectItem value="TERMINATED">{t("statuses.TERMINATED")}</SelectItem>
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => setViewMode("table")}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "calendar" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => setViewMode("calendar")}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView
          events={sortedTenants.flatMap((tenant) => {
            const events = [];
            if (tenant.contractEnd) {
              events.push({
                id: `end-${tenant.id}`,
                title: tenant.name,
                date: new Date(tenant.contractEnd),
                type: "expiring" as const,
                details: `${tenant.unit.project.name} - ${tenant.unit.unitNumber}`,
              });
            }
            if (tenant.contractStart) {
              events.push({
                id: `start-${tenant.id}`,
                title: tenant.name,
                date: new Date(tenant.contractStart),
                type: "starting" as const,
                details: `${tenant.unit.project.name} - ${tenant.unit.unitNumber}`,
              });
            }
            return events;
          })}
        />
      ) : (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                  {t("name")} <SortIcon column="name" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                  Unit <SortIcon column="unit" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project")}>
                  Project <SortIcon column="project" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("tenantType")}>
                  {t("tenantType")} <SortIcon column="tenantType" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                  {tCommon("status")} <SortIcon column="status" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("contractStart")}>
                  {t("contractStart")} <SortIcon column="contractStart" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("contractEnd")}>
                  {t("contractEnd")} <SortIcon column="contractEnd" />
                </TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="w-16">
                      <label className="cursor-pointer relative group">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(tenant.id, file);
                          }}
                        />
                        {tenant.imageUrl ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                            <Image
                              src={tenant.imageUrl}
                              alt={tenant.name}
                              fill
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              {uploadingImageFor === tenant.id ? (
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                              ) : (
                                <Camera className="h-4 w-4 text-white" />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                            {uploadingImageFor === tenant.id ? (
                              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </label>
                    </TableCell>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.unit.unitNumber}</TableCell>
                    <TableCell>{tenant.unit.project.name}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.tenantType === "COMPANY" ? "default" : "secondary"}>
                        {t(`types.${tenant.tenantType}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(getDisplayStatus(tenant))}>
                        {t(`statuses.${getDisplayStatus(tenant)}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(tenant.contractStart)}</TableCell>
                    <TableCell>{formatDate(tenant.contractEnd)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)} title={t("editTenant")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(tenant)} title={tCommon("delete")}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tenantToDelete?.invoices && tenantToDelete.invoices.length > 0
                ? t("cannotDeleteTenantTitle")
                : t("deleteTenant")}
            </DialogTitle>
          </DialogHeader>
          {tenantToDelete?.invoices && tenantToDelete.invoices.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-medium">
                {t("cannotDeleteTenantMessage", { count: tenantToDelete.invoices.length })}
              </p>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{tenantToDelete.name}</p>
                <p className="text-xs text-muted-foreground">{tenantToDelete.unit.unitNumber}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Linked invoices: {tenantToDelete.invoices.map(inv => inv.invoiceNo).join(", ")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {tenantToDelete?.name} - {tenantToDelete?.unit.unitNumber}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (tenantToDelete?.invoices && tenantToDelete.invoices.length > 0)}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Contract Confirmation Dialog */}
    </div>
  );
}
