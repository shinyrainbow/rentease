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
import { Plus, Edit } from "lucide-react";
import { PageSkeleton } from "@/components/ui/table-skeleton";

interface Unit {
  id: string;
  unitNumber: string;
  project: { name: string };
  tenant: { name: string } | null;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  project: { name: string };
  unit: { unitNumber: string };
}

export default function MaintenancePage() {
  const t = useTranslations("maintenance");
  const tCommon = useTranslations("common");

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [formData, setFormData] = useState({
    unitId: "",
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    status: "PENDING",
    resolution: "",
  });

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const [requestsRes, unitsRes] = await Promise.all([
        fetch(`/api/maintenance?${params.toString()}`),
        fetch("/api/units"),
      ]);
      const [requestsData, unitsData] = await Promise.all([requestsRes.json(), unitsRes.json()]);
      setRequests(requestsData);
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
      const url = editingRequest ? `/api/maintenance/${editingRequest.id}` : "/api/maintenance";
      const method = editingRequest ? "PUT" : "POST";

      // When editing, don't send unitId
      const payload = editingRequest
        ? {
            title: formData.title,
            description: formData.description || null,
            category: formData.category,
            priority: formData.priority,
            status: formData.status,
            resolution: formData.resolution || null,
          }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setEditingRequest(null);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Error saving request:", error);
    }
  };

  const handleEdit = (request: MaintenanceRequest) => {
    setEditingRequest(request);
    setFormData({
      unitId: "",
      title: request.title,
      description: request.description || "",
      category: request.category,
      priority: request.priority,
      status: request.status,
      resolution: "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      unitId: "",
      title: "",
      description: "",
      category: "GENERAL",
      priority: "MEDIUM",
      status: "PENDING",
      resolution: "",
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "CANCELLED": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "LOW": return "bg-gray-100 text-gray-800";
      case "MEDIUM": return "bg-blue-100 text-blue-800";
      case "HIGH": return "bg-orange-100 text-orange-800";
      case "URGENT": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <PageSkeleton columns={7} rows={5} />;
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
              <SelectItem value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</SelectItem>
              <SelectItem value="COMPLETED">{t("statuses.COMPLETED")}</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingRequest(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addRequest")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRequest ? t("updateStatus") : t("addRequest")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingRequest && (
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
                            {unit.project.name} - {unit.unitNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t("requestTitle")}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("category")}</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ELECTRICAL">{t("categories.ELECTRICAL")}</SelectItem>
                        <SelectItem value="PLUMBING">{t("categories.PLUMBING")}</SelectItem>
                        <SelectItem value="STRUCTURAL">{t("categories.STRUCTURAL")}</SelectItem>
                        <SelectItem value="HVAC">{t("categories.HVAC")}</SelectItem>
                        <SelectItem value="GENERAL">{t("categories.GENERAL")}</SelectItem>
                        <SelectItem value="OTHER">{t("categories.OTHER")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("priority")}</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">{t("priorities.LOW")}</SelectItem>
                        <SelectItem value="MEDIUM">{t("priorities.MEDIUM")}</SelectItem>
                        <SelectItem value="HIGH">{t("priorities.HIGH")}</SelectItem>
                        <SelectItem value="URGENT">{t("priorities.URGENT")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingRequest && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("status")}</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">{t("statuses.PENDING")}</SelectItem>
                          <SelectItem value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</SelectItem>
                          <SelectItem value="COMPLETED">{t("statuses.COMPLETED")}</SelectItem>
                          <SelectItem value="CANCELLED">{t("statuses.CANCELLED")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("resolution")}</Label>
                      <Input
                        value={formData.resolution}
                        onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                      />
                    </div>
                  </>
                )}

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
                <TableHead>{t("requestTitle")}</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.title}</TableCell>
                    <TableCell>{request.project.name}</TableCell>
                    <TableCell>{request.unit.unitNumber}</TableCell>
                    <TableCell>{t(`categories.${request.category}`)}</TableCell>
                    <TableCell>
                      <Badge className={getPriorityBadgeColor(request.priority)}>
                        {t(`priorities.${request.priority}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(request.status)}>
                        {t(`statuses.${request.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(request)}>
                        <Edit className="h-4 w-4" />
                      </Button>
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
