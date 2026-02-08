import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { generateReceiptNo } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { approved } = await request.json();

    const payment = await prisma.payment.findFirst({
      where: { id, invoice: { project: { ownerId: session.user.id } } },
      include: { invoice: { include: { project: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: approved ? "VERIFIED" : "REJECTED",
        slipVerified: approved,
        verifiedAt: new Date(),
        verifiedBy: session.user.id,
      },
    });

    // Recalculate invoice based on all VERIFIED payments (including this one)
    const allPayments = await prisma.payment.findMany({
      where: {
        invoiceId: payment.invoiceId,
        status: "VERIFIED",
      },
    });

    const newPaidAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = payment.invoice.totalAmount;

    let newStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING";
    if (newPaidAmount >= totalAmount) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    // Update invoice with new paidAmount and status
    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    // Handle receipt based on invoice status
    if (newStatus === "PAID") {
      const existingReceipt = await prisma.receipt.findUnique({
        where: { invoiceId: payment.invoiceId },
      });

      if (!existingReceipt) {
        // Create receipt if doesn't exist yet
        const receiptNo = generateReceiptNo(
          payment.invoice.project.name.substring(0, 3).toUpperCase(),
          new Date()
        );

        await prisma.receipt.create({
          data: {
            receiptNo,
            invoiceId: payment.invoiceId,
            amount: newPaidAmount,
          },
        });
      } else {
        // Update existing receipt amount to match actual paid amount
        await prisma.receipt.update({
          where: { invoiceId: payment.invoiceId },
          data: { amount: newPaidAmount },
        });
      }
    } else {
      // Delete receipt if invoice is no longer fully paid
      await prisma.receipt.deleteMany({
        where: { invoiceId: payment.invoiceId },
      });
    }

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
