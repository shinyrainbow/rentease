import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const month = searchParams.get("month"); // YYYY-MM format, filters by readingDate month
    const unitId = searchParams.get("unitId");
    const uninvoiced = searchParams.get("uninvoiced"); // "true" to get only uninvoiced readings

    // Build date range filter from month
    let readingDateFilter: { gte?: Date; lt?: Date } | undefined;
    if (month) {
      const [year, mon] = month.split("-");
      const startDate = new Date(parseInt(year), parseInt(mon) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(mon), 1);
      readingDateFilter = { gte: startDate, lt: endDate };
    }

    const readings = await prisma.meterReading.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
        ...(unitId && { unitId }),
        ...(readingDateFilter && { readingDate: readingDateFilter }),
        ...(uninvoiced === "true" && { invoiceId: null }),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: {
          select: {
            unitNumber: true,
            tenants: {
              select: { name: true, nameTh: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ readingDate: "desc" }, { unitId: "asc" }],
    });

    // Use snapshot fallback when unit relation is null (unit deleted)
    const readingsWithSnapshot = readings.map(reading => ({
      ...reading,
      unit: reading.unit || {
        unitNumber: reading.unitNumber || "-",
        tenants: [],
      },
    }));

    return NextResponse.json(readingsWithSnapshot);
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
      include: { project: true },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Get previous reading (by readingDate)
    const previousReading = await prisma.meterReading.findFirst({
      where: {
        unitId: data.unitId,
        type: data.type,
        readingDate: { lt: new Date(data.readingDate) },
      },
      orderBy: { readingDate: "desc" },
    });

    // Use manual previousReading if provided (for first-time entries), otherwise use from history
    const manualPrevReading = data.previousReading !== undefined && data.previousReading !== ""
      ? parseFloat(data.previousReading)
      : null;
    const prevValue = (manualPrevReading !== null && !isNaN(manualPrevReading))
      ? manualPrevReading
      : (previousReading?.currentReading || 0);
    const usage = Math.max(0, data.currentReading - prevValue);
    const rate = data.type === "ELECTRICITY" ? unit.project.electricityRate : unit.project.waterRate;
    const amount = usage * rate;

    const reading = await prisma.meterReading.create({
      data: {
        projectId: unit.projectId,
        unitId: data.unitId,
        type: data.type,
        previousReading: prevValue,
        currentReading: data.currentReading,
        usage,
        rate,
        amount,
        readingDate: new Date(data.readingDate),
        // Snapshot fields (preserved even if unit is deleted)
        projectName: unit.project.name,
        unitNumber: unit.unitNumber,
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
