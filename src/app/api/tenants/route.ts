import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getPresignedUrl, isS3Key } from "@/lib/s3";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const statusFilter = searchParams.get("status");

    // Build filter based on status query param (calculated from contractEnd)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let contractEndFilter: object | undefined;
    if (statusFilter === "ACTIVE") {
      // Active means contract hasn't ended yet
      contractEndFilter = { contractEnd: { gte: today } };
    } else if (statusFilter === "EXPIRED") {
      // Expired means contract has ended
      contractEndFilter = { contractEnd: { lt: today } };
    }

    const tenants = await prisma.tenant.findMany({
      where: {
        unit: {
          project: { ownerId: session.user.id },
          ...(projectId && { projectId }),
        },
        ...contractEndFilter,
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectId: true,
            project: { select: { name: true, nameTh: true } },
          },
        },
        invoices: { select: { id: true, invoiceNo: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate presigned URLs for tenant images
    const tenantsWithImageUrls = await Promise.all(
      tenants.map(async (tenant) => {
        if (tenant.imageUrl && isS3Key(tenant.imageUrl)) {
          const presignedUrl = await getPresignedUrl(tenant.imageUrl, 3600);
          return { ...tenant, imageUrl: presignedUrl };
        }
        return tenant;
      })
    );

    return NextResponse.json(tenantsWithImageUrls);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Validate contract dates
    if (data.contractStart && data.contractEnd) {
      const startDate = new Date(data.contractStart);
      const endDate = new Date(data.contractEnd);

      if (startDate >= endDate) {
        return NextResponse.json(
          { error: "วันที่เริ่มสัญญาต้องน้อยกว่าวันที่สิ้นสุดสัญญา (Contract start date must be less than contract end date)" },
          { status: 400 }
        );
      }
    }

    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, project: { ownerId: session.user.id } },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Note: Allow multiple tenants per unit (for cases where current contract is ending
    // and new tenant is already lined up)

    // Properly map and sanitize the data for Prisma
    const tenantData = {
      unitId: data.unitId,
      name: data.name,
      nameTh: data.nameTh || null,
      email: data.email || null,
      phone: data.phone || null,
      idCard: data.idCard || null,
      taxId: data.taxId || null,
      tenantType: data.tenantType || "INDIVIDUAL",
      withholdingTax: typeof data.withholdingTax === "number" ? data.withholdingTax : parseFloat(data.withholdingTax) || 0,
      // Contract pricing
      baseRent: typeof data.baseRent === "number" ? data.baseRent : parseFloat(data.baseRent) || 0,
      commonFee: data.commonFee ? parseFloat(data.commonFee) : null,
      deposit: data.deposit ? parseFloat(data.deposit) : null,
      discountPercent: data.discountPercent ? parseFloat(data.discountPercent) : 0,
      discountAmount: data.discountAmount ? parseFloat(data.discountAmount) : 0,
      // Meter info
      electricMeterNo: data.electricMeterNo || null,
      waterMeterNo: data.waterMeterNo || null,
      lineUserId: data.lineUserId || null,
      contractStart: data.contractStart ? new Date(data.contractStart) : null,
      contractEnd: data.contractEnd ? new Date(data.contractEnd) : null,
    };

    const tenant = await prisma.tenant.create({
      data: tenantData,
      include: {
        unit: {
          include: {
            project: { select: { name: true, nameTh: true } },
          },
        },
      },
    });

    // Update unit status to occupied (only if currently vacant or reserved)
    if (unit.status === "VACANT" || unit.status === "RESERVED") {
      await prisma.unit.update({
        where: { id: data.unitId },
        data: { status: "OCCUPIED" },
      });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
