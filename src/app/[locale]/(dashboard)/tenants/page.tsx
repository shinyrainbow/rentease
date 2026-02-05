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
import { Plus, Edit, Trash2, UserX, Search, Loader2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { CalendarView } from "@/components/ui/calendar-view";
import { LayoutList, Calendar } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  project: { name: string };
  tenant: {
    name: string;
    contractStart: string | null;
    contractEnd: string | null;
  } | null;
}

interface Tenant {
  id: string;
  name: string;
  nameTh: string | null;
  email: string | null;
  phone: string | null;
  tenantType: string;
  withholdingTax: number;
  // Contract pricing
  baseRent: number;
  commonFee: number | null;
  deposit: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  // Meter info
  electricMeterNo: string | null;
  waterMeterNo: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  unit: {
    unitNumber: string;
    project: { name: string };
  };
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
  const [endContractDialogOpen, setEndContractDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [tenantToEndContract, setTenantToEndContract] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [dateError, setDateError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const [formData, setFormData] = useState({
    unitId: "",
    name: "",
    nameTh: "",
    companyName: "",
    companyNameTh: "",
    email: "",
    phone: "",
    idCard: "",
    taxId: "",
    tenantType: "INDIVIDUAL",
    withholdingTax: "0",
    // Contract pricing
    baseRent: "",
    commonFee: "",
    deposit: "",
    discountPercent: "",
    discountAmount: "",
    // Meter info
    electricMeterNo: "",
    waterMeterNo: "",
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
      setTenants(tenantsData);
      // Show all units (not just vacant) - allow selecting units with existing tenants
      setAllUnits(unitsData);
      setProjects(projectsData);
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

    // Validate contract dates if unit has existing tenant
    if (!editingTenant && formData.unitId) {
      const selectedUnit = allUnits.find(u => u.id === formData.unitId);
      if (selectedUnit?.tenant?.contractEnd) {
        const currentContractEnd = new Date(selectedUnit.tenant.contractEnd);
        const newContractStart = formData.contractStart ? new Date(formData.contractStart) : null;

        if (!newContractStart) {
          setDateError("Contract start date is required when unit has existing tenant");
          toast({
            title: tCommon("error"),
            description: "Contract start date is required when unit has existing tenant",
            variant: "destructive",
          });
          return;
        }

        if (newContractStart <= currentContractEnd) {
          const errorMsg = `Contract start date must be after ${currentContractEnd.toLocaleDateString()} (current tenant's contract end)`;
          setDateError(errorMsg);
          toast({
            title: tCommon("error"),
            description: errorMsg,
            variant: "destructive",
          });
          return;
        }
      }
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
          commonFee: formData.commonFee ? parseFloat(formData.commonFee) : null,
          deposit: formData.deposit ? parseFloat(formData.deposit) : null,
          discountPercent: formData.discountPercent ? parseFloat(formData.discountPercent) : 0,
          discountAmount: formData.discountAmount ? parseFloat(formData.discountAmount) : 0,
          contractStart: formData.contractStart || null,
          contractEnd: formData.contractEnd || null,
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
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to save tenant",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving tenant:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      unitId: "",
      name: tenant.tenantType === "INDIVIDUAL" ? tenant.name : "",
      nameTh: tenant.tenantType === "INDIVIDUAL" ? (tenant.nameTh || "") : "",
      companyName: tenant.tenantType === "COMPANY" ? tenant.name : "",
      companyNameTh: tenant.tenantType === "COMPANY" ? (tenant.nameTh || "") : "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      idCard: "",
      taxId: "",
      tenantType: tenant.tenantType,
      withholdingTax: tenant.withholdingTax.toString(),
      baseRent: tenant.baseRent?.toString() || "",
      commonFee: tenant.commonFee?.toString() || "",
      deposit: tenant.deposit?.toString() || "",
      discountPercent: tenant.discountPercent?.toString() || "",
      discountAmount: tenant.discountAmount?.toString() || "",
      electricMeterNo: tenant.electricMeterNo || "",
      waterMeterNo: tenant.waterMeterNo || "",
      contractStart: tenant.contractStart ? tenant.contractStart.split("T")[0] : "",
      contractEnd: tenant.contractEnd ? tenant.contractEnd.split("T")[0] : "",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (tenant: Tenant) => {
    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  };

  const openEndContractDialog = (tenant: Tenant) => {
    setTenantToEndContract(tenant);
    setEndContractDialogOpen(true);
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
        toast({
          title: tCommon("error"),
          description: "Failed to delete tenant",
          variant: "destructive",
        });
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

  const handleEndContract = async () => {
    if (!tenantToEndContract) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/tenants/${tenantToEndContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_contract" }),
      });
      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: "Contract ended",
        });
        setEndContractDialogOpen(false);
        setTenantToEndContract(null);
        fetchData();
      } else {
        toast({
          title: tCommon("error"),
          description: "Failed to end contract",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error ending contract:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadgeColor = (status: "ACTIVE" | "EXPIRED") => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800";
      case "EXPIRED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
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
      idCard: "",
      taxId: "",
      tenantType: "INDIVIDUAL",
      withholdingTax: "0",
      baseRent: "",
      commonFee: "",
      deposit: "",
      discountPercent: "",
      discountAmount: "",
      electricMeterNo: "",
      waterMeterNo: "",
      contractStart: "",
      contractEnd: "",
    });
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
      case "phone":
        return direction * (a.phone || "").localeCompare(b.phone || "");
      case "contractEnd":
        const aDate = a.contractEnd ? new Date(a.contractEnd).getTime() : 0;
        const bDate = b.contractEnd ? new Date(b.contractEnd).getTime() : 0;
        return direction * (aDate - bDate);
      default:
        return 0;
    }
  });

  // Client-side status calculation based on contract end date
  const getDisplayStatus = (tenant: Tenant): "ACTIVE" | "EXPIRED" => {
    // If no contract end date, assume active
    if (!tenant.contractEnd) {
      return "ACTIVE";
    }

    // Compare today with contract end date
    const endDate = new Date(tenant.contractEnd);
    const today = new Date();

    // Normalize both dates (ignore time)
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return today <= endDate ? "ACTIVE" : "EXPIRED";
  };

  if (loading) {
    return <PageSkeleton columns={7} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <form onSubmit={handleSubmit} className="space-y-2">
              {!editingTenant && (
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={formData.unitId || undefined}
                    onValueChange={(value) => {
                      setFormData({ ...formData, unitId: value });
                      setDateError(null);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.project.name} - {unit.unitNumber}
                          {unit.tenant && ` (${unit.tenant.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.unitId && (() => {
                    const selectedUnit = allUnits.find(u => u.id === formData.unitId);
                    if (selectedUnit?.tenant) {
                      return (
                        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs">
                          <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-yellow-800">Unit has active tenant: {selectedUnit.tenant.name}</p>
                            {selectedUnit.tenant.contractEnd && (
                              <p className="text-yellow-600">Ends {new Date(selectedUnit.tenant.contractEnd).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {dateError && <p className="text-xs text-red-600">{dateError}</p>}
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
                    type="number"
                    step="0.01"
                    value={formData.withholdingTax}
                    onChange={(e) => setFormData({ ...formData, withholdingTax: e.target.value })}
                  />
                </div>
              </div>

              {/* Name fields */}
              {formData.tenantType === "INDIVIDUAL" ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("name")} *</Label>
                    <Input className="h-9" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("nameTh")}</Label>
                    <Input className="h-9" value={formData.nameTh} onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })} />
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
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("companyNameTh")}</Label>
                    <Input className="h-9" value={formData.companyNameTh} onChange={(e) => setFormData({ ...formData, companyNameTh: e.target.value })} />
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

              {/* Contract Pricing */}
              <div className="border-t pt-2">
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("contractPricing")}</h4>
                <div className="grid grid-cols-5 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("baseRent")} *</Label>
                    <Input className="h-9" type="number" value={formData.baseRent} onChange={(e) => setFormData({ ...formData, baseRent: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("commonFee")}</Label>
                    <Input className="h-9" type="number" value={formData.commonFee} onChange={(e) => setFormData({ ...formData, commonFee: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("deposit")}</Label>
                    <Input className="h-9" type="number" value={formData.deposit} onChange={(e) => setFormData({ ...formData, deposit: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("discountPercent")}</Label>
                    <Input className="h-9" type="number" step="0.01" value={formData.discountPercent} onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("discountAmount")}</Label>
                    <Input className="h-9" type="number" step="0.01" value={formData.discountAmount} onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Meters & Contract */}
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t("electricMeterNo")}</Label>
                  <Input className="h-9" value={formData.electricMeterNo} onChange={(e) => setFormData({ ...formData, electricMeterNo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("waterMeterNo")}</Label>
                  <Input className="h-9" value={formData.waterMeterNo} onChange={(e) => setFormData({ ...formData, waterMeterNo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("contractStart")}</Label>
                  <Input className="h-9" type="date" value={formData.contractStart} onChange={(e) => setFormData({ ...formData, contractStart: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("contractEnd")}</Label>
                  <Input className="h-9" type="date" value={formData.contractEnd} onChange={(e) => setFormData({ ...formData, contractEnd: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setIsDialogOpen(false); setDateError(null); }} disabled={saving}>
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
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("phone")}>
                  {t("phone")} <SortIcon column="phone" />
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
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
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
                    <TableCell>{tenant.phone || "-"}</TableCell>
                    <TableCell>
                      {tenant.contractEnd ? new Date(tenant.contractEnd).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)} title={t("editTenant")}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {getDisplayStatus(tenant) === "ACTIVE" && (
                          <Button variant="ghost" size="icon" onClick={() => openEndContractDialog(tenant)} title={t("endContract")}>
                            <UserX className="h-4 w-4 text-orange-500" />
                          </Button>
                        )}
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
            <DialogTitle>{t("deleteTenant")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {tenantToDelete?.name} - {tenantToDelete?.unit.unitNumber}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* End Contract Confirmation Dialog */}
      <Dialog open={endContractDialogOpen} onOpenChange={setEndContractDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("endContract")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("confirmEndContract")}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEndContractDialogOpen(false)} disabled={deleting}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleEndContract}
              disabled={deleting}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("endContract")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
