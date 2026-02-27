import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
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

    const unit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        project: true,
        tenants: {
          orderBy: { contractStart: "desc" },
        },
        meterReadings: { orderBy: { createdAt: "desc" }, take: 10 },
        invoices: { orderBy: { createdAt: "desc" }, take: 10 },
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "ไม่พบห้องพัก (Unit not found)" }, { status: 404 });
    }

    // Pick the currently active tenant, compute status dynamically
    const today = new Date();
    const activeTenant = unit.tenants.find((t) => {
      const started = new Date(t.contractStart) <= today;
      const notEnded = new Date(t.contractEnd) >= today;
      return started && notEnded;
    });
    const tenant = activeTenant || unit.tenants[0] || null;

    let computedStatus = unit.status;
    if (unit.status !== "MAINTENANCE" && unit.status !== "RESERVED") {
      computedStatus = activeTenant ? "OCCUPIED" : "VACANT";
    }

    return NextResponse.json({
      ...unit,
      status: computedStatus,
      tenant,
      tenants: undefined,
    });
  } catch (error) {
    console.error("Error fetching unit:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const existingUnit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "ไม่พบห้องพัก (Unit not found)" }, { status: 404 });
    }

    // Only allow physical unit properties to be updated
    const updateData: Record<string, unknown> = {};

    if (data.unitNumber !== undefined) updateData.unitNumber = data.unitNumber;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.size !== undefined) updateData.size = data.size;
    if (data.type !== undefined) updateData.type = data.type;
    // Status is computed dynamically from tenant contracts — not manually settable
    if (data.positionX !== undefined) updateData.positionX = data.positionX;
    if (data.positionY !== undefined) updateData.positionY = data.positionY;
    if (data.width !== undefined) updateData.width = data.width;
    if (data.height !== undefined) updateData.height = data.height;

    const unit = await prisma.unit.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: {
          orderBy: { contractStart: "desc" },
        },
      },
    });

    // Pick the currently active tenant
    const todayPut = new Date();
    const activeTenantPut = unit.tenants.find((t) => {
      const started = new Date(t.contractStart) <= todayPut;
      const notEnded = new Date(t.contractEnd) >= todayPut;
      return started && notEnded;
    });

    return NextResponse.json({
      ...unit,
      tenant: activeTenantPut || unit.tenants[0] || null,
      tenants: undefined,
    });
  } catch (error) {
    console.error("Error updating unit:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;

    const existingUnit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "ไม่พบห้องพัก (Unit not found)" }, { status: 404 });
    }

    // Tenants will have unitId set to NULL (snapshot data preserved)
    // Invoices will have unitId set to NULL (snapshot data preserved)
    await prisma.unit.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting unit:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}
