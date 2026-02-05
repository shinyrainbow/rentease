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
    const billingMonth = searchParams.get("billingMonth");

    if (!unitId || !type || !billingMonth) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const previousReading = await prisma.meterReading.findFirst({
      where: {
        unitId,
        type: type as MeterType,
        billingMonth: { lt: billingMonth },
        project: { ownerId: session.user.id },
      },
      orderBy: { billingMonth: "desc" },
      select: {
        currentReading: true,
        billingMonth: true,
      },
    });

    return NextResponse.json({
      hasPrevious: !!previousReading,
      previousReading: previousReading?.currentReading || null,
      previousMonth: previousReading?.billingMonth || null,
    });
  } catch (error) {
    console.error("Error fetching previous reading:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
