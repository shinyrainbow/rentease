import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireMutationAccess } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const tenantId = searchParams.get("tenantId");

    // Support multiple statuses (comma-separated)
    const statusFilter = status
      ? status.split(",").map((s) => s.trim() as "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED")
      : undefined;

    const invoices = await prisma.invoice.findMany({
      where: {
        project: { ownerId: session.user.id },
        ...(projectId && { projectId }),
        ...(tenantId && { tenantId }),
        ...(statusFilter && { status: { in: statusFilter } }),
      },
      include: {
        project: { select: { name: true, nameTh: true, companyName: true, companyNameTh: true, taxId: true } },
        unit: { select: { unitNumber: true } },
        tenant: { select: { name: true, nameTh: true, tenantType: true, taxId: true } },
        receipt: { select: { id: true } },
        payments: { select: { id: true } },
        meterReadings: { select: { id: true, type: true, usage: true, rate: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Use snapshot data as fallback when relations are null (unit/tenant deleted)
    const invoicesWithSnapshot = invoices.map(invoice => ({
      ...invoice,
      unit: invoice.unit || { unitNumber: invoice.unitNumber || "-" },
      tenant: invoice.tenantName ? {
        name: invoice.tenantName,
        nameTh: invoice.tenantNameTh,
        tenantType: invoice.tenantType,
        taxId: invoice.tenantTaxId,
      } : invoice.tenant,
    }));

    return NextResponse.json(invoicesWithSnapshot);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireMutationAccess();
    if (error) return error;

    const data = await request.json();

    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, project: { ownerId: session.user.id } },
      include: {
        project: true,
        tenants: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const activeTenant = unit?.tenants[0];

    if (!unit || !activeTenant) {
      return NextResponse.json({ error: "Unit or tenant not found" }, { status: 404 });
    }

    // Use custom invoiceNo if provided, otherwise generate one
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const invoiceNo = data.invoiceNo || generateInvoiceNo(
      unit.project.name.substring(0, 3).toUpperCase(),
      invoiceDate,
      unit.unitNumber,
      data.type
    );

    // Calculate amounts based on type
    let lineItems: { description: string; amount: number; quantity?: number; unitPrice?: number; usage?: number; rate?: number; previousReading?: number; currentReading?: number; readingDate?: string; meterType?: string }[] = [];
    let subtotal = 0;
    const meterReadingIds: string[] = [];

    if (data.type === "RENT" || data.type === "COMBINED") {
      const rentAmount = activeTenant.baseRent;
      lineItems.push({ description: "ค่าเช่า / Rent", amount: rentAmount });
      subtotal += rentAmount;
    }

    if (data.type === "UTILITY" || data.type === "COMBINED") {
      // Get selected meter readings by IDs
      if (data.meterReadingIds && data.meterReadingIds.length > 0) {
        const meterReadings = await prisma.meterReading.findMany({
          where: {
            id: { in: data.meterReadingIds },
            unitId: data.unitId,
            invoiceId: null, // Only uninvoiced readings
          },
        });

        for (const reading of meterReadings) {
          const description = reading.type === "ELECTRICITY"
            ? `ค่าไฟฟ้า / Electricity (${reading.usage} units x ฿${reading.rate})`
            : `ค่าน้ำ / Water (${reading.usage} units x ฿${reading.rate})`;
          lineItems.push({
            description,
            amount: reading.amount,
            quantity: reading.usage,
            unitPrice: reading.rate,
            usage: reading.usage,
            rate: reading.rate,
            previousReading: reading.previousReading,
            currentReading: reading.currentReading,
            readingDate: reading.readingDate.toISOString(),
            meterType: reading.type,
          });
          subtotal += reading.amount;
          meterReadingIds.push(reading.id);
        }
      }
    }

    // Calculate withholding tax
    const withholdingTax = activeTenant.tenantType === "COMPANY"
      ? subtotal * (activeTenant.withholdingTax / 100)
      : 0;

    const totalAmount = subtotal - withholdingTax;

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNo,
          projectId: unit.projectId,
          unitId: unit.id,
          tenantId: activeTenant.id,
          type: data.type,
          dueDate: new Date(data.dueDate),
          invoiceDate,
          subtotal,
          withholdingTax,
          totalAmount,
          lineItems,
          // Project/Unit snapshot
          projectName: unit.project.invoiceName || unit.project.name,
          unitNumber: unit.unitNumber,
          // Tenant snapshot
          tenantName: activeTenant.name,
          tenantNameTh: activeTenant.nameTh,
          tenantType: activeTenant.tenantType,
          tenantTaxId: activeTenant.taxId,
          tenantIdCard: activeTenant.idCard,
          tenantPhone: activeTenant.phone,
          tenantEmail: activeTenant.email,
        },
        include: {
          project: { select: { name: true, nameTh: true } },
          unit: { select: { unitNumber: true } },
          tenant: { select: { name: true, nameTh: true } },
        },
      });

      // Link meter readings to this invoice
      if (meterReadingIds.length > 0) {
        await tx.meterReading.updateMany({
          where: { id: { in: meterReadingIds } },
          data: { invoiceId: created.id },
        });
      }

      return created;
    });

    return NextResponse.json(invoice);
  } catch (error: unknown) {
    console.error("Error creating invoice:", error);
    // Handle unique constraint violation on invoiceNo
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "เลขที่ใบแจ้งหนี้ซ้ำ กรุณาใช้เลขที่อื่น (Duplicate invoice number. Please use a different number.)" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
