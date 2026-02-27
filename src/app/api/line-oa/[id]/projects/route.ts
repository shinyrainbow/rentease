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
    const { projectIds } = await request.json();

    if (!Array.isArray(projectIds)) {
      return NextResponse.json({ error: "projectIds must be an array" }, { status: 400 });
    }

    // Verify LINE OA belongs to user
    const lineOa = await prisma.lineOA.findFirst({
      where: { id, ownerId: session.user.id },
      include: { projects: { select: { id: true } } },
    });

    if (!lineOa) {
      return NextResponse.json({ error: "LINE OA not found" }, { status: 404 });
    }

    // Verify all requested projects belong to user
    const userProjects = await prisma.project.findMany({
      where: { id: { in: projectIds }, ownerId: session.user.id },
      select: { id: true },
    });

    if (userProjects.length !== projectIds.length) {
      return NextResponse.json({ error: "Some projects not found" }, { status: 400 });
    }

    // Unlink projects that were previously assigned but not in new list
    const previousIds = lineOa.projects.map((p) => p.id);
    const toUnlink = previousIds.filter((pid) => !projectIds.includes(pid));

    await prisma.$transaction([
      // Unlink removed projects
      ...(toUnlink.length > 0
        ? [
            prisma.project.updateMany({
              where: { id: { in: toUnlink } },
              data: { lineOaId: null },
            }),
          ]
        : []),
      // Link new projects
      ...(projectIds.length > 0
        ? [
            prisma.project.updateMany({
              where: { id: { in: projectIds }, ownerId: session.user.id },
              data: { lineOaId: id },
            }),
          ]
        : []),
    ]);

    // Return updated LINE OA
    const updated = await prisma.lineOA.findUnique({
      where: { id },
      include: {
        projects: { select: { id: true, name: true, nameTh: true } },
        _count: { select: { contacts: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error assigning projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
