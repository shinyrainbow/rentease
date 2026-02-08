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

    const maintenanceRequest = await prisma.maintenanceRequest.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        project: true,
        unit: { include: { tenants: { where: { contractEnd: { gte: new Date() } }, take: 1 } } },
      },
    });

    if (!maintenanceRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Transform to include single active tenant
    const result = {
      ...maintenanceRequest,
      unit: {
        ...maintenanceRequest.unit,
        tenant: maintenanceRequest.unit.tenants[0] || null,
        tenants: undefined,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching maintenance request:", error);
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

    const existingRequest = await prisma.maintenanceRequest.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...data };

    if (data.status === "COMPLETED" && existingRequest.status !== "COMPLETED") {
      updateData.resolvedAt = new Date();
    }

    const maintenanceRequest = await prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
      },
    });

    return NextResponse.json(maintenanceRequest);
  } catch (error) {
    console.error("Error updating maintenance request:", error);
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
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;

    const existingRequest = await prisma.maintenanceRequest.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "ไม่พบคำขอซ่อมบำรุง (Request not found)" }, { status: 404 });
    }

    await prisma.maintenanceRequest.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting maintenance request:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}
