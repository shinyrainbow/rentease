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

    const unit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        project: true,
        tenants: { where: { status: "ACTIVE" }, take: 1 },
        meterReadings: { orderBy: { createdAt: "desc" }, take: 10 },
        invoices: { orderBy: { createdAt: "desc" }, take: 10 },
        maintenanceRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...unit,
      tenant: unit.tenants[0] || null,
      tenants: undefined,
    });
  } catch (error) {
    console.error("Error fetching unit:", error);
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

    const existingUnit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const unit = await prisma.unit.update({
      where: { id },
      data,
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: { where: { status: "ACTIVE" }, take: 1 },
      },
    });

    return NextResponse.json({
      ...unit,
      tenant: unit.tenants[0] || null,
      tenants: undefined,
    });
  } catch (error) {
    console.error("Error updating unit:", error);
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

    const existingUnit = await prisma.unit.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingUnit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    await prisma.unit.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting unit:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
