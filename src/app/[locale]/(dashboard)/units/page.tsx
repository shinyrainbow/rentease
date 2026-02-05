"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
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
import { Plus, Edit, Trash2, Search, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";

interface Project {
  id: string;
  name: string;
  nameTh: string | null;
}

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  size: number | null;
  type: string;
  status: string;
  project: { name: string; nameTh: string | null };
  tenant: { name: string; nameTh: string | null } | null;
}

export default function UnitsPage() {
  const t = useTranslations("units");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();

  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("unitNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [formData, setFormData] = useState({
    projectId: "",
    unitNumber: "",
    floor: 1,
    size: "",
    type: "WAREHOUSE",
  });

  const fetchData = async () => {
    try {
      const [unitsRes, projectsRes] = await Promise.all([
        fetch(`/api/units${selectedProject ? `?projectId=${selectedProject}` : ""}`),
        fetch("/api/projects"),
      ]);
      const [unitsData, projectsData] = await Promise.all([unitsRes.json(), projectsRes.json()]);
      setUnits(Array.isArray(unitsData) ? unitsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingUnit ? `/api/units/${editingUnit.id}` : "/api/units";
      const method = editingUnit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          floor: parseInt(formData.floor.toString()),
          size: formData.size ? parseFloat(formData.size) : null,
        }),
      });

      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: editingUnit
            ? `${formData.unitNumber} ${tCommon("updated")}`
            : `${formData.unitNumber} ${tCommon("created")}`,
        });
        setIsDialogOpen(false);
        setEditingUnit(null);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to save unit",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving unit:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({
      projectId: "",
      unitNumber: unit.unitNumber,
      floor: unit.floor,
      size: unit.size?.toString() || "",
      type: unit.type,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (unit: Unit) => {
    setUnitToDelete(unit);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!unitToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/units/${unitToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: `${unitToDelete.unitNumber} ${tCommon("deleted")}`,
        });
        setDeleteDialogOpen(false);
        setUnitToDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to delete unit",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting unit:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      projectId: "",
      unitNumber: "",
      floor: 1,
      size: "",
      type: "WAREHOUSE",
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "VACANT": return "bg-green-100 text-green-800";
      case "OCCUPIED": return "bg-blue-100 text-blue-800";
      case "RESERVED": return "bg-yellow-100 text-yellow-800";
      case "MAINTENANCE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter units by search query
  const filteredUnits = units.filter((unit) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        unit.unitNumber.toLowerCase().includes(query) ||
        (unit.tenant?.name && unit.tenant.name.toLowerCase().includes(query))
      );
    }
    return true;
  });

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

  const sortedUnits = [...filteredUnits].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    switch (sortColumn) {
      case "unitNumber":
        return direction * a.unitNumber.localeCompare(b.unitNumber);
      case "project":
        return direction * a.project.name.localeCompare(b.project.name);
      case "type":
        return direction * a.type.localeCompare(b.type);
      case "floor":
        return direction * (a.floor - b.floor);
      case "size":
        return direction * ((a.size || 0) - (b.size || 0));
      case "status":
        return direction * a.status.localeCompare(b.status);
      case "tenant":
        return direction * (a.tenant?.name || "").localeCompare(b.tenant?.name || "");
      default:
        return 0;
    }
  });

  if (loading) {
    return <PageSkeleton columns={6} rows={6} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingUnit(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addUnit")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingUnit ? t("editUnit") : t("addUnit")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingUnit && (
                  <div className="space-y-2">
                    <Label>{t("project")}</Label>
                    <Select
                      value={formData.projectId || undefined}
                      onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {(locale === "th" ? project.nameTh : null) || project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("unitNumber")}</Label>
                    <Input
                      value={formData.unitNumber}
                      onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                      required
                    />
                  </div>
                  {/* <div className="space-y-2">
                    <Label>{t("floor")}</Label>
                    <Input
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                    />
                  </div> */}
                  <div className="space-y-2">
                    <Label>{t("size")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAREHOUSE">{t("types.WAREHOUSE")}</SelectItem>
                      <SelectItem value="SHOP">{t("types.SHOP")}</SelectItem>
                      <SelectItem value="OFFICE">{t("types.OFFICE")}</SelectItem>
                      <SelectItem value="STORAGE">{t("types.STORAGE")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
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
            placeholder={t("searchPlaceholder") || "Search unit number, tenant..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedProject || "__all__"} onValueChange={(v) => setSelectedProject(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allProjects") || "All Projects"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allProjects") || "All Projects"}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {(locale === "th" ? project.nameTh : null) || project.name}
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
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("project")}>
                  {t("project")} <SortIcon column="project" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unitNumber")}>
                  {t("unitNumber")} <SortIcon column="unitNumber" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("tenant")}>
                  {t("currentTenant")} <SortIcon column="tenant" />
                </TableHead>
                {/* <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("floor")}>
                  {t("floor")} <SortIcon column="floor" />
                </TableHead> */}
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("size")}>
                  {t("size")} <SortIcon column="size" />
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("status")}>
                  {t("status")} <SortIcon column="status" />
                </TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUnits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sortedUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>{(locale === "th" ? unit.project.nameTh : null) || unit.project.name}</TableCell>
                    <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                    <TableCell>{(locale === "th" ? unit.tenant?.nameTh : null) || unit.tenant?.name || "-"}</TableCell>
                    {/* <TableCell>{unit.floor}</TableCell> */}
                    <TableCell>{unit.size ? `${unit.size} sq.m.` : "-"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(unit.status)}>
                        {t(`statuses.${unit.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(unit)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(unit)}>
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
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {unitToDelete?.unitNumber} - {(locale === "th" ? unitToDelete?.project.nameTh : null) || unitToDelete?.project.name}
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
    </div>
  );
}
