"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  FileSignature,
  Copy,
  Send,
  FileDown,
  Plus,
  Trash2,
  Check,
  Clock,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "@/lib/utils";
import { SignaturePad } from "@/components/contracts/signature-pad";

interface Clause {
  title: string;
  titleTh: string;
  content: string;
  contentTh: string;
}

interface Contract {
  id: string;
  contractNo: string;
  status: "DRAFT" | "PENDING_TENANT" | "SIGNED" | "CANCELLED";
  title: string | null;
  titleTh: string | null;
  baseRent: number;
  commonFee: number | null;
  deposit: number | null;
  contractStart: string;
  contractEnd: string;
  clauses: Clause[] | null;
  signingToken: string;
  landlordSignature: string | null;
  landlordSignedAt: string | null;
  tenantSignature: string | null;
  tenantSignedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    nameTh: string | null;
    companyName: string | null;
    companyNameTh: string | null;
    companyAddress: string | null;
    taxId: string | null;
    logoUrl: string | null;
  };
  unit: { id: string; unitNumber: string; floor: number; size: number | null; type: string };
  tenant: {
    id: string;
    name: string;
    nameTh: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    idCard: string | null;
    taxId: string | null;
    tenantType: string;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_TENANT: "bg-yellow-100 text-yellow-800",
  SIGNED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const defaultClauses: Clause[] = [
  {
    title: "Premises",
    titleTh: "ทรัพย์สินที่เช่า",
    content: "The Landlord agrees to rent to the Tenant the property described above for the specified rental period.",
    contentTh: "ผู้ให้เช่าตกลงให้เช่าทรัพย์สินตามที่ระบุข้างต้นแก่ผู้เช่าตามระยะเวลาที่กำหนด",
  },
  {
    title: "Rent Payment",
    titleTh: "การชำระค่าเช่า",
    content: "The Tenant agrees to pay the monthly rent by the due date specified in the invoice. Late payments may incur additional fees.",
    contentTh: "ผู้เช่าตกลงชำระค่าเช่ารายเดือนภายในวันครบกำหนดที่ระบุในใบแจ้งหนี้ การชำระล่าช้าอาจมีค่าปรับเพิ่มเติม",
  },
  {
    title: "Security Deposit",
    titleTh: "เงินประกัน",
    content: "The security deposit will be held for the duration of the tenancy and returned within 30 days after lease termination, less any deductions for damages or unpaid rent.",
    contentTh: "เงินประกันจะถูกเก็บรักษาตลอดระยะเวลาการเช่าและคืนภายใน 30 วันหลังสิ้นสุดสัญญา หักค่าเสียหายหรือค่าเช่าค้างชำระ (ถ้ามี)",
  },
  {
    title: "Maintenance",
    titleTh: "การบำรุงรักษา",
    content: "The Tenant agrees to maintain the premises in good condition and report any damages or necessary repairs to the Landlord promptly.",
    contentTh: "ผู้เช่าตกลงดูแลรักษาทรัพย์สินให้อยู่ในสภาพดีและแจ้งความเสียหายหรือการซ่อมแซมที่จำเป็นแก่ผู้ให้เช่าทันที",
  },
  {
    title: "Termination",
    titleTh: "การยกเลิกสัญญา",
    content: "Either party may terminate this agreement with 30 days written notice. Early termination by the Tenant may result in forfeiture of the security deposit.",
    contentTh: "ฝ่ายใดฝ่ายหนึ่งสามารถยกเลิกสัญญาได้โดยแจ้งล่วงหน้าเป็นลายลักษณ์อักษร 30 วัน การยกเลิกก่อนกำหนดโดยผู้เช่าอาจส่งผลให้เสียสิทธิ์ในเงินประกัน",
  },
];

export default function ContractDetailPage() {
  const t = useTranslations("contracts");
  const tCommon = useTranslations("common");
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [clauses, setClauses] = useState<Clause[]>([]);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      if (!res.ok) throw new Error("Failed to fetch contract");
      const data = await res.json();
      setContract(data);
      setClauses(data.clauses || defaultClauses);
    } catch (error) {
      console.error("Error fetching contract:", error);
      toast({
        title: tCommon("error"),
        description: "Failed to load contract",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClauses = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clauses }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: t("contractUpdated") });
      fetchContract();
    } catch (error) {
      toast({ title: tCommon("error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLandlordSign = async () => {
    if (!contract || !signatureData) {
      toast({
        title: tCommon("error"),
        description: t("signatureRequired"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureData }),
      });

      if (!res.ok) throw new Error("Failed to sign contract");

      toast({ title: t("contractSigned") });
      setSigningDialogOpen(false);
      setSignatureData("");
      fetchContract();
    } catch (error) {
      toast({ title: tCommon("error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copySigningLink = () => {
    if (!contract) return;
    const link = `${window.location.origin}/sign/${contract.signingToken}`;
    navigator.clipboard.writeText(link);
    toast({ title: t("linkCopied"), description: link });
  };

  const handleDownloadPdf = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: locale }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (error) {
      toast({ title: tCommon("error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendLine = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/send-line`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: window.location.origin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }
      toast({ title: t("sendSigningLink"), description: "Sent via LINE" });
    } catch (error) {
      toast({
        title: tCommon("error"),
        description: error instanceof Error ? error.message : "Failed to send",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addClause = () => {
    setClauses([...clauses, { title: "", titleTh: "", content: "", contentTh: "" }]);
  };

  const removeClause = (index: number) => {
    setClauses(clauses.filter((_, i) => i !== index));
  };

  const updateClause = (index: number, field: keyof Clause, value: string) => {
    const updated = [...clauses];
    updated[index] = { ...updated[index], [field]: value };
    setClauses(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Contract not found</p>
        <Button className="mt-4" onClick={() => router.push(`/${locale}/contracts`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Contracts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/${locale}/contracts`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contract.contractNo}</h1>
              <Badge className={statusColors[contract.status]}>
                {t(`statuses.${contract.status}`)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {contract.tenant.name} - {contract.unit.unitNumber}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {contract.status === "DRAFT" && (
            <Button onClick={() => setSigningDialogOpen(true)}>
              <FileSignature className="h-4 w-4 mr-2" />
              {t("signContract")}
            </Button>
          )}
          {contract.status === "PENDING_TENANT" && (
            <>
              <Button variant="outline" onClick={copySigningLink}>
                <Copy className="h-4 w-4 mr-2" />
                {t("copySigningLink")}
              </Button>
              <Button variant="outline" onClick={handleSendLine} disabled={saving}>
                <MessageCircle className="h-4 w-4 mr-2" />
                {t("sendViaLine")}
              </Button>
            </>
          )}
          {contract.status !== "DRAFT" && (
            <Button variant="outline" onClick={handleDownloadPdf} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              {t("downloadPdf")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">{tCommon("details")}</TabsTrigger>
          <TabsTrigger value="clauses">{t("clauses")}</TabsTrigger>
          <TabsTrigger value="signatures">{t("signature")}</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("project")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{contract.project.companyName || contract.project.name}</span>
                </div>
                {contract.project.taxId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ID</span>
                    <span>{contract.project.taxId}</span>
                  </div>
                )}
                {contract.project.companyAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address</span>
                    <span className="text-right max-w-[200px]">{contract.project.companyAddress}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tenant Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("tenant")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{contract.tenant.name}</span>
                </div>
                {contract.tenant.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{contract.tenant.email}</span>
                  </div>
                )}
                {contract.tenant.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span>{contract.tenant.phone}</span>
                  </div>
                )}
                {contract.tenant.idCard && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Card</span>
                    <span>{contract.tenant.idCard}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unit Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("unit")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit Number</span>
                  <span>{contract.unit.unitNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Floor</span>
                  <span>{contract.unit.floor}</span>
                </div>
                {contract.unit.size && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span>{contract.unit.size} sq.m.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contract Terms */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("contractPeriod")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("contractStart")}</span>
                  <span>{formatDate(contract.contractStart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("contractEnd")}</span>
                  <span>{formatDate(contract.contractEnd)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("baseRent")}</span>
                  <span className="font-medium">{formatCurrency(contract.baseRent)}</span>
                </div>
                {contract.commonFee && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("commonFee")}</span>
                    <span>{formatCurrency(contract.commonFee)}</span>
                  </div>
                )}
                {contract.deposit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("deposit")}</span>
                    <span>{formatCurrency(contract.deposit)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clauses Tab */}
        <TabsContent value="clauses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t("clauses")}</CardTitle>
              {contract.status === "DRAFT" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={addClause}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("addClause")}
                  </Button>
                  <Button size="sm" onClick={handleSaveClauses} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {tCommon("save")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {clauses.map((clause, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">Clause {index + 1}</span>
                    {contract.status === "DRAFT" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeClause(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {contract.status === "DRAFT" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>{t("clauseTitle")} (EN)</Label>
                        <Input
                          value={clause.title}
                          onChange={(e) => updateClause(index, "title", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>{t("clauseTitleTh")}</Label>
                        <Input
                          value={clause.titleTh}
                          onChange={(e) => updateClause(index, "titleTh", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>{t("clauseContent")} (EN)</Label>
                        <Textarea
                          value={clause.content}
                          onChange={(e) => updateClause(index, "content", e.target.value)}
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label>{t("clauseContentTh")}</Label>
                        <Textarea
                          value={clause.contentTh}
                          onChange={(e) => updateClause(index, "contentTh", e.target.value)}
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-medium">{clause.title} / {clause.titleTh}</h4>
                      <p className="text-muted-foreground mt-1">{clause.content}</p>
                      <p className="text-muted-foreground mt-1">{clause.contentTh}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Landlord Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {t("landlordSignature")}
                  {contract.landlordSignedAt ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contract.landlordSignedAt ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("signedAt")}: {formatDate(contract.landlordSignedAt)}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t("notSigned")}</p>
                    {contract.status === "DRAFT" && (
                      <Button className="mt-4" onClick={() => setSigningDialogOpen(true)}>
                        <FileSignature className="h-4 w-4 mr-2" />
                        {t("signContract")}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tenant Signature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {t("tenantSignature")}
                  {contract.tenantSignedAt ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contract.tenantSignedAt ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      {t("signedAt")}: {formatDate(contract.tenantSignedAt)}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t("notSigned")}</p>
                    {contract.status === "PENDING_TENANT" && (
                      <Button className="mt-4" variant="outline" onClick={copySigningLink}>
                        <Copy className="h-4 w-4 mr-2" />
                        {t("copySigningLink")}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Signing Dialog */}
      <Dialog open={signingDialogOpen} onOpenChange={setSigningDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("signContract")}</DialogTitle>
            <DialogDescription>
              {t("signingPage.signBelow")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SignaturePad
              onSave={setSignatureData}
              onClear={() => setSignatureData("")}
              clearLabel={t("clearSignature")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigningDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleLandlordSign} disabled={saving || !signatureData}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("saveSignature")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
