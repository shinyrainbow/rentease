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
import { Plus, Edit, Trash2, UserX } from "lucide-react";

interface Unit {
  id: string;
  unitNumber: string;
  project: { name: string };
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

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [vacantUnits, setVacantUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

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

      const [tenantsRes, unitsRes] = await Promise.all([
        fetch(`/api/tenants?${params.toString()}`),
        fetch("/api/units"),
      ]);
      const [tenantsData, unitsData] = await Promise.all([tenantsRes.json(), unitsRes.json()]);
      setTenants(tenantsData);
      setVacantUnits(unitsData.filter((u: { status: string }) => u.status === "VACANT"));
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
        setIsDialogOpen(false);
        setEditingTenant(null);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Error saving tenant:", error);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tenant?")) return;

    try {
      const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
    }
  };

  const handleEndContract = async (id: string) => {
    if (!confirm(t("confirmEndContract"))) return;

    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_contract" }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error ending contract:", error);
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
        <div className="flex gap-4">
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
                    onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vacant unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {vacantUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.project.name} - {unit.unitNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit">{tCommon("save")}</Button>
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
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
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
                            <Button variant="ghost" size="icon" onClick={() => handleEndContract(tenant.id)} title={t("endContract")}>
                              <UserX className="h-4 w-4 text-orange-500" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tenant.id)} title={tCommon("delete")}>
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
    </div>
  );
}
