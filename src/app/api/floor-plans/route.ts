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

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Find or create floor plan for this project
    let floorPlan = await prisma.floorPlan.findFirst({
      where: { projectId, project: { ownerId: session.user.id } },
    });

    if (!floorPlan) {
      // Auto-create default floor plan
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: session.user.id },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      floorPlan = await prisma.floorPlan.create({
        data: {
          projectId,
          name: "Floor 1",
          floor: 1,
          layoutData: { decorations: [] },
        },
      });
    }

    return NextResponse.json(floorPlan);
  } catch (error) {
    console.error("Error fetching floor plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
