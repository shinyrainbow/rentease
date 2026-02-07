import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/contracts - List all contracts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const contracts = await prisma.leaseContract.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
        ...(status && { status: status as "DRAFT" | "PENDING_TENANT" | "SIGNED" | "CANCELLED" }),
      },
      include: {
        project: { select: { id: true, name: true, nameTh: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, name: true, nameTh: true, email: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 });
  }
}

// POST /api/contracts - Create a new contract
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { tenantId, title, titleTh, clauses } = data;

    // Fetch tenant with unit and project
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        unit: {
          include: {
            project: { select: { ownerId: true } },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify ownership
    if (tenant.unit.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate contract number
    const year = new Date().getFullYear();
    const count = await prisma.leaseContract.count({
      where: {
        contractNo: { startsWith: `LC${year}` },
      },
    });
    const contractNo = `LC${year}${String(count + 1).padStart(5, "0")}`;

    // Set token expiration (7 days from now)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

    const contract = await prisma.leaseContract.create({
      data: {
        contractNo,
        projectId: tenant.unit.projectId,
        unitId: tenant.unitId,
        tenantId: tenant.id,
        title: title || null,
        titleTh: titleTh || null,
        baseRent: tenant.baseRent,
        commonFee: tenant.commonFee,
        deposit: tenant.deposit,
        contractStart: tenant.contractStart || new Date(),
        contractEnd: tenant.contractEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        clauses: clauses || null,
        tokenExpiresAt,
      },
      include: {
        project: { select: { id: true, name: true, nameTh: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, name: true, nameTh: true, email: true, phone: true } },
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error creating contract:", error);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}
