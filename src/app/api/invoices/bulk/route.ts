import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { projectId, type, billingMonth, dueDate } = data;

    // Get all active tenants with their units
    const activeTenants = await prisma.tenant.findMany({
      where: {
        status: "ACTIVE",
        unit: {
          project: {
            ownerId: session.user.id,
            ...(projectId && { id: projectId }),
          },
        },
      },
      include: {
        unit: {
          include: {
            project: true,
          },
        },
      },
    });

    if (activeTenants.length === 0) {
      return NextResponse.json({ error: "No active tenants found", created: 0, skipped: 0 }, { status: 200 });
    }

    // Check for existing invoices to avoid duplicates
    const existingInvoices = await prisma.invoice.findMany({
      where: {
        billingMonth,
        type,
        tenantId: { in: activeTenants.map(t => t.id) },
      },
      select: { tenantId: true },
    });

    const existingTenantIds = new Set(existingInvoices.map(i => i.tenantId));
    const tenantsToProcess = activeTenants.filter(t => !existingTenantIds.has(t.id));

    if (tenantsToProcess.length === 0) {
      return NextResponse.json({
        message: "All tenants already have invoices for this period",
        created: 0,
        skipped: activeTenants.length,
      });
    }

    const createdInvoices = [];

    for (const tenant of tenantsToProcess) {
      const unit = tenant.unit;
      const project = unit.project;

      const invoiceNo = generateInvoiceNo(project.name.substring(0, 3).toUpperCase(), new Date());

      // Calculate amounts based on type
      let lineItems: { description: string; amount: number }[] = [];
      let subtotal = 0;

      if (type === "RENT" || type === "COMBINED") {
        const rentAmount = tenant.baseRent - (tenant.discountAmount || 0) - (tenant.baseRent * (tenant.discountPercent || 0) / 100);
        lineItems.push({ description: "ค่าเช่า / Rent", amount: rentAmount });
        if (tenant.commonFee) {
          lineItems.push({ description: "ค่าส่วนกลาง / Common Fee", amount: tenant.commonFee });
        }
        subtotal += rentAmount + (tenant.commonFee || 0);
      }

      if (type === "UTILITY" || type === "COMBINED") {
        // Get meter readings for the billing month
        const meterReadings = await prisma.meterReading.findMany({
          where: { unitId: unit.id, billingMonth },
        });

        for (const reading of meterReadings) {
          const description = reading.type === "ELECTRICITY"
            ? `ค่าไฟฟ้า / Electricity (${reading.usage} units x ฿${reading.rate})`
            : `ค่าน้ำ / Water (${reading.usage} units x ฿${reading.rate})`;
          lineItems.push({ description, amount: reading.amount });
          subtotal += reading.amount;
        }
      }

      // Skip if no line items (e.g., UTILITY type with no meter readings)
      if (lineItems.length === 0) {
        continue;
      }

      // Calculate withholding tax
      const withholdingTax = tenant.tenantType === "COMPANY"
        ? subtotal * (tenant.withholdingTax / 100)
        : 0;

      const totalAmount = subtotal - withholdingTax;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNo,
          projectId: unit.projectId,
          unitId: unit.id,
          tenantId: tenant.id,
          type,
          billingMonth,
          dueDate: new Date(dueDate),
          subtotal,
          withholdingTax,
          totalAmount,
          lineItems,
        },
      });

      createdInvoices.push(invoice);
    }

    return NextResponse.json({
      message: `Created ${createdInvoices.length} invoices`,
      created: createdInvoices.length,
      skipped: existingTenantIds.size,
      invoices: createdInvoices,
    });
  } catch (error) {
    console.error("Error creating bulk invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
