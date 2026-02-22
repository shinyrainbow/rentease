import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { MeterType } from "@prisma/client";

// Get previous meter reading for a unit
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get("unitId");
    const type = searchParams.get("type");
    const readingDate = searchParams.get("readingDate");

    if (!unitId || !type || !readingDate) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const previousReading = await prisma.meterReading.findFirst({
      where: {
        unitId,
        type: type as MeterType,
        readingDate: { lt: new Date(readingDate) },
        project: { ownerId: session.user.id },
      },
      orderBy: { readingDate: "desc" },
      select: {
        currentReading: true,
        readingDate: true,
      },
    });

    return NextResponse.json({
      hasPrevious: !!previousReading,
      previousReading: previousReading?.currentReading || null,
      previousDate: previousReading?.readingDate || null,
    });
  } catch (error) {
    console.error("Error fetching previous reading:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
