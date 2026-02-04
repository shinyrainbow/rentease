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
import { Plus, Edit, Trash2, UserX, Search, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  status: "ACTIVE" | "EXPIRED" | "TERMINATED";
  withholdingTax: number;
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
  const [dateError, setDateError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    unitId: "",
    name: "",
    nameTh: "",
    email: "",
    phone: "",
    idCard: "",
    taxId: "",
    tenantType: "INDIVIDUAL",
    withholdingTax: "0",
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

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          withholdingTax: parseFloat(formData.withholdingTax),
          contractStart: formData.contractStart || null,
          contractEnd: formData.contractEnd || null,
        }),
      });

      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: editingTenant
            ? `${formData.name} ${tCommon("updated")}`
            : `${formData.name} ${tCommon("created")}`,
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
      name: tenant.name,
      nameTh: tenant.nameTh || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      idCard: "",
      taxId: "",
      tenantType: tenant.tenantType,
      withholdingTax: tenant.withholdingTax.toString(),
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800";
      case "EXPIRED": return "bg-gray-100 text-gray-800";
      case "TERMINATED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const resetForm = () => {
    setFormData({
      unitId: "",
      name: "",
      nameTh: "",
      email: "",
      phone: "",
      idCard: "",
      taxId: "",
      tenantType: "INDIVIDUAL",
      withholdingTax: "0",
      contractStart: "",
      contractEnd: "",
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTenant ? t("editTenant") : t("addTenant")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingTenant && (
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.unitId || undefined}
                    onValueChange={(value) => {
                      setFormData({ ...formData, unitId: value });
                      setDateError(null);
                    }}
                  >
                    <SelectTrigger>
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
                  {/* Show warning if selected unit has active tenant */}
                  {formData.unitId && (() => {
                    const selectedUnit = allUnits.find(u => u.id === formData.unitId);
                    if (selectedUnit?.tenant) {
                      return (
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-yellow-800">Unit has active tenant</p>
                            <p className="text-yellow-700">
                              Current tenant: {selectedUnit.tenant.name}
                              {selectedUnit.tenant.contractEnd && (
                                <> (ends {new Date(selectedUnit.tenant.contractEnd).toLocaleDateString()})</>
                              )}
                            </p>
                            <p className="text-yellow-600 mt-1">
                              New contract must start after current contract ends.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {dateError && (
                    <p className="text-sm text-red-600">{dateError}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("name")}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("nameTh")}</Label>
                  <Input
                    value={formData.nameTh}
                    onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("email")}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("phone")}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("tenantType")}</Label>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">{t("types.INDIVIDUAL")}</SelectItem>
                      <SelectItem value="COMPANY">{t("types.COMPANY")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("withholdingTax")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.withholdingTax}
                    onChange={(e) => setFormData({ ...formData, withholdingTax: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("contractStart")}</Label>
                  <Input
                    type="date"
                    value={formData.contractStart}
                    onChange={(e) => setFormData({ ...formData, contractStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("contractEnd")}</Label>
                  <Input
                    type="date"
                    value={formData.contractEnd}
                    onChange={(e) => setFormData({ ...formData, contractEnd: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setDateError(null); }} disabled={saving}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {tCommon("save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder") || "Search name, phone, unit..."}
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>{t("tenantType")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("contractEnd")}</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
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
                      <Badge className={getStatusBadgeColor(tenant.status)}>
                        {t(`statuses.${tenant.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.phone || "-"}</TableCell>
                    <TableCell>
                      {tenant.contractEnd ? new Date(tenant.contractEnd).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {tenant.status === "ACTIVE" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)} title={t("editTenant")}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEndContractDialog(tenant)} title={t("endContract")}>
                              <UserX className="h-4 w-4 text-orange-500" />
                            </Button>
                          </>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTenant")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToDelete?.name} - {tenantToDelete?.unit.unitNumber}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Contract Confirmation Dialog */}
      <AlertDialog open={endContractDialogOpen} onOpenChange={setEndContractDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("endContract")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmEndContract")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndContract}
              disabled={deleting}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("endContract")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
