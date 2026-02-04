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
    const status = searchParams.get("status");

    const tenants = await prisma.tenant.findMany({
      where: {
        unit: {
          project: { ownerId: session.user.id },
          ...(projectId && { projectId }),
        },
        ...(status && { status: status as "ACTIVE" | "EXPIRED" | "TERMINATED" }),
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectId: true,
            project: { select: { name: true, nameTh: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, project: { ownerId: session.user.id } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Note: Allow multiple tenants per unit (for cases where current contract is ending
    // and new tenant is already lined up)

    // Properly map and sanitize the data for Prisma
    const tenantData = {
      status: "ACTIVE" as const,
      unitId: data.unitId,
      name: data.name,
      nameTh: data.nameTh || null,
      email: data.email || null,
      phone: data.phone || null,
      idCard: data.idCard || null,
      taxId: data.taxId || null,
      tenantType: data.tenantType || "INDIVIDUAL",
      withholdingTax: typeof data.withholdingTax === "number" ? data.withholdingTax : parseFloat(data.withholdingTax) || 0,
      // Contract pricing
      baseRent: typeof data.baseRent === "number" ? data.baseRent : parseFloat(data.baseRent) || 0,
      commonFee: data.commonFee ? parseFloat(data.commonFee) : null,
      deposit: data.deposit ? parseFloat(data.deposit) : null,
      discountPercent: data.discountPercent ? parseFloat(data.discountPercent) : 0,
      discountAmount: data.discountAmount ? parseFloat(data.discountAmount) : 0,
      // Meter info
      electricMeterNo: data.electricMeterNo || null,
      waterMeterNo: data.waterMeterNo || null,
      lineUserId: data.lineUserId || null,
      contractStart: data.contractStart ? new Date(data.contractStart) : null,
      contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
    };

    const tenant = await prisma.tenant.create({
      data: tenantData,
      include: {
        unit: {
          include: {
            project: { select: { name: true, nameTh: true } },
          },
        },
      },
    });

    // Update unit status to occupied (only if currently vacant or reserved)
    if (unit.status === "VACANT" || unit.status === "RESERVED") {
      await prisma.unit.update({
        where: { id: data.unitId },
        data: { status: "OCCUPIED" },
      });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
