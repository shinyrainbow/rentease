import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateReceiptNo } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receipts = await prisma.receipt.findMany({
      where: {
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            tenantId: true,
            project: { select: { name: true, companyName: true, companyNameTh: true, taxId: true } },
            unit: { select: { unitNumber: true } },
            tenant: { select: { name: true, companyName: true, taxId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(receipts);
  } catch (error) {
    console.error("Error fetching receipts:", error);
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

    // Verify the invoice belongs to the user
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, project: { ownerId: session.user.id } },
      include: { project: true, receipt: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Check if receipt already exists for this invoice
    if (invoice.receipt) {
      return NextResponse.json(
        { error: "Receipt already exists for this invoice" },
        { status: 400 }
      );
    }

    // Generate receipt number
    const receiptNo = generateReceiptNo(
      invoice.project.name.substring(0, 3).toUpperCase(),
      new Date()
    );

    // Create the receipt
    const receipt = await prisma.receipt.create({
      data: {
        receiptNo,
        invoiceId: invoice.id,
        amount: data.amount || invoice.totalAmount,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            project: { select: { name: true } },
            unit: { select: { unitNumber: true } },
            tenant: { select: { name: true } },
          },
        },
      },
    });

    // Optionally mark the invoice as PAID if requested
    if (data.markAsPaid) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAmount: invoice.totalAmount,
        },
      });
    }

    return NextResponse.json(receipt);
  } catch (error) {
    console.error("Error creating receipt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
