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
      address: data.address || null,
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

// End contract - set contract end date to now to mark as expired
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

    // End contract by setting contractEnd to now (or specified date)
    if (data.action === "end_contract") {
      const contractEndDate = data.contractEnd ? new Date(data.contractEnd) : new Date();

      const tenant = await prisma.tenant.update({
        where: { id },
        data: {
          contractEnd: contractEndDate,
        },
        include: {
          unit: { include: { project: { select: { name: true, nameTh: true } } } },
        },
      });

      // Check if unit has any other active tenants (contractEnd >= today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const activeTenantsInUnit = await prisma.tenant.count({
        where: {
          unitId: existingTenant.unitId,
          contractEnd: { gte: today },
          id: { not: id },
        },
      });

      // Update unit status to vacant if no other active tenants
      if (activeTenantsInUnit === 0) {
        await prisma.unit.update({
          where: { id: existingTenant.unitId },
          data: { status: "VACANT" },
        });
      }

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
      include: {
        unit: true,
        invoices: true,
      },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check for linked invoices - historical data must be preserved
    if (existingTenant.invoices.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete tenant with linked invoices",
          details: `This tenant has ${existingTenant.invoices.length} invoice(s) associated with it. Historical data must be preserved. You cannot delete this tenant.`,
          linkedInvoices: existingTenant.invoices.length,
        },
        { status: 400 }
      );
    }

    await prisma.tenant.delete({ where: { id } });

    // Check if tenant was active (contractEnd >= today) before deletion
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wasActive = existingTenant.contractEnd && existingTenant.contractEnd >= today;

    // Update unit status to vacant only if tenant was active and no other active tenants
    if (wasActive) {
      const activeTenantsInUnit = await prisma.tenant.count({
        where: {
          unitId: existingTenant.unitId,
          contractEnd: { gte: today },
        },
      });

      if (activeTenantsInUnit === 0) {
        await prisma.unit.update({
          where: { id: existingTenant.unitId },
          data: { status: "VACANT" },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
