"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move,
  Grid,
  Settings,
  Map,
  Trash2,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  nameTh: string | null;
  type: string;
  address: string | null;
  billingDay: number;
  electricityRate: number;
  waterRate: number;
  taxId: string | null;
  companyName: string | null;
  companyNameTh: string | null;
  companyAddress: string | null;
}

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  positionX: number | null;
  positionY: number | null;
  width: number | null;
  height: number | null;
  tenant: { name: string } | null;
}

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 80;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export default function ProjectDetailPage() {
  const t = useTranslations("projects");
  const tFloorPlans = useTranslations("floorPlans");
  const tUnits = useTranslations("units");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const projectId = params.id as string;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  // Project form data
  const [formData, setFormData] = useState({
    name: "",
    nameTh: "",
    type: "WAREHOUSE",
    address: "",
    billingDay: 1,
    electricityRate: 7,
    waterRate: 18,
    taxId: "",
    companyName: "",
    companyNameTh: "",
    companyAddress: "",
  });

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Selected unit for editing
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [projectRes, unitsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/units?projectId=${projectId}`),
      ]);

      if (!projectRes.ok) {
        router.push(`/${locale}/projects`);
        return;
      }

      const projectData = await projectRes.json();
      const unitsData = await unitsRes.json();

      setProject(projectData);
      setFormData({
        name: projectData.name,
        nameTh: projectData.nameTh || "",
        type: projectData.type,
        address: projectData.address || "",
        billingDay: projectData.billingDay,
        electricityRate: projectData.electricityRate,
        waterRate: projectData.waterRate,
        taxId: projectData.taxId || "",
        companyName: projectData.companyName || "",
        companyNameTh: projectData.companyNameTh || "",
        companyAddress: projectData.companyAddress || "",
      });

      // Initialize positions for units without positions
      const unitsWithPositions = unitsData.map((unit: Unit, index: number) => ({
        ...unit,
        positionX: unit.positionX ?? (index % 5) * 120 + 20,
        positionY: unit.positionY ?? Math.floor(index / 5) * 100 + 20,
        width: unit.width ?? DEFAULT_WIDTH,
        height: unit.height ?? DEFAULT_HEIGHT,
      }));
      setUnits(unitsWithPositions);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId, locale, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveProject = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updatedProject = await res.json();
        setProject(updatedProject);
      }
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm("Are you sure you want to delete this project? All units and data will be lost.")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/${locale}/projects`);
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, unitId: string) => {
    if (!editMode) return;
    e.preventDefault();

    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setDragging(unitId);
    setDragOffset({
      x: x - (unit.positionX || 0),
      y: y - (unit.positionY || 0),
    });
    setSelectedUnit(unitId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (dragging) {
      setUnits(prev => prev.map(unit => {
        if (unit.id === dragging) {
          const newX = Math.max(0, Math.min(x - dragOffset.x, CANVAS_WIDTH - (unit.width || DEFAULT_WIDTH)));
          const newY = Math.max(0, Math.min(y - dragOffset.y, CANVAS_HEIGHT - (unit.height || DEFAULT_HEIGHT)));
          const snapX = showGrid ? Math.round(newX / 10) * 10 : newX;
          const snapY = showGrid ? Math.round(newY / 10) * 10 : newY;
          return { ...unit, positionX: snapX, positionY: snapY };
        }
        return unit;
      }));
    }

    if (resizing) {
      const deltaX = x - resizeStart.x;
      const deltaY = y - resizeStart.y;

      setUnits(prev => prev.map(u => {
        if (u.id === resizing) {
          const newWidth = Math.max(60, resizeStart.w + deltaX);
          const newHeight = Math.max(40, resizeStart.h + deltaY);
          return { ...u, width: newWidth, height: newHeight };
        }
        return u;
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  const handleResizeStart = (e: React.MouseEvent, unitId: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();

    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setResizing(unitId);
    setResizeStart({
      x,
      y,
      w: unit.width || DEFAULT_WIDTH,
      h: unit.height || DEFAULT_HEIGHT,
    });
    setSelectedUnit(unitId);
  };

  const savePositions = async () => {
    setSaving(true);
    try {
      await Promise.all(
        units.map(unit =>
          fetch(`/api/units/${unit.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              positionX: unit.positionX,
              positionY: unit.positionY,
              width: unit.width,
              height: unit.height,
            }),
          })
        )
      );
    } catch (error) {
      console.error("Error saving positions:", error);
    } finally {
      setSaving(false);
    }
  };

  const resetPositions = () => {
    setUnits(prev => prev.map((unit, index) => ({
      ...unit,
      positionX: (index % 5) * 120 + 20,
      positionY: Math.floor(index / 5) * 100 + 20,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    })));
  };

  const updateUnitSize = (unitId: string, width: number, height: number) => {
    setUnits(prev => prev.map(unit => {
      if (unit.id === unitId) {
        return { ...unit, width, height };
      }
      return unit;
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VACANT": return "bg-green-500 border-green-600";
      case "OCCUPIED": return "bg-blue-500 border-blue-600";
      case "RESERVED": return "bg-yellow-500 border-yellow-600";
      case "MAINTENANCE": return "bg-red-500 border-red-600";
      default: return "bg-gray-500 border-gray-600";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  if (!project) {
    return <div className="flex items-center justify-center h-64">Project not found</div>;
  }

  const selectedUnitData = selectedUnit ? units.find(u => u.id === selectedUnit) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/projects`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {locale === "th" && project.nameTh ? project.nameTh : project.name}
            </h2>
            <p className="text-muted-foreground">{t(`types.${project.type}`)}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDeleteProject}>
          <Trash2 className="h-4 w-4 mr-2" />
          {t("deleteProject")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="floorplan" className="space-y-6">
        <TabsList>
          <TabsTrigger value="floorplan" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            {tFloorPlans("title")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("editProject")}
          </TabsTrigger>
        </TabsList>

        {/* Floor Plan Tab */}
        <TabsContent value="floorplan">
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Floor Plan Canvas */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {tFloorPlans("title")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showGrid ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowGrid(!showGrid)}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <div className="h-6 w-px bg-border mx-2" />
                  <Button
                    variant={editMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                  >
                    <Move className="h-4 w-4 mr-2" />
                    {editMode ? "Editing" : "Edit"}
                  </Button>
                  {editMode && (
                    <>
                      <Button variant="outline" size="sm" onClick={resetPositions}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button size="sm" onClick={savePositions} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto border rounded-lg bg-slate-50">
                  <div
                    ref={canvasRef}
                    className="relative"
                    style={{
                      width: CANVAS_WIDTH * zoom,
                      height: CANVAS_HEIGHT * zoom,
                      backgroundImage: showGrid
                        ? `linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                           linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)`
                        : 'none',
                      backgroundSize: `${10 * zoom}px ${10 * zoom}px`,
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className={`absolute rounded-lg border-2 shadow-md transition-shadow ${getStatusColor(unit.status)} ${
                          editMode ? "cursor-move" : "cursor-pointer"
                        } ${selectedUnit === unit.id ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                        style={{
                          left: (unit.positionX || 0) * zoom,
                          top: (unit.positionY || 0) * zoom,
                          width: (unit.width || DEFAULT_WIDTH) * zoom,
                          height: (unit.height || DEFAULT_HEIGHT) * zoom,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, unit.id)}
                        onClick={() => !editMode && setSelectedUnit(unit.id)}
                      >
                        <div className="p-2 text-white h-full flex flex-col justify-center items-center text-center">
                          <div className="font-bold" style={{ fontSize: 14 * zoom }}>
                            {unit.unitNumber}
                          </div>
                          <div className="text-xs opacity-90 truncate w-full" style={{ fontSize: 10 * zoom }}>
                            {unit.tenant?.name || tUnits(`statuses.${unit.status}`)}
                          </div>
                        </div>
                        {editMode && (
                          <div
                            className="absolute bottom-0 right-0 w-4 h-4 bg-white border border-gray-400 cursor-se-resize rounded-tl"
                            style={{ transform: `scale(${zoom})`, transformOrigin: 'bottom right' }}
                            onMouseDown={(e) => handleResizeStart(e, unit.id)}
                          />
                        )}
                      </div>
                    ))}
                    {units.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        No units in this project
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Legend */}
              <Card>
                <CardHeader>
                  <CardTitle>Legend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
                    <span className="text-sm">{tUnits("statuses.VACANT")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-blue-500 border border-blue-600"></div>
                    <span className="text-sm">{tUnits("statuses.OCCUPIED")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-yellow-500 border border-yellow-600"></div>
                    <span className="text-sm">{tUnits("statuses.RESERVED")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-red-500 border border-red-600"></div>
                    <span className="text-sm">{tUnits("statuses.MAINTENANCE")}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Units:</span>
                    <Badge variant="secondary">{units.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{tUnits("statuses.OCCUPIED")}:</span>
                    <Badge className="bg-blue-500">{units.filter(u => u.status === "OCCUPIED").length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{tUnits("statuses.VACANT")}:</span>
                    <Badge className="bg-green-500">{units.filter(u => u.status === "VACANT").length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>{tUnits("statuses.RESERVED")}:</span>
                    <Badge className="bg-yellow-500">{units.filter(u => u.status === "RESERVED").length}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Unit Details */}
              {selectedUnitData && (
                <Card>
                  <CardHeader>
                    <CardTitle>Unit: {selectedUnitData.unitNumber}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge className={`ml-2 ${getStatusColor(selectedUnitData.status).split(' ')[0]}`}>
                        {tUnits(`statuses.${selectedUnitData.status}`)}
                      </Badge>
                    </div>
                    {selectedUnitData.tenant && (
                      <div>
                        <span className="text-sm text-muted-foreground">Tenant:</span>
                        <p className="font-medium">{selectedUnitData.tenant.name}</p>
                      </div>
                    )}
                    {editMode && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Width</Label>
                            <Input
                              type="number"
                              value={selectedUnitData.width || DEFAULT_WIDTH}
                              onChange={(e) => updateUnitSize(
                                selectedUnitData.id,
                                parseInt(e.target.value) || DEFAULT_WIDTH,
                                selectedUnitData.height || DEFAULT_HEIGHT
                              )}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Height</Label>
                            <Input
                              type="number"
                              value={selectedUnitData.height || DEFAULT_HEIGHT}
                              onChange={(e) => updateUnitSize(
                                selectedUnitData.id,
                                selectedUnitData.width || DEFAULT_WIDTH,
                                parseInt(e.target.value) || DEFAULT_HEIGHT
                              )}
                              className="h-8"
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Position: ({Math.round(selectedUnitData.positionX || 0)}, {Math.round(selectedUnitData.positionY || 0)})
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {editMode && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <p>• Drag units to move them</p>
                    <p>• Drag corner to resize</p>
                    <p>• Click unit to select & edit size</p>
                    <p>• Grid snaps to 10px increments</p>
                    <p>• Click Save to store positions</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{t("editProject")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveProject(); }}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("projectName")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nameTh">{t("projectNameTh")}</Label>
                    <Input
                      id="nameTh"
                      value={formData.nameTh}
                      onChange={(e) => setFormData({ ...formData, nameTh: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">{t("projectType")}</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WAREHOUSE">{t("types.WAREHOUSE")}</SelectItem>
                      <SelectItem value="SHOP">{t("types.SHOP")}</SelectItem>
                      <SelectItem value="OFFICE">{t("types.OFFICE")}</SelectItem>
                      <SelectItem value="MIXED">{t("types.MIXED")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("address")}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="billingDay">{t("billingDay")}</Label>
                    <Input
                      id="billingDay"
                      type="number"
                      min="1"
                      max="28"
                      value={formData.billingDay}
                      onChange={(e) => setFormData({ ...formData, billingDay: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="electricityRate">{t("electricityRate")}</Label>
                    <Input
                      id="electricityRate"
                      type="number"
                      step="0.01"
                      value={formData.electricityRate}
                      onChange={(e) => setFormData({ ...formData, electricityRate: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waterRate">{t("waterRate")}</Label>
                    <Input
                      id="waterRate"
                      type="number"
                      step="0.01"
                      value={formData.waterRate}
                      onChange={(e) => setFormData({ ...formData, waterRate: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">{t("companyName")}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">{t("companyName")}</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyNameTh">{t("companyNameTh")}</Label>
                      <Input
                        id="companyNameTh"
                        value={formData.companyNameTh}
                        onChange={(e) => setFormData({ ...formData, companyNameTh: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="taxId">{t("taxId")}</Label>
                    <Input
                      id="taxId"
                      value={formData.taxId}
                      onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? tCommon("loading") : tCommon("save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
