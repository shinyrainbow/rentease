import { NextRequest, NextResponse } from "next/server";
import { requireMutationAccess } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { generateInvoiceNo } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireMutationAccess();
    if (error) return error;

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
      if (!unit) continue; // Skip orphaned tenants
      const project = unit.project;

      // Skip if tenant already has an invoice of this type in the same month
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          tenantId: tenant.id,
          type,
          invoiceDate: {
            gte: new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1),
            lt: new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + 1, 1),
          },
        },
      });

      if (existingInvoice) {
        skipped++;
        continue;
      }

      const invoiceNo = generateInvoiceNo(project.name.substring(0, 3).toUpperCase(), invoiceDate, unit.unitNumber, type);

      // Calculate amounts based on type
      const lineItems: { description: string; amount: number; quantity?: number; unitPrice?: number; usage?: number; rate?: number; previousReading?: number; currentReading?: number; readingDate?: string; meterType?: string }[] = [];
      let subtotal = 0;
      const meterReadingIds: string[] = [];

      if (type === "RENT" || type === "COMBINED") {
        const rentAmount = tenant.baseRent;

        lineItems.push({
          description: "ค่าเช่า / Rent",
          amount: rentAmount,
          quantity: 1,
          unitPrice: rentAmount,
        });
        subtotal += rentAmount;
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
            previousReading: reading.previousReading,
            currentReading: reading.currentReading,
            readingDate: reading.readingDate.toISOString(),
            meterType: reading.type,
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

      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
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
            // Project/Unit snapshot
            projectName: project.name,
            unitNumber: unit.unitNumber,
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
          await tx.meterReading.updateMany({
            where: { id: { in: meterReadingIds } },
            data: { invoiceId: created.id },
          });
        }

        return created;
      });

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
