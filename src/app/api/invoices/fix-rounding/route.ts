import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// One-time script to fix floating point rounding in existing invoices.
// Safe: only recalculates withholdingTax & totalAmount from subtotal + tenant WH%.
// Does NOT change subtotal, lineItems, or any user-entered data.
// DELETE this file after running it once.

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { project: { ownerId: session.user.id } },
      select: {
        id: true,
        type: true,
        subtotal: true,
        withholdingTax: true,
        totalAmount: true,
        tenant: {
          select: {
            tenantType: true,
            withholdingTax: true,
          },
        },
      },
    });

    let fixed = 0;
    let skipped = 0;

    for (const inv of invoices) {
      const whPercent = inv.tenant?.tenantType === "COMPANY"
        ? (inv.tenant.withholdingTax || 0)
        : 0;

      // For UTILITY: no WH at all
      // For RENT/COMBINED: recalculate with proper rounding
      const correctWh = inv.type === "UTILITY"
        ? 0
        : Math.round(inv.subtotal * (whPercent / 100) * 100) / 100;

      const correctTotal = Math.round((inv.subtotal - correctWh) * 100) / 100;

      // Only update if values differ
      const whDiff = Math.abs(inv.withholdingTax - correctWh) > 0.001;
      const totalDiff = Math.abs(inv.totalAmount - correctTotal) > 0.001;

      if (whDiff || totalDiff) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            withholdingTax: correctWh,
            totalAmount: correctTotal,
          },
        });
        fixed++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      total: invoices.length,
      fixed,
      skipped,
    });
  } catch (error) {
    console.error("Fix rounding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
