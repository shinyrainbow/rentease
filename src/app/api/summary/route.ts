import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");

    // Build where clause for invoices
    const whereClause: any = {
      project: { ownerId: session.user.id },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (startMonth && endMonth) {
      whereClause.billingMonth = {
        gte: startMonth,
        lte: endMonth,
      };
    }

    // Fetch all invoices with payments and receipts
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        project: { select: { name: true } },
        unit: { select: { unitNumber: true } },
        tenant: { select: { name: true } },
        payments: {
          where: { status: "VERIFIED" },
        },
        receipt: true,
      },
      orderBy: { billingMonth: "desc" },
    });

    // Group by billing month
    const monthlyData: Record<string, any> = {};

    invoices.forEach((invoice) => {
      const month = invoice.billingMonth;

      if (!monthlyData[month]) {
        monthlyData[month] = {
          billingMonth: month,
          totalInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          invoiceCount: 0,
          paidCount: 0,
          partialCount: 0,
          overdueCount: 0,
          pendingCount: 0,
          receiptsCount: 0,
          // Problem detection
          missingPayments: [], // Invoices without any payments
          potentialDuplicates: [], // Payments exceeding invoice amount
          byType: {
            RENT: { invoiced: 0, paid: 0 },
            UTILITY: { invoiced: 0, paid: 0 },
            COMBINED: { invoiced: 0, paid: 0 },
          },
          byProject: {} as Record<string, { invoiced: number; paid: number }>,
        };
      }

      const data = monthlyData[month];

      // Aggregate totals
      data.totalInvoiced += invoice.totalAmount;
      data.totalPaid += invoice.paidAmount;
      data.totalOutstanding += invoice.totalAmount - invoice.paidAmount;
      data.invoiceCount += 1;

      // Count by status
      if (invoice.status === "PAID") data.paidCount += 1;
      else if (invoice.status === "PARTIAL") data.partialCount += 1;
      else if (invoice.status === "OVERDUE") data.overdueCount += 1;
      else if (invoice.status === "PENDING") data.pendingCount += 1;

      // Count receipts
      if (invoice.receipt) data.receiptsCount += 1;

      // Aggregate by type
      data.byType[invoice.type].invoiced += invoice.totalAmount;
      data.byType[invoice.type].paid += invoice.paidAmount;

      // Aggregate by project
      if (!data.byProject[invoice.project.name]) {
        data.byProject[invoice.project.name] = { invoiced: 0, paid: 0 };
      }
      data.byProject[invoice.project.name].invoiced += invoice.totalAmount;
      data.byProject[invoice.project.name].paid += invoice.paidAmount;

      // PROBLEM DETECTION 1: Missing payments (no payments at all)
      if (invoice.payments.length === 0 && invoice.status !== "CANCELLED") {
        data.missingPayments.push({
          invoiceNo: invoice.invoiceNo,
          tenant: invoice.tenant.name,
          unit: invoice.unit.unitNumber,
          amount: invoice.totalAmount,
          dueDate: invoice.dueDate,
          status: invoice.status,
        });
      }

      // PROBLEM DETECTION 2: Potential duplicates (paid amount exceeds total)
      if (invoice.paidAmount > invoice.totalAmount) {
        const totalPayments = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
        data.potentialDuplicates.push({
          invoiceNo: invoice.invoiceNo,
          tenant: invoice.tenant.name,
          unit: invoice.unit.unitNumber,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          paymentsCount: invoice.payments.length,
          overpaidBy: invoice.paidAmount - invoice.totalAmount,
        });
      }
    });

    // Convert to array and calculate collection rate
    const summaryByMonth = Object.values(monthlyData).map((data: any) => ({
      ...data,
      collectionRate: data.totalInvoiced > 0
        ? Math.round((data.totalPaid / data.totalInvoiced) * 100 * 10) / 10
        : 0,
      byProject: Object.entries(data.byProject).map(([name, values]: [string, any]) => ({
        projectName: name,
        totalInvoiced: values.invoiced,
        totalPaid: values.paid,
        collectionRate: values.invoiced > 0
          ? Math.round((values.paid / values.invoiced) * 100 * 10) / 10
          : 0,
      })),
    }));

    // Calculate overall stats
    const overallStats = {
      totalRevenue: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalInvoiced: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalOutstanding: invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter((inv) => inv.status === "PAID").length,
      overdueInvoices: invoices.filter((inv) => inv.status === "OVERDUE").length,
      overdueAmount: invoices
        .filter((inv) => inv.status === "OVERDUE")
        .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
      averageCollectionRate: summaryByMonth.length > 0
        ? Math.round(
            (summaryByMonth.reduce((sum, data) => sum + data.collectionRate, 0) / summaryByMonth.length) * 10
          ) / 10
        : 0,
      // Problem summary
      totalMissingPayments: summaryByMonth.reduce((sum, data) => sum + data.missingPayments.length, 0),
      totalPotentialDuplicates: summaryByMonth.reduce((sum, data) => sum + data.potentialDuplicates.length, 0),
    };

    return NextResponse.json({
      summaryByMonth,
      overallStats,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
