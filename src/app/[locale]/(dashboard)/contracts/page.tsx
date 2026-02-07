"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
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
import { Plus, Edit, Trash2, Search, Loader2, Eye, FileSignature, Copy, Send, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  nameTh: string | null;
}

interface Tenant {
  id: string;
  name: string;
  nameTh: string | null;
  email: string | null;
  phone: string | null;
  baseRent: number;
  commonFee: number | null;
  deposit: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  unit: {
    id: string;
    unitNumber: string;
    project: { id: string; name: string };
  };
}

interface Contract {
  id: string;
  contractNo: string;
  status: "DRAFT" | "PENDING_TENANT" | "SIGNED" | "CANCELLED";
  baseRent: number;
  commonFee: number | null;
  deposit: number | null;
  contractStart: string;
  contractEnd: string;
  signingToken: string;
  landlordSignedAt: string | null;
  tenantSignedAt: string | null;
  createdAt: string;
  project: { id: string; name: string; nameTh: string | null };
  unit: { id: string; unitNumber: string };
  tenant: { id: string; name: string; nameTh: string | null; email: string | null; phone: string | null };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_TENANT: "bg-yellow-100 text-yellow-800",
  SIGNED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function ContractsPage() {
  const t = useTranslations("contracts");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const fetchData = async () => {
    try {
      const searchParams = new URLSearchParams();
      if (projectFilter) searchParams.set("projectId", projectFilter);
      if (statusFilter) searchParams.set("status", statusFilter);

      const [contractsRes, projectsRes, tenantsRes] = await Promise.all([
        fetch(`/api/contracts?${searchParams.toString()}`),
        fetch("/api/projects"),
        fetch("/api/tenants?status=ACTIVE"),
      ]);

      const [contractsData, projectsData, tenantsData] = await Promise.all([
        contractsRes.json(),
        projectsRes.json(),
        tenantsRes.json(),
      ]);

      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTenants(Array.isArray(tenantsData) ? tenantsData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectFilter, statusFilter]);

  const filteredContracts = contracts.filter((contract) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        contract.contractNo.toLowerCase().includes(query) ||
        contract.tenant.name.toLowerCase().includes(query) ||
        (contract.tenant.nameTh && contract.tenant.nameTh.toLowerCase().includes(query)) ||
        contract.unit.unitNumber.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleCreateContract = async () => {
    if (!selectedTenantId) {
      toast({
        title: tCommon("error"),
        description: t("selectTenant"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });

      if (!res.ok) throw new Error("Failed to create contract");

      const newContract = await res.json();
      toast({
        title: t("contractCreated"),
        description: `${newContract.contractNo} ${tCommon("created")}`,
      });

      setIsDialogOpen(false);
      setSelectedTenantId("");
      router.push(`/${locale}/contracts/${newContract.id}`);
    } catch (error) {
      toast({
        title: tCommon("error"),
        description: "Failed to create contract",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!contractToDelete) return;

    try {
      const res = await fetch(`/api/contracts/${contractToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete contract");

      toast({
        title: t("contractDeleted"),
        description: `${contractToDelete.contractNo} ${tCommon("deleted")}`,
      });

      setContracts(contracts.filter((c) => c.id !== contractToDelete.id));
      setDeleteDialogOpen(false);
      setContractToDelete(null);
    } catch (error) {
      toast({
        title: tCommon("error"),
        description: "Failed to delete contract",
        variant: "destructive",
      });
    }
  };

  const copySigningLink = (contract: Contract) => {
    const link = `${window.location.origin}/sign/${contract.signingToken}`;
    navigator.clipboard.writeText(link);
    toast({
      title: t("linkCopied"),
      description: link,
    });
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("createContract")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createContract")}</DialogTitle>
              <DialogDescription>
                {t("selectTenantPlaceholder")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>{t("selectTenant")}</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("selectTenantPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      {t("noTenantsAvailable")}
                    </SelectItem>
                  ) : (
                    tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} - {tenant.unit.unitNumber} ({tenant.unit.project.name})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleCreateContract} disabled={saving || !selectedTenantId}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tCommon("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t("allProjects")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("allProjects")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={tCommon("all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{tCommon("all")}</SelectItem>
                <SelectItem value="DRAFT">{t("statuses.DRAFT")}</SelectItem>
                <SelectItem value="PENDING_TENANT">{t("statuses.PENDING_TENANT")}</SelectItem>
                <SelectItem value="SIGNED">{t("statuses.SIGNED")}</SelectItem>
                <SelectItem value="CANCELLED">{t("statuses.CANCELLED")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("contractNo")}</TableHead>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{t("unit")}</TableHead>
                <TableHead>{t("tenant")}</TableHead>
                <TableHead>{t("contractPeriod")}</TableHead>
                <TableHead>{t("baseRent")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead className="text-right">{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.contractNo}</TableCell>
                    <TableCell>{contract.project.name}</TableCell>
                    <TableCell>{contract.unit.unitNumber}</TableCell>
                    <TableCell>{contract.tenant.name}</TableCell>
                    <TableCell>
                      {formatDate(contract.contractStart)} - {formatDate(contract.contractEnd)}
                    </TableCell>
                    <TableCell>{formatCurrency(contract.baseRent)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[contract.status]}>
                        {t(`statuses.${contract.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/${locale}/contracts/${contract.id}`)}
                          title={t("viewContract")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {contract.status === "PENDING_TENANT" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySigningLink(contract)}
                            title={t("copySigningLink")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {contract.status !== "SIGNED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setContractToDelete(contract);
                              setDeleteDialogOpen(true);
                            }}
                            title={t("deleteContract")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteContract")}</DialogTitle>
            <DialogDescription>{t("confirmDelete")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteContract}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
