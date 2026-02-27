import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

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

    const existing = await prisma.lineOA.findFirst({
      where: { id, ownerId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "LINE OA not found" }, { status: 404 });
    }

    const { name, lineChannelId, lineChannelSecret, lineAccessToken, liffId } =
      await request.json();

    const lineOa = await prisma.lineOA.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(lineChannelId !== undefined && { lineChannelId: lineChannelId || null }),
        ...(lineChannelSecret !== undefined && { lineChannelSecret: lineChannelSecret || null }),
        ...(lineAccessToken !== undefined && { lineAccessToken: lineAccessToken || null }),
        ...(liffId !== undefined && { liffId: liffId || null }),
      },
      include: {
        projects: { select: { id: true, name: true, nameTh: true } },
        _count: { select: { contacts: true } },
      },
    });

    return NextResponse.json(lineOa);
  } catch (error) {
    console.error("Error updating LINE OA:", error);
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

    const existing = await prisma.lineOA.findFirst({
      where: { id, ownerId: session.user.id },
      include: { _count: { select: { contacts: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "LINE OA not found" }, { status: 404 });
    }

    // Unlink projects first (set lineOaId = null)
    await prisma.project.updateMany({
      where: { lineOaId: id },
      data: { lineOaId: null },
    });

    // Delete LINE OA (contacts cascade-delete via schema)
    await prisma.lineOA.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting LINE OA:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
