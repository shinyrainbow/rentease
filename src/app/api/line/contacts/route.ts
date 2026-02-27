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
    const lineOaId = searchParams.get("lineOaId");

    const contacts = await prisma.lineContact.findMany({
      where: {
        lineOa: { ownerId: session.user.id },
        ...(lineOaId && { lineOaId }),
        ...(projectId && { projectId }),
      },
      include: {
        lineOa: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, nameTh: true } },
        tenant: { select: { id: true, name: true, nameTh: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching LINE contacts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Link LINE contact to tenant
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contactId, tenantId } = await request.json();

    // Verify contact belongs to user's LineOA
    const contact = await prisma.lineContact.findFirst({
      where: { id: contactId, lineOa: { ownerId: session.user.id } },
      include: { lineOa: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If linking to a tenant, verify tenant's project uses the same LineOA
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: {
          id: tenantId,
          unit: {
            project: {
              ownerId: session.user.id,
              lineOaId: contact.lineOaId,
            },
          },
        },
        include: { unit: true },
      });

      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found or not linked to this LINE OA" }, { status: 404 });
      }

      // Set both tenantId and projectId (derived from tenant)
      const updatedContact = await prisma.lineContact.update({
        where: { id: contactId },
        data: {
          tenantId,
          projectId: tenant.unit?.projectId,
        },
        include: {
          lineOa: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, nameTh: true } },
          tenant: { select: { id: true, name: true, nameTh: true } },
        },
      });

      return NextResponse.json(updatedContact);
    } else {
      // Unlinking — clear both tenantId and projectId
      const updatedContact = await prisma.lineContact.update({
        where: { id: contactId },
        data: {
          tenantId: null,
          projectId: null,
        },
        include: {
          lineOa: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, nameTh: true } },
          tenant: { select: { id: true, name: true, nameTh: true } },
        },
      });

      return NextResponse.json(updatedContact);
    }
  } catch (error) {
    console.error("Error linking LINE contact:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
