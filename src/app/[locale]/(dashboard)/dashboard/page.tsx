import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, DoorOpen, Users, FileText, CreditCard, Wrench } from "lucide-react";

async function getDashboardData(userId: string) {
  const [
    projectCount,
    unitStats,
    pendingInvoices,
    pendingPayments,
    maintenanceRequests,
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
        status: { in: ["PENDING", "OVERDUE"] },
      },
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
  ]);

  const totalUnits = unitStats.reduce((acc: number, stat) => acc + stat._count, 0);
  const occupiedUnits = unitStats.find((s) => s.status === "OCCUPIED")?._count || 0;
  const vacantUnits = unitStats.find((s) => s.status === "VACANT")?._count || 0;
  const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;

  return {
    projectCount,
    totalUnits,
    occupiedUnits,
    vacantUnits,
    occupancyRate,
    pendingInvoices,
    pendingPayments,
    maintenanceRequests,
  };
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  const data = await getDashboardData(session!.user.id);

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
      icon: Building2,
      color: "text-teal-600",
      bgColor: "bg-teal-100",
    },
    {
      title: t("pendingPayments"),
      value: data.pendingPayments,
      icon: CreditCard,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: t("overdueInvoices"),
      value: data.pendingInvoices,
      icon: FileText,
      color: "text-red-600",
      bgColor: "bg-red-100",
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
    </div>
  );
}
