"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Building2 } from "lucide-react";

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  positionX: number | null;
  positionY: number | null;
  width: number | null;
  height: number | null;
}

interface Project {
  id: string;
  name: string;
  nameTh: string | null;
  type: string;
  address: string | null;
  billingDay: number;
  electricityRate: number;
  waterRate: number;
  _count: {
    units: number;
  };
  units?: Unit[];
}

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 120;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Mini floor plan component for thumbnails
function FloorPlanThumbnail({ units }: { units: Unit[] }) {
  const scale = Math.min(THUMBNAIL_WIDTH / CANVAS_WIDTH, THUMBNAIL_HEIGHT / CANVAS_HEIGHT);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "VACANT": return "#22c55e";
      case "OCCUPIED": return "#3b82f6";
      case "RESERVED": return "#eab308";
      case "MAINTENANCE": return "#ef4444";
      default: return "#6b7280";
    }
  };

  if (units.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-100 rounded text-xs text-muted-foreground"
        style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
      >
        No units
      </div>
    );
  }

  return (
    <div
      className="relative bg-slate-100 rounded overflow-hidden"
      style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
    >
      {units.map((unit, index) => {
        const x = unit.positionX ?? (index % 5) * 120 + 20;
        const y = unit.positionY ?? Math.floor(index / 5) * 100 + 20;
        const width = unit.width ?? 100;
        const height = unit.height ?? 80;

        return (
          <div
            key={unit.id}
            className="absolute rounded"
            style={{
              left: x * scale,
              top: y * scale,
              width: width * scale,
              height: height * scale,
              backgroundColor: getStatusColor(unit.status),
              border: '1px solid rgba(0,0,0,0.2)',
            }}
          />
        );
      })}
    </div>
  );
}

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tUnits = useTranslations("units");
  const tCommon = useTranslations("common");
  const params = useParams();
  const locale = params.locale as string;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    nameTh: "",
    type: "WAREHOUSE",
    address: "",
    billingDay: 1,
    electricityRate: 7,
    waterRate: 18,
  });

  const fetchProjects = async () => {
    try {
      // Fetch projects with units for thumbnails
      const res = await fetch("/api/projects");
      const projectsData = await res.json();

      // Fetch units for each project to show thumbnails
      const projectsWithUnits = await Promise.all(
        projectsData.map(async (project: Project) => {
          try {
            const unitsRes = await fetch(`/api/units?projectId=${project.id}`);
            const units = await unitsRes.json();
            return { ...project, units };
          } catch {
            return { ...project, units: [] };
          }
        })
      );

      setProjects(projectsWithUnits);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        resetForm();
        fetchProjects();
      }
    } catch (error) {
      console.error("Error saving project:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      nameTh: "",
      type: "WAREHOUSE",
      address: "",
      billingDay: 1,
      electricityRate: 7,
      waterRate: 18,
    });
  };

  const getTypeLabel = (type: string) => {
    return t(`types.${type}`);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "WAREHOUSE":
        return "bg-blue-100 text-blue-800";
      case "SHOP":
        return "bg-green-100 text-green-800";
      case "OFFICE":
        return "bg-purple-100 text-purple-800";
      case "MIXED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addProject")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("addProject")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{tCommon("noData")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/${locale}/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {locale === "th" && project.nameTh ? project.nameTh : project.name}
                      </CardTitle>
                      <Badge className={`mt-1 ${getTypeBadgeColor(project.type)}`}>
                        {getTypeLabel(project.type)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Floor Plan Thumbnail */}
                  <FloorPlanThumbnail units={project.units || []} />

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-blue-500"></div>
                      <span>{tUnits("statuses.OCCUPIED")}: {(project.units || []).filter(u => u.status === "OCCUPIED").length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-green-500"></div>
                      <span>{tUnits("statuses.VACANT")}: {(project.units || []).filter(u => u.status === "VACANT").length}</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {project.address && <p>{project.address}</p>}
                    <p>Units: {project._count.units} | {t("billingDay")}: {project.billingDay}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
