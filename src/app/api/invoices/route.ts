import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
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

    // Use snapshot data if available, otherwise fall back to joined tenant data
    const invoicesWithSnapshot = invoices.map(invoice => ({
      ...invoice,
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Use invoiceDate for invoice number generation
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const invoiceNo = generateInvoiceNo(unit.project.name.substring(0, 3).toUpperCase(), invoiceDate);

    // Calculate amounts based on type
    let lineItems: { description: string; amount: number }[] = [];
    let subtotal = 0;
    const meterReadingIds: string[] = [];

    if (data.type === "RENT" || data.type === "COMBINED") {
      const rentAmount = activeTenant.baseRent - (activeTenant.discountAmount || 0) - (activeTenant.baseRent * (activeTenant.discountPercent || 0) / 100);
      lineItems.push({ description: "ค่าเช่า / Rent", amount: rentAmount });
      if (activeTenant.commonFee) {
        lineItems.push({ description: "ค่าส่วนกลาง / Common Fee", amount: activeTenant.commonFee });
      }
      subtotal += rentAmount + (activeTenant.commonFee || 0);
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
          lineItems.push({ description, amount: reading.amount });
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

    const invoice = await prisma.invoice.create({
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
      await prisma.meterReading.updateMany({
        where: { id: { in: meterReadingIds } },
        data: { invoiceId: invoice.id },
      });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
