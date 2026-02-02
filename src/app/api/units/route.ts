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

    const units = await prisma.unit.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: {
          where: { status: "ACTIVE" },
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

    const project = await prisma.project.findFirst({
      where: { id: data.projectId, ownerId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const unit = await prisma.unit.create({
      data,
      include: {
        project: { select: { name: true, nameTh: true } },
        tenants: {
          where: { status: "ACTIVE" },
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
