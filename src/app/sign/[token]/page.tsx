"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertCircle, FileSignature } from "lucide-react";
import { SignaturePad } from "@/components/contracts/signature-pad";
import Image from "next/image";

interface Clause {
  title: string;
  titleTh: string;
  content: string;
  contentTh: string;
}

interface ContractData {
  contractNo: string;
  title: string | null;
  titleTh: string | null;
  baseRent: number;
  commonFee: number | null;
  deposit: number | null;
  contractStart: string;
  contractEnd: string;
  clauses: Clause[] | null;
  landlordSignedAt: string | null;
  project: {
    name: string;
    nameTh: string | null;
    companyName: string | null;
    companyNameTh: string | null;
    companyAddress: string | null;
    logoUrl: string | null;
  };
  unit: {
    unitNumber: string;
    floor: number;
    size: number | null;
    type: string;
  };
  tenant: {
    name: string;
    nameTh: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}

type PageState = "loading" | "ready" | "signing" | "success" | "error";

export default function PublicSigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string>("");
  const [contract, setContract] = useState<ContractData | null>(null);
  const [signatureData, setSignatureData] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [lang, setLang] = useState<"en" | "th">("en");

  useEffect(() => {
    fetchContract();
  }, [token]);

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/sign/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load contract");
        setState("error");
        return;
      }

      setContract(data);
      setState("ready");
    } catch (err) {
      setError("Failed to load contract");
      setState("error");
    }
  };

  const handleSubmitSignature = async () => {
    if (!signatureData || !agreed) return;

    setState("signing");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureData }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit signature");
        setState("error");
        return;
      }

      setState("success");
    } catch (err) {
      setError("Failed to submit signature");
      setState("error");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const t = {
    en: {
      title: "Lease Agreement",
      subtitle: "Digital Signing",
      contractDetails: "Contract Details",
      contractNo: "Contract No.",
      property: "Property",
      unit: "Unit",
      tenant: "Tenant",
      period: "Contract Period",
      rent: "Monthly Rent",
      commonFee: "Common Fee",
      deposit: "Security Deposit",
      terms: "Terms & Conditions",
      signBelow: "Sign in the box below",
      agree: "I have read and agree to the terms and conditions of this lease agreement",
      submit: "Submit Signature",
      clear: "Clear",
      successTitle: "Thank You!",
      successMessage: "Your signature has been submitted successfully. The contract is now fully executed.",
      errorTitle: "Error",
      landlord: "Landlord",
      lessee: "Lessee",
      signedOn: "Signed on",
    },
    th: {
      title: "สัญญาเช่า",
      subtitle: "เซ็นสัญญาดิจิทัล",
      contractDetails: "รายละเอียดสัญญา",
      contractNo: "เลขที่สัญญา",
      property: "ทรัพย์สิน",
      unit: "ห้อง/ยูนิต",
      tenant: "ผู้เช่า",
      period: "ระยะเวลาสัญญา",
      rent: "ค่าเช่ารายเดือน",
      commonFee: "ค่าส่วนกลาง",
      deposit: "เงินประกัน",
      terms: "ข้อกำหนดและเงื่อนไข",
      signBelow: "เซ็นในกล่องด้านล่าง",
      agree: "ข้าพเจ้าได้อ่านและยอมรับข้อกำหนดและเงื่อนไขของสัญญาเช่าฉบับนี้",
      submit: "ยืนยันลายเซ็น",
      clear: "ล้าง",
      successTitle: "ขอบคุณ!",
      successMessage: "ลายเซ็นของคุณถูกบันทึกเรียบร้อยแล้ว สัญญามีผลบังคับใช้แล้ว",
      errorTitle: "เกิดข้อผิดพลาด",
      landlord: "ผู้ให้เช่า",
      lessee: "ผู้เช่า",
      signedOn: "เซ็นเมื่อ",
    },
  };

  const text = t[lang];

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{text.errorTitle}</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{text.successTitle}</h2>
            <p className="text-muted-foreground">{text.successMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {contract.project.logoUrl && (
              <Image
                src={contract.project.logoUrl}
                alt="Logo"
                width={40}
                height={40}
                className="rounded"
              />
            )}
            <div>
              <h1 className="font-bold text-lg">
                {lang === "th" ? contract.project.nameTh || contract.project.name : contract.project.name}
              </h1>
              <p className="text-sm text-muted-foreground">{text.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant={lang === "en" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLang("en")}
            >
              EN
            </Button>
            <Button
              variant={lang === "th" ? "default" : "ghost"}
              size="sm"
              onClick={() => setLang("th")}
            >
              TH
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Contract Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              {text.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{text.contractNo}</span>
                <p className="font-medium">{contract.contractNo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{text.property}</span>
                <p className="font-medium">
                  {lang === "th"
                    ? contract.project.companyNameTh || contract.project.companyName || contract.project.name
                    : contract.project.companyName || contract.project.name}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{text.unit}</span>
                <p className="font-medium">{contract.unit.unitNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">{text.tenant}</span>
                <p className="font-medium">
                  {lang === "th" ? contract.tenant.nameTh || contract.tenant.name : contract.tenant.name}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{text.period}</span>
                <p className="font-medium">
                  {formatDate(contract.contractStart)} - {formatDate(contract.contractEnd)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{text.rent}</span>
                <p className="font-medium text-primary">{formatCurrency(contract.baseRent)}</p>
              </div>
              {contract.commonFee && (
                <div>
                  <span className="text-muted-foreground">{text.commonFee}</span>
                  <p className="font-medium">{formatCurrency(contract.commonFee)}</p>
                </div>
              )}
              {contract.deposit && (
                <div>
                  <span className="text-muted-foreground">{text.deposit}</span>
                  <p className="font-medium">{formatCurrency(contract.deposit)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
        {contract.clauses && contract.clauses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{text.terms}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contract.clauses.map((clause, index) => (
                <div key={index} className="space-y-1">
                  <h4 className="font-medium">
                    {index + 1}. {lang === "th" ? clause.titleTh || clause.title : clause.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {lang === "th" ? clause.contentTh || clause.content : clause.content}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Landlord Signature Status */}
        {contract.landlordSignedAt && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">{text.landlord}</p>
                  <p className="text-sm text-green-600">
                    {text.signedOn} {formatDate(contract.landlordSignedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signature Pad */}
        <Card>
          <CardHeader>
            <CardTitle>{text.lessee} - {text.signBelow}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignaturePad
              onSave={setSignatureData}
              onClear={() => setSignatureData("")}
              clearLabel={text.clear}
            />

            <div className="flex items-start gap-3">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
              />
              <label htmlFor="agree" className="text-sm cursor-pointer">
                {text.agree}
              </label>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmitSignature}
              disabled={!signatureData || !agreed || state === "signing"}
            >
              {state === "signing" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {text.submit}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
