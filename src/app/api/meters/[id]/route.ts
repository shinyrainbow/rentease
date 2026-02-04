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

    const reading = await prisma.meterReading.findFirst({
      where: {
        id,
        project: { ownerId: session.user.id },
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
      },
    });

    if (!reading) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }

    return NextResponse.json(reading);
  } catch (error) {
    console.error("Error fetching meter reading:", error);
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

    // Find existing reading and verify ownership
    const existingReading = await prisma.meterReading.findFirst({
      where: {
        id,
        project: { ownerId: session.user.id },
      },
      include: {
        project: true,
      },
    });

    if (!existingReading) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }

    // Recalculate usage and amount if currentReading changed
    const usage = Math.max(0, data.currentReading - existingReading.previousReading);
    const rate = existingReading.type === "ELECTRICITY"
      ? existingReading.project.electricityRate
      : existingReading.project.waterRate;
    const amount = usage * rate;

    const reading = await prisma.meterReading.update({
      where: { id },
      data: {
        currentReading: data.currentReading,
        usage,
        rate,
        amount,
        readingDate: new Date(data.readingDate),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
      },
    });

    return NextResponse.json(reading);
  } catch (error) {
    console.error("Error updating meter reading:", error);
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

    // Find existing reading and verify ownership
    const existingReading = await prisma.meterReading.findFirst({
      where: {
        id,
        project: { ownerId: session.user.id },
      },
    });

    if (!existingReading) {
      return NextResponse.json({ error: "Reading not found" }, { status: 404 });
    }

    await prisma.meterReading.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting meter reading:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
