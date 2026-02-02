"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Check, X, Image } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  slipUrl: string | null;
  transferRef: string | null;
  paidAt: string;
  invoice: {
    invoiceNo: string;
    project: { name: string };
    unit: { unitNumber: string };
  };
  tenant: { name: string };
}

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();
      setPayments(data);
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleVerify = async (id: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/payments/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error verifying payment:", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "VERIFIED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">{tCommon("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tCommon("all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tCommon("all")}</SelectItem>
            <SelectItem value="PENDING">{t("statuses.PENDING")}</SelectItem>
            <SelectItem value="VERIFIED">{t("statuses.VERIFIED")}</SelectItem>
            <SelectItem value="REJECTED">{t("statuses.REJECTED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead>{t("slipUrl")}</TableHead>
                <TableHead>{tCommon("status")}</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {tCommon("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.invoice.invoiceNo}</TableCell>
                    <TableCell>{payment.invoice.project.name}</TableCell>
                    <TableCell>{payment.invoice.unit.unitNumber}</TableCell>
                    <TableCell>{payment.tenant.name}</TableCell>
                    <TableCell>฿{payment.amount.toLocaleString()}</TableCell>
                    <TableCell>{t(`methods.${payment.method}`)}</TableCell>
                    <TableCell>
                      {payment.slipUrl ? (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={payment.slipUrl} target="_blank" rel="noopener noreferrer">
                            <Image className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(payment.status)}>
                        {t(`statuses.${payment.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600"
                            onClick={() => handleVerify(payment.id, true)}
                            title={t("verifyPayment")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            onClick={() => handleVerify(payment.id, false)}
                            title={t("rejectPayment")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
