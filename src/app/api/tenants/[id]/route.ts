import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireMutationAccess } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
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
      return NextResponse.json({ error: "ไม่พบผู้เช่า (Tenant not found)" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireMutationAccess();
    if (error) return error;

    const { id } = await params;
    const data = await request.json();

    // contractStart and contractEnd are required
    if (!data.contractStart || !data.contractEnd) {
      return NextResponse.json(
        { error: "กรุณาระบุวันเริ่มสัญญาและวันสิ้นสุดสัญญา (Contract start and end dates are required)" },
        { status: 400 }
      );
    }

    // Validate contract dates
    const startDate = new Date(data.contractStart);
    const endDate = new Date(data.contractEnd);

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "วันที่เริ่มสัญญาต้องน้อยกว่าวันที่สิ้นสุดสัญญา (Contract start date must be less than contract end date)" },
        { status: 400 }
      );
    }

    const existingTenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "ไม่พบผู้เช่า (Tenant not found)" }, { status: 404 });
    }

    // Check for overlapping contracts on the same unit (exclude self)
    const overlapping = await prisma.tenant.findFirst({
      where: {
        unitId: existingTenant.unitId,
        id: { not: id },
        contractStart: { lt: endDate },
        contractEnd: { gt: startDate },
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: "contractOverlap", overlappingTenant: overlapping.name },
        { status: 400 }
      );
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
      // Meter info
      electricMeterNo: data.electricMeterNo || null,
      waterMeterNo: data.waterMeterNo || null,
      lineUserId: data.lineUserId || null,
      contractStart: new Date(data.contractStart),
      contractEnd: new Date(data.contractEnd),
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
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error: authError } = await requireMutationAccess();
    if (authError) return authError;

    const { id } = await params;

    const existingTenant = await prisma.tenant.findFirst({
      where: { id, unit: { project: { ownerId: session.user.id } } },
      include: {
        unit: true,
        invoices: true,
      },
    });

    if (!existingTenant) {
      return NextResponse.json({ error: "ไม่พบผู้เช่า (Tenant not found)" }, { status: 404 });
    }

    // Check for linked invoices - historical data must be preserved
    if (existingTenant.invoices.length > 0) {
      return NextResponse.json(
        {
          error: `ผู้เช่ารายนี้มีใบแจ้งหนี้ ${existingTenant.invoices.length} ใบ ข้อมูลประวัติต้องถูกเก็บรักษาไว้ ไม่สามารถลบผู้เช่ารายนี้ได้ (Cannot delete tenant with linked ${existingTenant.invoices.length} invoice(s). Historical data must be preserved.)`,
          details: `This tenant has ${existingTenant.invoices.length} invoice(s) associated with it. Historical data must be preserved. You cannot delete this tenant.`,
          linkedInvoices: existingTenant.invoices.length,
        },
        { status: 400 }
      );
    }

    await prisma.tenant.delete({ where: { id } });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}
