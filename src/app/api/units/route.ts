import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const units = await prisma.unit.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
        // If activeOnly, only return units that have at least one active tenant
        ...(activeOnly && {
          tenants: {
            some: {
              contractStart: { lte: new Date() },
              contractEnd: { gte: new Date() },
            },
          },
        }),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: {
          where: {
            // Show tenants whose contract hasn't expired yet (including future tenants)
            OR: [
              { contractEnd: null },
              { contractEnd: { gte: new Date() } },
            ],
          },
          select: { name: true, nameTh: true, contractStart: true, contractEnd: true },
          orderBy: { contractStart: "asc" },
          take: 1,
        },
      },
      orderBy: [{ projectId: "asc" }, { unitNumber: "asc" }],
    });

    // Transform to include single active tenant for backward compatibility
    const unitsWithTenant = units.map((unit) => ({
      ...unit,
      tenant: unit.tenants[0] || null,
      tenants: undefined,
    }));

    return NextResponse.json(unitsWithTenant);
  } catch (error) {
    console.error("Error fetching units:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const data = await request.json();

    const project = await prisma.project.findFirst({
      where: { id: data.projectId, ownerId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "ไม่พบโครงการ (Project not found)" }, { status: 404 });
    }

    // Sanitize and map data for Prisma (only physical unit properties)
    const unitData = {
      projectId: data.projectId,
      unitNumber: data.unitNumber,
      floor: typeof data.floor === "number" ? data.floor : parseInt(data.floor) || 1,
      size: data.size ? parseFloat(data.size) : null,
      type: data.type || "WAREHOUSE",
      status: data.status || "VACANT",
      positionX: data.positionX ? parseFloat(data.positionX) : null,
      positionY: data.positionY ? parseFloat(data.positionY) : null,
      width: data.width ? parseFloat(data.width) : null,
      height: data.height ? parseFloat(data.height) : null,
    };

    const unit = await prisma.unit.create({
      data: unitData,
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: {
          where: {
            // Show tenants whose contract hasn't expired yet (including future tenants)
            OR: [
              { contractEnd: null },
              { contractEnd: { gte: new Date() } },
            ],
          },
          select: { name: true, nameTh: true, contractStart: true, contractEnd: true },
          orderBy: { contractStart: "asc" },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      ...unit,
      tenant: unit.tenants[0] || null,
      tenants: undefined,
    });
  } catch (error) {
    console.error("Error creating unit:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}
