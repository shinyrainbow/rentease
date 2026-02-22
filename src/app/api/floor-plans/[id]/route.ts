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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const floorPlan = await prisma.floorPlan.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!floorPlan) {
      return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
    }

    return NextResponse.json(floorPlan);
  } catch (error) {
    console.error("Error fetching floor plan:", error);
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

    const existing = await prisma.floorPlan.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });
    }

    const floorPlan = await prisma.floorPlan.update({
      where: { id },
      data: { layoutData: data.layoutData },
    });

    return NextResponse.json(floorPlan);
  } catch (error) {
    console.error("Error updating floor plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
