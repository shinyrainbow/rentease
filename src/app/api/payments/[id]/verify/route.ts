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

    if (approved) {
      // Update invoice paid amount and status
      const newPaidAmount = payment.invoice.paidAmount + payment.amount;
      const newStatus = newPaidAmount >= payment.invoice.totalAmount ? "PAID" : "PARTIAL";

      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      // Create receipt if fully paid
      if (newStatus === "PAID") {
        const receiptNo = generateReceiptNo(
          payment.invoice.project.name.substring(0, 3).toUpperCase(),
          new Date()
        );

        await prisma.receipt.create({
          data: {
            receiptNo,
            invoiceId: payment.invoiceId,
            amount: payment.invoice.totalAmount,
          },
        });
      }
    }

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
