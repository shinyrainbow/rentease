"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Download,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportToCSV } from "@/lib/export";

interface Project {
  id: string;
  name: string;
}

interface MissingPayment {
  invoiceNo: string;
  tenant: string;
  unit: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface PotentialDuplicate {
  invoiceNo: string;
  tenant: string;
  unit: string;
  totalAmount: number;
  paidAmount: number;
  paymentsCount: number;
  overpaidBy: number;
}

interface MonthlyData {
  billingMonth: string;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidCount: number;
  partialCount: number;
  overdueCount: number;
  pendingCount: number;
  receiptsCount: number;
  collectionRate: number;
  missingPayments: MissingPayment[];
  potentialDuplicates: PotentialDuplicate[];
  byType: {
    RENT: { invoiced: number; paid: number };
    UTILITY: { invoiced: number; paid: number };
    COMBINED: { invoiced: number; paid: number };
  };
  byProject: Array<{
    projectName: string;
    totalInvoiced: number;
    totalPaid: number;
    collectionRate: number;
  }>;
}

interface OverallStats {
  totalRevenue: number;
  totalInvoiced: number;
  totalOutstanding: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  overdueAmount: number;
  averageCollectionRate: number;
  totalMissingPayments: number;
  totalPotentialDuplicates: number;
}

interface SummaryData {
  summaryByMonth: MonthlyData[];
  overallStats: OverallStats;
}

const COLORS = {
  RENT: "#3B82F6",
  UTILITY: "#F59E0B",
  COMBINED: "#8B5CF6",
  invoiced: "#3B82F6",
  paid: "#10B981",
};

export default function SummaryPage() {
  const t = useTranslations("summary");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("last6Months");
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectFilter) params.append("projectId", projectFilter);

      // Calculate date range
      const today = new Date();
      let startMonth = "";
      let endMonth = today.toISOString().slice(0, 7);

      switch (dateRange) {
        case "last3Months":
          startMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 7);
          break;
        case "last6Months":
          startMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 7);
          break;
        case "last12Months":
          startMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 7);
          break;
        case "allTime":
          // Don't set startMonth for all time
          break;
      }

      if (startMonth) {
        params.append("startMonth", startMonth);
        params.append("endMonth", endMonth);
      }

      const [summaryRes, projectsRes] = await Promise.all([
        fetch(`/api/summary?${params.toString()}`),
        fetch("/api/projects"),
      ]);

      const [summaryData, projectsData] = await Promise.all([
        summaryRes.json(),
        projectsRes.json(),
      ]);

      setSummaryData(summaryData);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectFilter, dateRange]);

  const getCollectionRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-600 bg-green-50";
    if (rate >= 80) return "text-green-600 bg-green-50";
    if (rate >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getCollectionRateBadge = (rate: number) => {
    if (rate >= 90) return "bg-green-100 text-green-800";
    if (rate >= 80) return "bg-green-100 text-green-800";
    if (rate >= 70) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toLocaleString()}`;
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString("th-TH", { year: "numeric", month: "long" });
  };

  const handleExport = () => {
    if (!summaryData) return;

    const dataToExport = summaryData.summaryByMonth.map((data) => ({
      billingMonth: data.billingMonth,
      totalInvoiced: data.totalInvoiced,
      totalPaid: data.totalPaid,
      totalOutstanding: data.totalOutstanding,
      collectionRate: data.collectionRate,
      invoiceCount: data.invoiceCount,
      paidCount: data.paidCount,
      overdueCount: data.overdueCount,
      missingPaymentsCount: data.missingPayments.length,
      potentialDuplicatesCount: data.potentialDuplicates.length,
    }));

    exportToCSV(
      dataToExport,
      [
        { key: "billingMonth", header: "Billing Month" },
        { key: "totalInvoiced", header: "Invoiced" },
        { key: "totalPaid", header: "Collected" },
        { key: "totalOutstanding", header: "Outstanding" },
        { key: "collectionRate", header: "Rate (%)" },
        { key: "invoiceCount", header: "Invoices" },
        { key: "paidCount", header: "Paid" },
        { key: "overdueCount", header: "Overdue" },
        { key: "missingPaymentsCount", header: "Missing Payments" },
        { key: "potentialDuplicatesCount", header: "Potential Duplicates" },
      ],
      `summary-${new Date().toISOString().slice(0, 10)}`
    );
  };

  if (loading) {
    return <PageSkeleton columns={4} rows={6} />;
  }

  if (!summaryData) {
    return <div>No data available</div>;
  }

  const { summaryByMonth, overallStats } = summaryData;

  // Prepare data for pie chart
  const pieData = [
    { name: "ค่าเช่า", value: summaryByMonth.reduce((sum, d) => sum + d.byType.RENT.paid, 0) },
    { name: "ค่าสาธารณูปโภค", value: summaryByMonth.reduce((sum, d) => sum + d.byType.UTILITY.paid, 0) },
    { name: "รวม", value: summaryByMonth.reduce((sum, d) => sum + d.byType.COMBINED.paid, 0) },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last3Months">{t("last3Months")}</SelectItem>
              <SelectItem value="last6Months">{t("last6Months")}</SelectItem>
              <SelectItem value="last12Months">{t("last12Months")}</SelectItem>
              <SelectItem value="allTime">{t("allTime")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter || "__all__"} onValueChange={(v) => setProjectFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("exportData")}
          </Button>
        </div>
      </div>

      {/* Problem Alerts */}
      {(overallStats.totalMissingPayments > 0 || overallStats.totalPotentialDuplicates > 0) && (
        <div className="space-y-3">
          {overallStats.totalMissingPayments > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>ใบแจ้งหนี้ที่ยังไม่มีการชำระเงิน</AlertTitle>
              <AlertDescription>
                พบ {overallStats.totalMissingPayments} ใบแจ้งหนี้ที่ยังไม่มีการชำระเงินเลย กรุณาตรวจสอบ
              </AlertDescription>
            </Alert>
          )}
          {overallStats.totalPotentialDuplicates > 0 && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">พบการชำระเงินที่อาจซ้ำซ้อน</AlertTitle>
              <AlertDescription className="text-yellow-700">
                พบ {overallStats.totalPotentialDuplicates} ใบแจ้งหนี้ที่มียอดชำระเกินกว่ายอดบิล กรุณาตรวจสอบ
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overallStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              จาก {overallStats.totalInvoices} ใบแจ้งหนี้
            </p>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalOutstanding")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(overallStats.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">
              คงค้าง {overallStats.totalInvoices - overallStats.paidInvoices} ใบ
            </p>
          </CardContent>
        </Card>

        {/* Collection Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("collectionRate")}</CardTitle>
            {overallStats.averageCollectionRate >= 80 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallStats.averageCollectionRate >= 80 ? "text-green-600" : "text-red-600"}`}>
              {overallStats.averageCollectionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              เฉลี่ยทุกเดือน
            </p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("overdueAmount")}</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(overallStats.overdueAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats.overdueInvoices} ใบเกินกำหนด
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bar Chart - Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>{t("monthlyTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summaryByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="billingMonth"
                  tickFormatter={(value) => {
                    const [year, month] = value.split("-");
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => (typeof value === 'number' ? formatCurrency(value) : '')}
                  labelFormatter={(label) => formatMonth(label)}
                />
                <Legend />
                <Bar dataKey="totalInvoiced" fill={COLORS.invoiced} name="ออกบิล" />
                <Bar dataKey="totalPaid" fill={COLORS.paid} name="เก็บได้" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Revenue by Type */}
        <Card>
          <CardHeader>
            <CardTitle>{t("revenueByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => (typeof value === 'number' ? formatCurrency(value) : '')} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Collection Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle>{t("collectionTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={summaryByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="billingMonth"
                tickFormatter={(value) => {
                  const [year, month] = value.split("-");
                  return `${month}/${year.slice(2)}`;
                }}
              />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                formatter={(value: number) => `${value}%`}
                labelFormatter={(label) => formatMonth(label)}
              />
              <Line
                type="monotone"
                dataKey="collectionRate"
                stroke="#10B981"
                strokeWidth={2}
                name="อัตราการเก็บเงิน"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("monthlyBreakdown")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("billingMonth")}</TableHead>
                <TableHead className="text-right">{t("invoiced")}</TableHead>
                <TableHead className="text-right">{t("collected")}</TableHead>
                <TableHead className="text-right">{t("outstanding")}</TableHead>
                <TableHead className="text-center">{t("rate")}</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-center">⚠️ ปัญหา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryByMonth.map((data) => (
                <>
                  <TableRow
                    key={data.billingMonth}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedMonth(expandedMonth === data.billingMonth ? null : data.billingMonth)}
                  >
                    <TableCell className="font-medium">{formatMonth(data.billingMonth)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.totalInvoiced)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(data.totalPaid)}</TableCell>
                    <TableCell className="text-right text-yellow-600">{formatCurrency(data.totalOutstanding)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getCollectionRateBadge(data.collectionRate)}>
                        {data.collectionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      <div className="space-y-1">
                        {data.paidCount > 0 && (
                          <div className="text-green-600">✓ {data.paidCount} ชำระแล้ว</div>
                        )}
                        {data.partialCount > 0 && (
                          <div className="text-yellow-600">◐ {data.partialCount} บางส่วน</div>
                        )}
                        {data.overdueCount > 0 && (
                          <div className="text-red-600">! {data.overdueCount} เกินกำหนด</div>
                        )}
                        {data.pendingCount > 0 && (
                          <div className="text-gray-600">○ {data.pendingCount} รอชำระ</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {data.missingPayments.length > 0 && (
                        <Badge variant="destructive" className="mr-1">
                          {data.missingPayments.length} ไม่มีชำระ
                        </Badge>
                      )}
                      {data.potentialDuplicates.length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {data.potentialDuplicates.length} ชำระเกิน
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Details */}
                  {expandedMonth === data.billingMonth && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="p-4 space-y-4">
                          {/* Missing Payments */}
                          {data.missingPayments.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-red-600 mb-2">
                                ⚠️ ใบแจ้งหนี้ที่ยังไม่มีการชำระเงิน ({data.missingPayments.length} ใบ)
                              </h4>
                              <div className="space-y-1 text-sm">
                                {data.missingPayments.map((item) => (
                                  <div key={item.invoiceNo} className="flex justify-between items-center p-2 bg-red-50 rounded">
                                    <span className="font-medium">{item.invoiceNo}</span>
                                    <span>{item.tenant} - {item.unit}</span>
                                    <span className="text-red-600">{formatCurrency(item.amount)}</span>
                                    <Badge variant="outline" className="border-red-300">{item.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Potential Duplicates */}
                          {data.potentialDuplicates.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-yellow-600 mb-2">
                                ⚠️ การชำระเงินที่อาจซ้ำซ้อน ({data.potentialDuplicates.length} ใบ)
                              </h4>
                              <div className="space-y-1 text-sm">
                                {data.potentialDuplicates.map((item) => (
                                  <div key={item.invoiceNo} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                                    <span className="font-medium">{item.invoiceNo}</span>
                                    <span>{item.tenant} - {item.unit}</span>
                                    <span>ยอดบิล: {formatCurrency(item.totalAmount)}</span>
                                    <span className="text-yellow-600">ชำระ: {formatCurrency(item.paidAmount)}</span>
                                    <Badge className="bg-yellow-100 text-yellow-800">
                                      เกิน {formatCurrency(item.overpaidBy)}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* By Project */}
                          {data.byProject.length > 1 && (
                            <div>
                              <h4 className="font-semibold mb-2">แยกตามโครงการ</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {data.byProject.map((proj) => (
                                  <div key={proj.projectName} className="p-2 bg-white rounded border">
                                    <div className="font-medium">{proj.projectName}</div>
                                    <div className="text-sm text-muted-foreground">
                                      ออกบิล: {formatCurrency(proj.totalInvoiced)} |
                                      เก็บได้: {formatCurrency(proj.totalPaid)} ({proj.collectionRate}%)
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
