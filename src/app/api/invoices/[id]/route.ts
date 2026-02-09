import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

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
        project: { select: { name: true, nameTh: true, companyName: true, companyNameTh: true, taxId: true } },
        unit: { select: { unitNumber: true } },
        tenant: { select: { name: true, nameTh: true, tenantType: true, taxId: true } },
        receipt: true,
        payments: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Use snapshot data if available
    const invoiceWithSnapshot = {
      ...invoice,
      tenant: invoice.tenantName ? {
        name: invoice.tenantName,
        nameTh: invoice.tenantNameTh,
        tenantType: invoice.tenantType,
        taxId: invoice.tenantTaxId,
      } : invoice.tenant,
    };

    return NextResponse.json(invoiceWithSnapshot);
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

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id, project: { ownerId: session.user.id } },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow updating specific fields
    const updateData: Record<string, unknown> = {};

    if (data.invoiceDate !== undefined) {
      updateData.invoiceDate = new Date(data.invoiceDate);
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = new Date(data.dueDate);
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
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
      include: {
        payments: true,
        receipt: true,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check for linked payments
    if (existingInvoice.payments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete invoice with linked payments. Please remove payments first." },
        { status: 400 }
      );
    }

    // Check for linked receipt
    if (existingInvoice.receipt) {
      return NextResponse.json(
        { error: "Cannot delete invoice with linked receipt. Please remove receipt first." },
        { status: 400 }
      );
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
