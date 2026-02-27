import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lineOas = await prisma.lineOA.findMany({
      where: { ownerId: session.user.id },
      include: {
        projects: { select: { id: true, name: true, nameTh: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(lineOas);
  } catch (error) {
    console.error("Error fetching LINE OAs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, lineChannelId, lineChannelSecret, lineAccessToken, liffId } =
      await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const lineOa = await prisma.lineOA.create({
      data: {
        name,
        lineChannelId: lineChannelId || null,
        lineChannelSecret: lineChannelSecret || null,
        lineAccessToken: lineAccessToken || null,
        liffId: liffId || null,
        ownerId: session.user.id,
      },
      include: {
        projects: { select: { id: true, name: true, nameTh: true } },
        _count: { select: { contacts: true } },
      },
    });

    return NextResponse.json(lineOa);
  } catch (error) {
    console.error("Error creating LINE OA:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
