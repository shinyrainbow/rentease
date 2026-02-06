import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DoorOpen, Users, FileText, CreditCard, Wrench, TrendingUp, CalendarClock, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

async function getDashboardData(userId: string) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [
    projectCount,
    unitStats,
    pendingInvoices,
    overdueInvoices,
    pendingPayments,
    maintenanceRequests,
    monthlyReceipts,
    expiringContracts,
    recentInvoices,
    recentPayments,
  ] = await Promise.all([
    prisma.project.count({ where: { ownerId: userId } }),
    prisma.unit.groupBy({
      by: ["status"],
      where: { project: { ownerId: userId } },
      _count: true,
    }),
    prisma.invoice.count({
      where: {
        project: { ownerId: userId },
        status: "PENDING",
      },
    }),
    prisma.invoice.findMany({
      where: {
        project: { ownerId: userId },
        status: "OVERDUE",
      },
      include: {
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        project: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.payment.count({
      where: {
        invoice: { project: { ownerId: userId } },
        status: "PENDING",
      },
    }),
    prisma.maintenanceRequest.count({
      where: {
        project: { ownerId: userId },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    // Monthly revenue from receipts
    prisma.receipt.aggregate({
      where: {
        invoice: { project: { ownerId: userId } },
        issuedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    }),
    // Contracts expiring in 30 days (active = contractEnd >= today)
    prisma.tenant.findMany({
      where: {
        unit: { project: { ownerId: userId } },
        contractEnd: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { contractEnd: "asc" },
      take: 5,
    }),
    // Recent invoices
    prisma.invoice.findMany({
      where: { project: { ownerId: userId } },
      include: {
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Recent payments
    prisma.payment.findMany({
      where: { invoice: { project: { ownerId: userId } } },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            tenant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const totalUnits = unitStats.reduce((acc: number, stat) => acc + stat._count, 0);
  const occupiedUnits = unitStats.find((s) => s.status === "OCCUPIED")?._count || 0;
  const vacantUnits = unitStats.find((s) => s.status === "VACANT")?._count || 0;
  const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;
  const monthlyRevenue = monthlyReceipts._sum.amount || 0;

  return {
    projectCount,
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyRate,
    pendingInvoices,
    overdueInvoices,
    pendingPayments,
    maintenanceRequests,
    monthlyRevenue,
    expiringContracts,
    recentInvoices,
    recentPayments,
  };
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getDashboardData(session.user.id);

  const stats = [
    {
      title: t("totalProjects"),
      value: data.projectCount,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: t("totalUnits"),
      value: data.totalUnits,
      icon: DoorOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: t("occupiedUnits"),
      value: data.occupiedUnits,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: t("vacantUnits"),
      value: data.vacantUnits,
      icon: DoorOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: t("occupancyRate"),
      value: `${data.occupancyRate}%`,
      icon: TrendingUp,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
    {
      title: t("monthlyRevenue"),
      value: `฿${data.monthlyRevenue.toLocaleString()}`,
      icon: CreditCard,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: t("pendingPayments"),
      value: data.pendingPayments,
      icon: CreditCard,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: t("maintenanceRequests"),
      value: data.maintenanceRequests,
      icon: Wrench,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">
          {t("welcome")}, {session?.user?.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Overdue Invoices */}
        <Card className={data.overdueInvoices.length > 0 ? "border-red-200" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${data.overdueInvoices.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <CardTitle className="text-lg">{t("overdueInvoices")}</CardTitle>
              {data.overdueInvoices.length > 0 && (
                <Badge variant="destructive">{data.overdueInvoices.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.overdueInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCommon("noData")}</p>
            ) : (
              <div className="space-y-3">
                {data.overdueInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{invoice.invoiceNo}</p>
                      <p className="text-muted-foreground text-xs">
                        {invoice.tenant?.name} - {invoice.unit?.unitNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-red-600">฿{invoice.totalAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Contracts */}
        <Card className={data.expiringContracts.length > 0 ? "border-orange-200" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className={`h-5 w-5 ${data.expiringContracts.length > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              <CardTitle className="text-lg">Contracts Expiring Soon</CardTitle>
              {data.expiringContracts.length > 0 && (
                <Badge className="bg-orange-500">{data.expiringContracts.length}</Badge>
              )}
            </div>
            <CardDescription>Within 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expiringContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCommon("noData")}</p>
            ) : (
              <div className="space-y-3">
                {data.expiringContracts.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {tenant.unit.project.name} - {tenant.unit.unitNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-orange-600">
                        {tenant.contractEnd && formatDate(tenant.contractEnd)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.contractEnd && Math.ceil((new Date(tenant.contractEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
            </div>
            <CardDescription>Recent invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCommon("noData")}</p>
            ) : (
              <div className="space-y-3">
                {data.recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{invoice.invoiceNo}</p>
                      <p className="text-muted-foreground text-xs">
                        {invoice.tenant?.name} - {invoice.unit?.unitNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">฿{invoice.totalAmount.toLocaleString()}</p>
                      <Badge variant={
                        invoice.status === "PAID" ? "default" :
                        invoice.status === "OVERDUE" ? "destructive" : "secondary"
                      } className="text-xs">
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Recent Payments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCommon("noData")}</p>
            ) : (
              <div className="space-y-3">
                {data.recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{payment.invoice.invoiceNo}</p>
                      <p className="text-muted-foreground text-xs">
                        {payment.invoice.tenant?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">฿{payment.amount.toLocaleString()}</p>
                      <Badge variant={payment.status === "VERIFIED" ? "default" : "secondary"} className="text-xs">
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
