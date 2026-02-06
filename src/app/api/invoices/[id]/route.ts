import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getPresignedUrl, isS3Key } from "@/lib/s3";

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

    const invoice = await prisma.invoice.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        project: true,
        unit: true,
        tenant: true,
        payments: true,
        receipt: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Convert logo S3 key to presigned URL if needed
    let logoPresignedUrl = "";
    if (invoice.project.logoUrl) {
      logoPresignedUrl = isS3Key(invoice.project.logoUrl)
        ? await getPresignedUrl(invoice.project.logoUrl, 3600)
        : invoice.project.logoUrl;
    }

    return NextResponse.json({
      ...invoice,
      project: {
        ...invoice.project,
        logoPresignedUrl,
      },
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const { type, billingMonth, dueDate, notes } = data;

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        tenant: true,
        unit: true,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const tenant = existingInvoice.tenant;
    const unit = existingInvoice.unit;

    // Recalculate amounts based on tenant contract details
    const lineItems: { description: string; amount: number; quantity?: number; unitPrice?: number; usage?: number; rate?: number }[] = [];
    let subtotal = 0;

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
      // Get meter readings for the billing month
      const meterReadings = await prisma.meterReading.findMany({
        where: { unitId: unit.id, billingMonth: billingMonth || existingInvoice.billingMonth },
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
      }
    }

    // Calculate withholding tax based on tenant type
    const withholdingTax = tenant.tenantType === "COMPANY"
      ? subtotal * (tenant.withholdingTax / 100)
      : 0;

    const totalAmount = subtotal - withholdingTax;

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        type: type || existingInvoice.type,
        billingMonth: billingMonth || existingInvoice.billingMonth,
        dueDate: dueDate ? new Date(dueDate) : existingInvoice.dueDate,
        notes: notes !== undefined ? notes : existingInvoice.notes,
        subtotal,
        withholdingTax,
        totalAmount,
        lineItems: lineItems as Prisma.InputJsonValue,
      },
      include: {
        project: { select: { name: true, nameTh: true } },
        unit: { select: { unitNumber: true } },
        tenant: { select: { name: true, nameTh: true } },
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
