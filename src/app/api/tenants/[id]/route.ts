import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
      include: {
        unit: { include: { project: true } },
        invoices: { orderBy: { createdAt: "desc" }, take: 10 },
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const existingTenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Properly map and sanitize the data for Prisma
    const updateData = {
      name: data.name,
      nameTh: data.nameTh || null,
      email: data.email || null,
      phone: data.phone || null,
      idCard: data.idCard || null,
      taxId: data.taxId || null,
      tenantType: data.tenantType || "INDIVIDUAL",
      withholdingTax: typeof data.withholdingTax === "number" ? data.withholdingTax : parseFloat(data.withholdingTax) || 0,
      lineUserId: data.lineUserId || null,
      contractStart: data.contractStart ? new Date(data.contractStart) : null,
      contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
    };

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
      include: {
        unit: { include: { project: { select: { name: true, nameTh: true } } } },
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// End contract - set tenant to EXPIRED and unit to VACANT
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const existingTenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
      include: { unit: true },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // End contract
    if (data.action === "end_contract") {
      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          status: "EXPIRED",
          contractEnd: data.contractEnd ? new Date(data.contractEnd) : new Date(),
        },
        include: {
          unit: { include: { project: { select: { name: true, nameTh: true } } } },
        },
      });

      // Update unit status to vacant
      await prisma.unit.update({
        where: { id: existingTenant.unitId },
        data: { status: "VACANT" },
      });

      return NextResponse.json(tenant);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existingTenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
      include: { unit: true },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await prisma.tenant.delete({ where: { id } });

    // Update unit status to vacant only if tenant was active
    if (existingTenant.status === "ACTIVE") {
      await prisma.unit.update({
        where: { id: existingTenant.unitId },
        data: { status: "VACANT" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
