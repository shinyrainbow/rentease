import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { projectId, type, month, dueDate } = data;
    // month = YYYY-MM string used to find meter readings in that month

    // Get all tenants with their units (any contract status)
    const activeTenants = await prisma.tenant.findMany({
      where: {
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

    const createdInvoices = [];
    const invoiceDate = new Date();
    let skipped = 0;

    // Build date range for meter readings in the selected month
    let monthStart: Date | undefined;
    let monthEnd: Date | undefined;
    if (month) {
      const [year, mon] = month.split("-");
      monthStart = new Date(parseInt(year), parseInt(mon) - 1, 1);
      monthEnd = new Date(parseInt(year), parseInt(mon), 1);
    }

    for (const tenant of activeTenants) {
      const unit = tenant.unit;
      const project = unit.project;

      const invoiceNo = generateInvoiceNo(project.name.substring(0, 3).toUpperCase(), invoiceDate);

      // Calculate amounts based on type
      const lineItems: { description: string; amount: number; quantity?: number; unitPrice?: number; usage?: number; rate?: number }[] = [];
      let subtotal = 0;
      const meterReadingIds: string[] = [];

      if (type === "RENT" || type === "COMBINED") {
        const discountAmount = tenant.discountAmount || 0;
        const discountPercent = tenant.discountPercent || 0;
        const rentDiscount = tenant.baseRent * (discountPercent / 100);
        const rentAmount = tenant.baseRent - discountAmount - rentDiscount;

        lineItems.push({
          description: "ค่าเช่า / Rent",
          amount: rentAmount,
          quantity: 1,
          unitPrice: rentAmount,
        });
        subtotal += rentAmount;

        if (tenant.commonFee && tenant.commonFee > 0) {
          lineItems.push({
            description: "ค่าส่วนกลาง / Common Fee",
            amount: tenant.commonFee,
            quantity: 1,
            unitPrice: tenant.commonFee,
          });
          subtotal += tenant.commonFee;
        }
      }

      if (type === "UTILITY" || type === "COMBINED") {
        // Get uninvoiced meter readings for this unit in the selected month
        const meterReadings = await prisma.meterReading.findMany({
          where: {
            unitId: unit.id,
            invoiceId: null,
            ...(monthStart && monthEnd && {
              readingDate: { gte: monthStart, lt: monthEnd },
            }),
          },
        });

        for (const reading of meterReadings) {
          const description = reading.type === "ELECTRICITY"
            ? `ค่าไฟฟ้า / Electricity`
            : `ค่าน้ำ / Water`;

          lineItems.push({
            description,
            amount: reading.amount,
            quantity: reading.usage,
            unitPrice: reading.rate,
            usage: reading.usage,
            rate: reading.rate,
          });
          subtotal += reading.amount;
          meterReadingIds.push(reading.id);
        }
      }

      // Skip if no line items (e.g., UTILITY type with no meter readings)
      if (lineItems.length === 0) {
        skipped++;
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
          dueDate: new Date(dueDate),
          invoiceDate,
          subtotal,
          withholdingTax,
          totalAmount,
          lineItems: lineItems as Prisma.InputJsonValue,
          // Tenant snapshot
          tenantName: tenant.name,
          tenantNameTh: tenant.nameTh,
          tenantType: tenant.tenantType,
          tenantTaxId: tenant.taxId,
          tenantIdCard: tenant.idCard,
          tenantPhone: tenant.phone,
          tenantEmail: tenant.email,
        },
      });

      // Link meter readings to this invoice
      if (meterReadingIds.length > 0) {
        await prisma.meterReading.updateMany({
          where: { id: { in: meterReadingIds } },
          data: { invoiceId: invoice.id },
        });
      }

      createdInvoices.push(invoice);
    }

    return NextResponse.json({
      message: `Created ${createdInvoices.length} invoices`,
      created: createdInvoices.length,
      skipped,
      invoices: createdInvoices,
    });
  } catch (error) {
    console.error("Error creating bulk invoices:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
