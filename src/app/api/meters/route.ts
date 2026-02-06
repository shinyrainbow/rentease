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
    const billingMonth = searchParams.get("billingMonth");

    const readings = await prisma.meterReading.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
        ...(billingMonth && { billingMonth }),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: {
          select: {
            unitNumber: true,
            tenants: {
              where: {
                contractStart: { lte: new Date() },
                contractEnd: { gte: new Date() },
              },
              select: { name: true, nameTh: true },
              orderBy: { contractEnd: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ billingMonth: "desc" }, { unitId: "asc" }],
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error("Error fetching meter readings:", error);
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

    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, project: { ownerId: session.user.id } },
      include: {
        project: true,
        tenants: {
          where: {
            contractStart: { lte: new Date() },
            contractEnd: { gte: new Date() },
          },
          take: 1,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Check if unit has an active tenant contract
    if (unit.tenants.length === 0) {
      return NextResponse.json({ error: "No active tenant contract for this unit" }, { status: 400 });
    }

    // Get previous reading (from earlier billing month)
    const previousReading = await prisma.meterReading.findFirst({
      where: {
        unitId: data.unitId,
        type: data.type,
        billingMonth: { lt: data.billingMonth },
      },
      orderBy: { billingMonth: "desc" },
    });

    // Use manual previousReading if provided (for first-time entries), otherwise use from history
    const prevValue = data.previousReading !== undefined
      ? data.previousReading
      : (previousReading?.currentReading || 0);
    const usage = Math.max(0, data.currentReading - prevValue);
    const rate = data.type === "ELECTRICITY" ? unit.project.electricityRate : unit.project.waterRate;
    const amount = usage * rate;

    // Upsert: create if not exists, update if exists
    const reading = await prisma.meterReading.upsert({
      where: {
        unitId_type_billingMonth: {
          unitId: data.unitId,
          type: data.type,
          billingMonth: data.billingMonth,
        },
      },
      update: {
        previousReading: prevValue,
        currentReading: data.currentReading,
        usage,
        rate,
        amount,
        readingDate: new Date(data.readingDate),
      },
      create: {
        projectId: unit.projectId,
        unitId: data.unitId,
        type: data.type,
        previousReading: prevValue,
        currentReading: data.currentReading,
        usage,
        rate,
        amount,
        readingDate: new Date(data.readingDate),
        billingMonth: data.billingMonth,
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
      },
    });

    return NextResponse.json(reading);
  } catch (error) {
    console.error("Error creating meter reading:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
