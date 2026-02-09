import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/s3";

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    // Check if payment exists and belongs to user
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        method: data.method,
        status: data.status,
        transferRef: data.method === "TRANSFER" ? data.transferRef : null,
        transferBank: data.method === "TRANSFER" ? data.transferBank : null,
        checkNo: data.method === "CHECK" ? data.checkNo : null,
        checkBank: data.method === "CHECK" ? data.checkBank : null,
        checkDate: data.method === "CHECK" && data.checkDate ? new Date(data.checkDate) : null,
        notes: data.notes || null,
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
          },
        },
        tenant: { select: { name: true, nameTh: true } },
      },
    });

    // Recalculate invoice's paidAmount and status
    const allPayments = await prisma.payment.findMany({
      where: {
        invoiceId: payment.invoice.id,
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
      where: { id: payment.invoice.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    // Handle receipt based on invoice status
    if (newStatus !== "PAID") {
      // Delete receipt if invoice is no longer fully paid
      await prisma.receipt.deleteMany({
        where: { invoiceId: payment.invoice.id },
      });
    } else {
      // Update receipt amount to match actual paid amount if receipt exists
      await prisma.receipt.updateMany({
        where: { invoiceId: payment.invoice.id },
        data: { amount: newPaidAmount },
      });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error updating payment:", error);
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

    // Check if payment exists and belongs to user
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: {
          include: {
            receipt: true,
          },
        },
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Check if invoice has a receipt
    if (existingPayment.invoice.receipt) {
      return NextResponse.json(
        {
          error: "Cannot delete payment for an invoice with a receipt. Please delete the receipt first.",
          errorCode: "INVOICE_HAS_RECEIPT"
        },
        { status: 400 }
      );
    }

    // Store invoice info before deletion
    const invoiceId = existingPayment.invoice.id;
    const totalAmount = existingPayment.invoice.totalAmount;

    // Delete associated slips first
    await prisma.paymentSlip.deleteMany({
      where: { paymentId: id },
    });

    // Delete the payment
    await prisma.payment.delete({
      where: { id },
    });

    // Recalculate invoice's paidAmount and status
    const remainingPayments = await prisma.payment.findMany({
      where: {
        invoiceId: invoiceId,
        status: "VERIFIED",
      },
    });

    const newPaidAmount = remainingPayments.reduce((sum, p) => sum + p.amount, 0);

    let newStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING";
    if (newPaidAmount >= totalAmount) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    // Update invoice with new paidAmount and status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    // Handle receipt based on invoice status
    if (newStatus !== "PAID") {
      // Delete receipt if invoice is no longer fully paid
      await prisma.receipt.deleteMany({
        where: { invoiceId: invoiceId },
      });
    } else {
      // Update receipt amount to match actual paid amount if receipt exists
      await prisma.receipt.updateMany({
        where: { invoiceId: invoiceId },
        data: { amount: newPaidAmount },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
