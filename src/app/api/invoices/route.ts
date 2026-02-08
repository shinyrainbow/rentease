import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/utils";

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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
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
      include: { project: true, tenants: { where: { contractStart: { lte: new Date() }, contractEnd: { gte: new Date() } }, take: 1 } },
    });

    const activeTenant = unit?.tenants[0];

    if (!unit || !activeTenant) {
      return NextResponse.json({ error: "Unit or tenant not found" }, { status: 404 });
    }

    // Use billing month for invoice number generation
    const [year, month] = data.billingMonth.split("-");
    const billingDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const invoiceNo = generateInvoiceNo(unit.project.name.substring(0, 3).toUpperCase(), billingDate);

    // Calculate amounts based on type
    let lineItems: { description: string; amount: number }[] = [];
    let subtotal = 0;

    if (data.type === "RENT" || data.type === "COMBINED") {
      const rentAmount = activeTenant.baseRent - (activeTenant.discountAmount || 0) - (activeTenant.baseRent * (activeTenant.discountPercent || 0) / 100);
      lineItems.push({ description: "ค่าเช่า / Rent", amount: rentAmount });
      if (activeTenant.commonFee) {
        lineItems.push({ description: "ค่าส่วนกลาง / Common Fee", amount: activeTenant.commonFee });
      }
      subtotal += rentAmount + (activeTenant.commonFee || 0);
    }

    if (data.type === "UTILITY" || data.type === "COMBINED") {
      // Get meter readings for the billing month
      const meterReadings = await prisma.meterReading.findMany({
        where: { unitId: data.unitId, billingMonth: data.billingMonth },
      });

      for (const reading of meterReadings) {
        const description = reading.type === "ELECTRICITY"
          ? `ค่าไฟฟ้า / Electricity (${reading.usage} units x ฿${reading.rate})`
          : `ค่าน้ำ / Water (${reading.usage} units x ฿${reading.rate})`;
        lineItems.push({ description, amount: reading.amount });
        subtotal += reading.amount;
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
        billingMonth: data.billingMonth,
        dueDate: new Date(data.dueDate),
        subtotal,
        withholdingTax,
        totalAmount,
        lineItems,
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
        tenant: { select: { name: true, nameTh: true } },
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
