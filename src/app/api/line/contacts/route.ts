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

    const contacts = await prisma.lineContact.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
      },
      include: {
        project: { select: { name: true, nameTh: true } },
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

    // Verify contact belongs to user's project
    const contact = await prisma.lineContact.findFirst({
      where: { id: contactId, project: { ownerId: session.user.id } },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // If linking to a tenant, verify tenant belongs to same project
    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, unit: { projectId: contact.projectId } },
      });

      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found in this project" }, { status: 404 });
      }
    }

    const updatedContact = await prisma.lineContact.update({
      where: { id: contactId },
      data: { tenantId: tenantId || null },
      include: {
        project: { select: { name: true, nameTh: true } },
        tenant: { select: { id: true, name: true, nameTh: true } },
      },
    });

    return NextResponse.json(updatedContact);
  } catch (error) {
    console.error("Error linking LINE contact:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
