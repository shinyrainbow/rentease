import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");

    if (!lineUserId) {
      return NextResponse.json({ error: "LINE user ID required" }, { status: 400 });
    }

    // Find LINE contact linked to a tenant
    const lineContact = await prisma.lineContact.findFirst({
      where: { lineUserId, tenantId: { not: null } },
      include: {
        tenant: {
          include: {
            unit: {
              include: {
                project: { select: { id: true, name: true, nameTh: true } },
              },
            },
          },
        },
      },
    });

    if (!lineContact || !lineContact.tenant) {
      return NextResponse.json({ error: "Tenant not linked" }, { status: 404 });
    }

    if (!lineContact.tenant.unit) {
      return NextResponse.json({ error: "Tenant has no unit assigned" }, { status: 400 });
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
        dueDate: true,
        status: true,
        unit: { select: { unitNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const project = lineContact.tenant.unit?.project;

    return NextResponse.json({
      tenant: {
        id: lineContact.tenant.id,
        name: lineContact.tenant.name,
        nameTh: lineContact.tenant.nameTh,
      },
      project: project ? {
        id: project.id,
        name: project.name,
        nameTh: project.nameTh,
      } : null,
      invoices,
    });
  } catch (error) {
    console.error("Error fetching LIFF invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
