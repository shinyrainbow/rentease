import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const lineOaId = searchParams.get("lineOaId");

    if (!projectId && !lineOaId) {
      return NextResponse.json({ error: "Project ID or LineOA ID required" }, { status: 400 });
    }

    // Get access token from LineOA (preferred) or project (legacy fallback)
    let accessToken: string | null = null;

    if (lineOaId) {
      const lineOa = await prisma.lineOA.findFirst({
        where: { id: lineOaId, ownerId: session.user.id },
      });
      accessToken = lineOa?.lineAccessToken || null;
    }

    if (!accessToken && projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: session.user.id },
        include: { lineOa: true },
      });
      accessToken = project?.lineOa?.lineAccessToken || project?.lineAccessToken || null;
    }

    if (!accessToken) {
      return NextResponse.json({ error: "LINE not configured" }, { status: 404 });
    }

    // Fetch image content from LINE Content API
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error("LINE Content API error:", response.status, await response.text());
      return NextResponse.json({ error: "Failed to fetch image from LINE" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Error fetching LINE image:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
