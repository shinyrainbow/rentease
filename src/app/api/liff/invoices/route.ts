import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json({ error: "LINE user ID required" }, { status: 400 });
    }

    // Find LINE contact and linked tenant
    const lineContact = await prisma.lineContact.findFirst({
      where: { lineUserId },
      include: {
        tenant: true,
        project: true,
      },
    });

    if (!lineContact || !lineContact.tenant) {
      return NextResponse.json({ error: "Tenant not linked" }, { status: 404 });
    }

    // Get unpaid invoices for this tenant
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: lineContact.tenant.id,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: {
        id: true,
        invoiceNo: true,
        totalAmount: true,
        paidAmount: true,
        billingMonth: true,
        dueDate: true,
        status: true,
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      tenant: {
        id: lineContact.tenant.id,
        name: lineContact.tenant.name,
        nameTh: lineContact.tenant.nameTh,
      },
      project: {
        id: lineContact.project.id,
        name: lineContact.project.name,
        nameTh: lineContact.project.nameTh,
      },
      invoices,
    });
  } catch (error) {
    console.error("Error fetching LIFF invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
