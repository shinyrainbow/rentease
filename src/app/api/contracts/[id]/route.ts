import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/contracts/[id] - Get a single contract
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const contract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            nameTh: true,
            companyName: true,
            companyNameTh: true,
            companyAddress: true,
            taxId: true,
            logoUrl: true,
          },
        },
        unit: { select: { id: true, unitNumber: true, floor: true, size: true, type: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            nameTh: true,
            email: true,
            phone: true,
            address: true,
            idCard: true,
            taxId: true,
            tenantType: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Verify ownership
    const project = await prisma.project.findUnique({
      where: { id: contract.projectId },
      select: { ownerId: true },
    });

    if (project?.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json({ error: "Failed to fetch contract" }, { status: 500 });
  }
}

// PUT /api/contracts/[id] - Update a contract (draft only)
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
    const data = await request.json();

    const existingContract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (existingContract.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (existingContract.status !== "DRAFT") {
      return NextResponse.json({ error: "Can only edit draft contracts" }, { status: 400 });
    }

    const contract = await prisma.leaseContract.update({
      where: { id },
      data: {
        title: data.title,
        titleTh: data.titleTh,
        clauses: data.clauses,
        baseRent: data.baseRent ? parseFloat(data.baseRent) : existingContract.baseRent,
        commonFee: data.commonFee ? parseFloat(data.commonFee) : existingContract.commonFee,
        deposit: data.deposit ? parseFloat(data.deposit) : existingContract.deposit,
        contractStart: data.contractStart ? new Date(data.contractStart) : existingContract.contractStart,
        contractEnd: data.contractEnd ? new Date(data.contractEnd) : existingContract.contractEnd,
      },
      include: {
        project: { select: { id: true, name: true, nameTh: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, name: true, nameTh: true, email: true, phone: true } },
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json({ error: "Failed to update contract" }, { status: 500 });
  }
}

// DELETE /api/contracts/[id] - Delete a contract (draft only)
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

    const existingContract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (existingContract.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (existingContract.status === "SIGNED") {
      return NextResponse.json({ error: "Cannot delete signed contracts" }, { status: 400 });
    }

    await prisma.leaseContract.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting contract:", error);
    return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 });
  }
}
