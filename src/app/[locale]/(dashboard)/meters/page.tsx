"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Zap, Droplets, ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface MeterReading {
  id: string;
  type: string;
  previousReading: number;
  currentReading: number;
  usage: number;
  rate: number;
  amount: number;
  readingDate: string;
  billingMonth: string;
  unit: {
    unitNumber: string;
    tenant: { name: string; nameTh: string | null } | null;
  };
  project: { name: string };
}

export default function MetersPage() {
  const t = useTranslations("meters");
  const tCommon = useTranslations("common");

  const { toast } = useToast();
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [readingToDelete, setReadingToDelete] = useState<MeterReading | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [sortColumn, setSortColumn] = useState<string>("unit");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [formData, setFormData] = useState({
    unitId: "",
    type: "ELECTRICITY",
    currentReading: "",
    previousReading: "",
    readingDate: new Date().toISOString().split("T")[0],
    billingMonth: new Date().toISOString().slice(0, 7),
  });
  const [previousInfo, setPreviousInfo] = useState<{
    hasPrevious: boolean;
    previousReading: number | null;
    previousMonth: string | null;
  } | null>(null);
  const [checkingPrevious, setCheckingPrevious] = useState(false);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProject) params.append("projectId", selectedProject);
      if (selectedMonth) params.append("billingMonth", selectedMonth);

      const [readingsRes, projectsRes, unitsRes] = await Promise.all([
        fetch(`/api/meters?${params.toString()}`),
        fetch("/api/projects"),
        fetch("/api/units"),
      ]);
      const [readingsData, projectsData, unitsData] = await Promise.all([
        readingsRes.json(),
        projectsRes.json(),
        unitsRes.json(),
      ]);
      setReadings(readingsData);
      setProjects(projectsData);
      setUnits(unitsData.filter((u: Unit) => u.tenant !== null));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProject, selectedMonth]);

  // Check for previous reading when unit, type, or billing month changes
  const checkPreviousReading = async (unitId: string, type: string, billingMonth: string) => {
    if (!unitId || !type || !billingMonth) {
      setPreviousInfo(null);
      return;
    }
    setCheckingPrevious(true);
    try {
      const res = await fetch(
        `/api/meters/previous?unitId=${unitId}&type=${type}&billingMonth=${billingMonth}`
      );
      const data = await res.json();
      setPreviousInfo(data);
      if (data.hasPrevious) {
        setFormData((prev) => ({ ...prev, previousReading: "" }));
      }
    } catch (error) {
      console.error("Error checking previous reading:", error);
      setPreviousInfo(null);
    } finally {
      setCheckingPrevious(false);
    }
  };

  useEffect(() => {
    if (!editingReading && formData.unitId && formData.type && formData.billingMonth) {
      checkPreviousReading(formData.unitId, formData.type, formData.billingMonth);
    }
  }, [formData.unitId, formData.type, formData.billingMonth, editingReading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingReading ? `/api/meters/${editingReading.id}` : "/api/meters";
      const method = editingReading ? "PUT" : "POST";

      const payload: Record<string, unknown> = {
        ...formData,
        currentReading: parseFloat(formData.currentReading),
      };
      // Include previousReading only if manually entered (first-time entry)
      if (formData.previousReading && !previousInfo?.hasPrevious) {
        payload.previousReading = parseFloat(formData.previousReading);
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: editingReading ? tCommon("updated") : tCommon("created"),
        });
        setIsDialogOpen(false);
        setEditingReading(null);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast({
          title: tCommon("error"),
          description: data.error || "Failed to save",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving meter reading:", error);
      toast({
        title: tCommon("error"),
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reading: MeterReading) => {
    setEditingReading(reading);
    setFormData({
      unitId: "",
      type: reading.type,
      currentReading: reading.currentReading.toString(),
      previousReading: reading.previousReading.toString(),
      readingDate: reading.readingDate.split("T")[0],
      billingMonth: reading.billingMonth,
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (reading: MeterReading) => {
    setReadingToDelete(reading);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!readingToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/meters/${readingToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({
          title: tCommon("success"),
          description: tCommon("deleted"),
        });
        setDeleteDialogOpen(false);
        setReadingToDelete(null);
        fetchData();
      } else {
        toast({
          title: tCommon("error"),
          description: "Failed to delete",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting meter reading:", error);
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
      unitId: "",
      type: "ELECTRICITY",
      currentReading: "",
      previousReading: "",
      readingDate: new Date().toISOString().split("T")[0],
      billingMonth: new Date().toISOString().slice(0, 7),
    });
    setPreviousInfo(null);
  };

  const electricityReadings = readings.filter((r) => r.type === "ELECTRICITY");
  const waterReadings = readings.filter((r) => r.type === "WATER");

  const filteredUnits = selectedProject
    ? units.filter((u) => u.projectId === selectedProject)
    : units;

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

  const sortReadings = (readingsToSort: MeterReading[]) => {
    return [...readingsToSort].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "unit":
          return direction * a.unit.unitNumber.localeCompare(b.unit.unitNumber);
        case "project":
          return direction * a.project.name.localeCompare(b.project.name);
        case "previousReading":
          return direction * (a.previousReading - b.previousReading);
        case "currentReading":
          return direction * (a.currentReading - b.currentReading);
        case "usage":
          return direction * (a.usage - b.usage);
        case "rate":
          return direction * (a.rate - b.rate);
        case "amount":
          return direction * (a.amount - b.amount);
        default:
          return 0;
      }
    });
  };

  const sortedElectricityReadings = sortReadings(electricityReadings);
  const sortedWaterReadings = sortReadings(waterReadings);

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <div className="flex gap-4">
          <Select value={selectedProject || "__all__"} onValueChange={(v) => setSelectedProject(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={tCommon("all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tCommon("all")}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-[180px]"
          />
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingReading(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingReading(null); resetForm(); }}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addReading")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingReading ? t("editReading") : t("addReading")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingReading && (
                  <>
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
                          {filteredUnits.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.project.name} - {unit.unitNumber} ({unit.tenant?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ELECTRICITY">{t("electricity")}</SelectItem>
                          <SelectItem value="WATER">{t("water")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {editingReading && (
                  <div className="text-sm text-muted-foreground">
                    {editingReading.project.name} - {editingReading.unit.unitNumber} ({t(editingReading.type.toLowerCase())})
                  </div>
                )}

                {/* Previous reading info/input */}
                {!editingReading && formData.unitId && (
                  <div className="space-y-2">
                    <Label>{t("previousReading")}</Label>
                    {checkingPrevious ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tCommon("loading")}
                      </div>
                    ) : previousInfo?.hasPrevious ? (
                      <div className="text-sm p-2 bg-muted rounded-md">
                        <span className="font-medium">{previousInfo.previousReading}</span>
                        <span className="text-muted-foreground ml-2">
                          ({previousInfo.previousMonth})
                        </span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.previousReading}
                        onChange={(e) => setFormData({ ...formData, previousReading: e.target.value })}
                        placeholder={t("enterPreviousReading")}
                      />
                    )}
                    {!previousInfo?.hasPrevious && !checkingPrevious && formData.unitId && (
                      <p className="text-xs text-muted-foreground">{t("firstTimeReading")}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t("currentReading")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.currentReading}
                    onChange={(e) => setFormData({ ...formData, currentReading: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("readingDate")}</Label>
                    <Input
                      type="date"
                      value={formData.readingDate}
                      onChange={(e) => setFormData({ ...formData, readingDate: e.target.value })}
                    />
                  </div>
                  {!editingReading && (
                    <div className="space-y-2">
                      <Label>{t("billingMonth")}</Label>
                      <Input
                        type="month"
                        value={formData.billingMonth}
                        onChange={(e) => setFormData({ ...formData, billingMonth: e.target.value })}
                      />
                    </div>
                  )}
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
      </div>

      <Tabs defaultValue="electricity">
        <TabsList>
          <TabsTrigger value="electricity" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t("electricity")} ({electricityReadings.length})
          </TabsTrigger>
          <TabsTrigger value="water" className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            {t("water")} ({waterReadings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="electricity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                {t("electricity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                      Unit <SortIcon column="unit" />
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("previousReading")}>
                      {t("previousReading")} <SortIcon column="previousReading" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("currentReading")}>
                      {t("currentReading")} <SortIcon column="currentReading" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("usage")}>
                      {t("usage")} <SortIcon column="usage" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("rate")}>
                      {t("rate")} <SortIcon column="rate" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                      {t("amount")} <SortIcon column="amount" />
                    </TableHead>
                    <TableHead>{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedElectricityReadings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {tCommon("noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedElectricityReadings.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell className="font-medium">{reading.unit.unitNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{reading.unit.tenant?.name || "-"}</TableCell>
                        <TableCell>{reading.previousReading}</TableCell>
                        <TableCell>{reading.currentReading}</TableCell>
                        <TableCell>{reading.usage}</TableCell>
                        <TableCell>฿{reading.rate}</TableCell>
                        <TableCell className="font-medium">฿{reading.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(reading)} title={t("editReading")}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(reading)} title={tCommon("delete")}>
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
        </TabsContent>

        <TabsContent value="water">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                {t("water")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("unit")}>
                      Unit <SortIcon column="unit" />
                    </TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("previousReading")}>
                      {t("previousReading")} <SortIcon column="previousReading" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("currentReading")}>
                      {t("currentReading")} <SortIcon column="currentReading" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("usage")}>
                      {t("usage")} <SortIcon column="usage" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("rate")}>
                      {t("rate")} <SortIcon column="rate" />
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("amount")}>
                      {t("amount")} <SortIcon column="amount" />
                    </TableHead>
                    <TableHead>{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedWaterReadings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {tCommon("noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedWaterReadings.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell className="font-medium">{reading.unit.unitNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{reading.unit.tenant?.name || "-"}</TableCell>
                        <TableCell>{reading.previousReading}</TableCell>
                        <TableCell>{reading.currentReading}</TableCell>
                        <TableCell>{reading.usage}</TableCell>
                        <TableCell>฿{reading.rate}</TableCell>
                        <TableCell className="font-medium">฿{reading.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(reading)} title={t("editReading")}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(reading)} title={tCommon("delete")}>
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
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteReading")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {readingToDelete?.project.name} - {readingToDelete?.unit.unitNumber} ({readingToDelete?.billingMonth})
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
    </div>
  );
}
